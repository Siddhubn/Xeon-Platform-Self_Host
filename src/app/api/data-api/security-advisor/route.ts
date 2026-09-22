import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";

function generateId(): string {
  return randomBytes(16).toString("hex");
}

function resolvePostgresConnection(projectId: string, branchId: string) {
  const db = getDb();
  const compute = db
    .select()
    .from(schema.computes)
    .where(
      and(
        eq(schema.computes.projectId, projectId),
        eq(schema.computes.branchId, branchId),
        isNull(schema.computes.deletedAt)
      )
    )
    .get();

  return {
    host: compute?.host || process.env.POSTGRES_HOST || "localhost",
    port: compute?.port || parseInt(process.env.POSTGRES_PORT || "5432"),
    database: compute?.database || "neondb",
  };
}

// GET /api/data-api/security-advisor?projectId=X&branchId=Y&databaseName=Z
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const branchId = searchParams.get("branchId");
    const databaseName = searchParams.get("databaseName") || "postgres";

    if (!projectId || !branchId) {
      return NextResponse.json(
        { error: "projectId and branchId are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const conn = resolvePostgresConnection(projectId, branchId);
    const findings: Array<{
      id: string;
      severity: string;
      category: string;
      title: string;
      description: string;
      tableName: string | null;
      columnName: string | null;
      resolution: string;
      autoResolvable: boolean;
    }> = [];

    try {
      const pg = (await import("pg")).default;
      const client = new pg.Client({
        host: conn.host,
        port: conn.port,
        database: databaseName,
        user: process.env.POSTGRES_USER || "cloud_admin",
        password: process.env.POSTGRES_PASSWORD || "helloworld",
        connectionTimeoutMillis: 5000,
        query_timeout: 15000,
        ssl: false,
      });

      try {
        await client.connect();

        // Check 1: RLS not enabled on tables
        const rlsResult = await client.query(`
          SELECT schemaname, tablename, relrowsecurity
          FROM pg_catalog.pg_tables t
          JOIN pg_class c ON c.relname = t.tablename
            AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
          WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
            AND t.schemaname = 'public'
        `);

        for (const row of rlsResult.rows) {
          if (!row.relrowsecurity) {
            findings.push({
              id: generateId(),
              severity: "medium",
              category: "rls",
              title: `RLS not enabled on "${row.tablename}"`,
              description: `Row Level Security is not enabled on the "${row.tablename}" table. The Data API may expose all rows to authenticated users according to database privileges.`,
              tableName: row.tablename,
              columnName: null,
              resolution: `Enable RLS: ALTER TABLE "${row.tablename}" ENABLE ROW LEVEL SECURITY;`,
              autoResolvable: true,
            });
          }
        }

        // Check 2: Tables with no RLS policies
        if (rlsResult.rows.length > 0) {
          const tablesWithPolicies = await client.query(`
            SELECT DISTINCT tablename FROM pg_policies
            WHERE schemaname = 'public'
          `);
          const policyTableSet = new Set(tablesWithPolicies.rows.map((r: any) => r.tablename));

          for (const row of rlsResult.rows) {
            if (row.relrowsecurity && !policyTableSet.has(row.tablename)) {
              findings.push({
                id: generateId(),
                severity: "high",
                category: "rls",
                title: `RLS enabled but no policies on "${row.tablename}"`,
                description: `Row Level Security is enabled on "${row.tablename}" but no policies exist. All queries will return zero rows.`,
                tableName: row.tablename,
                columnName: null,
                resolution: `Add RLS policies to "${row.tablename}" to control access.`,
                autoResolvable: false,
              });
            }
          }
        }

        // Check 3: Potentially sensitive columns without protection
        const columnsResult = await client.query(`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND (column_name ILIKE '%password%'
              OR column_name ILIKE '%secret%'
              OR column_name ILIKE '%token%'
              OR column_name ILIKE '%credit%'
              OR column_name ILIKE '%ssn%'
              OR column_name ILIKE '%social_security%')
        `);

        for (const col of columnsResult.rows) {
          findings.push({
            id: generateId(),
            severity: "critical",
            category: "exposure",
            title: `Sensitive column "${col.column_name}" exposed`,
            description: `The column "${col.table_name}"."${col.column_name}" (${col.data_type}) may contain sensitive data and could be exposed through the Data API.`,
            tableName: col.table_name,
            columnName: col.column_name,
            resolution: `Ensure RLS policies restrict access to "${col.column_name}" or apply data masking.`,
            autoResolvable: false,
          });
        }

        // Check 4: Public schema access
        const dataApiConfig = db
          .select()
          .from(schema.dataApiConfigs)
          .where(
            and(
              eq(schema.dataApiConfigs.projectId, projectId),
              eq(schema.dataApiConfigs.branchId, branchId),
              eq(schema.dataApiConfigs.databaseName, databaseName)
            )
          )
          .get();

        if (dataApiConfig?.anonymousAccess) {
          findings.push({
            id: generateId(),
            severity: "critical",
            category: "auth",
            title: "Anonymous access is enabled",
            description: "Anonymous access allows unauthenticated requests to query your database. This may expose sensitive data without any authentication.",
            tableName: null,
            columnName: null,
            resolution: "Disable anonymous access in the Data API configuration and require JWT authentication.",
            autoResolvable: true,
          });
        }

        // Check 5: Excessive permissions on public schema
        const grantResult = await client.query(`
          SELECT grantee, table_name, privilege_type
          FROM information_schema.role_table_grants
          WHERE table_schema = 'public'
            AND grantee IN ('anon', 'public', 'authenticated')
        `);

        if (grantResult.rows.length > 0) {
          findings.push({
            id: generateId(),
            severity: "high",
            category: "permissions",
            title: "Excessive grants on public schema",
            description: `Found ${grantResult.rows.length} grant(s) to public/authenticated roles on the public schema. Review these grants to ensure they are intentional.`,
            tableName: null,
            columnName: null,
            resolution: "Review and revoke unnecessary grants: REVOKE ... ON ... FROM ...",
            autoResolvable: false,
          });
        }

        // Check 6: Foreign keys without indexes
        const fkResult = await client.query(`
          SELECT
            tc.table_name,
            kcu.column_name,
            tc.constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        `);

        for (const fk of fkResult.rows) {
          const indexCheck = await client.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = $1 AND indexdef LIKE '%' || $2 || '%'
          `, [fk.table_name, fk.column_name]);

          if (indexCheck.rows.length === 0) {
            findings.push({
              id: generateId(),
              severity: "low",
              category: "schema",
              title: `Missing index on foreign key "${fk.column_name}"`,
              description: `The foreign key column "${fk.table_name}"."${fk.column_name}" does not have an index. This may impact query performance.`,
              tableName: fk.table_name,
              columnName: fk.column_name,
              resolution: `CREATE INDEX idx_${fk.table_name}_${fk.column_name} ON "${fk.table_name}" ("${fk.column_name}");`,
              autoResolvable: true,
            });
          }
        }

        // Check 7: Views that might expose sensitive data
        const viewsResult = await client.query(`
          SELECT viewname, definition
          FROM pg_views
          WHERE schemaname = 'public'
        `);

        for (const view of viewsResult.rows) {
          const viewColumns = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = 'public'
          `, [view.viewname]);

          for (const col of viewColumns.rows) {
            if (/password|secret|token|key|credential/i.test((col as any).column_name)) {
              findings.push({
                id: generateId(),
                severity: "high",
                category: "exposure",
                title: `View "${view.viewname}" exposes sensitive column`,
                description: `The view "${view.viewname}" contains a column "${(col as any).column_name}" that may expose sensitive data.`,
                tableName: view.viewname,
                columnName: (col as any).column_name,
                resolution: `Review the view definition and ensure appropriate access controls.`,
                autoResolvable: false,
              });
            }
          }
        }

      } finally {
        await client.end().catch(() => {});
      }
    } catch (err: unknown) {
      // PostgreSQL unreachable — still generate informational findings
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("ECONNREFUSED") || message.includes("timeout")) {
        findings.push({
          id: generateId(),
          severity: "info",
          category: "connection",
          title: "PostgreSQL is unreachable",
          description: "Cannot connect to PostgreSQL to perform security analysis. Start the database server and try again.",
          tableName: null,
          columnName: null,
          resolution: "Start the PostgreSQL server: neon_local endpoint start",
          autoResolvable: false,
        });
      }
    }

    // Count by severity
    const summary = {
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      info: findings.filter((f) => f.severity === "info").length,
      total: findings.length,
    };

    return NextResponse.json({ findings, summary, scannedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
