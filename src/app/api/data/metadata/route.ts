import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import pg from "pg";

// -----------------------------------------------------------------------
// Connection resolver (same as self-hosted-neon-provider)
// -----------------------------------------------------------------------

function resolvePostgresConnection(
  projectId: string,
  branchId: string
): { host: string; port: number; database: string } {
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
    database: compute?.database || process.env.POSTGRES_DATABASE || "neondb",
  };
}

function createPgClient(opts: {
  host: string;
  port: number;
  database: string;
}): pg.Client {
  return new pg.Client({
    host: opts.host,
    port: opts.port,
    database: opts.database,
    user: process.env.POSTGRES_USER || "cloud_admin",
    password: process.env.POSTGRES_PASSWORD || "helloworld",
    connectionTimeoutMillis: 5000,
    query_timeout: 15000,
    ssl: false,
  });
}

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  ordinalPosition: number;
}

interface ForeignKeyInfo {
  columnName: string;
  foreignTableSchema: string;
  foreignTable: string;
  foreignColumn: string;
}

interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
}

interface TableInfo {
  schema: string;
  name: string;
  type: "table" | "view";
  rowCount: number | null;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

interface SchemaInfo {
  name: string;
  tables: TableInfo[];
}

interface DatabaseMetadata {
  schemas: SchemaInfo[];
  databaseName: string;
}

// -----------------------------------------------------------------------
// GET /api/data/metadata?projectId=xxx&branchId=xxx&databaseName=xxx
// -----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || "";
    const branchId = request.nextUrl.searchParams.get("branchId") || "";
    const databaseName =
      request.nextUrl.searchParams.get("databaseName") || "neondb";

    if (!projectId || !branchId) {
      return NextResponse.json(
        { error: "projectId and branchId are required" },
        { status: 400 }
      );
    }

    const conn = resolvePostgresConnection(projectId, branchId);
    const client = createPgClient({ ...conn, database: databaseName });

    try {
      await client.connect();

      // Fetch schemas (exclude system schemas)
      const schemasResult = await client.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
      `);

      const schemas: SchemaInfo[] = [];

      for (const row of schemasResult.rows) {
        const schemaName = row.schema_name as string;

        // Fetch tables and views
        const tablesResult = await client.query(
          `SELECT table_name, table_type
           FROM information_schema.tables
           WHERE table_schema = $1
           ORDER BY table_name`,
          [schemaName]
        );

        const tables: TableInfo[] = [];

        for (const tableRow of tablesResult.rows) {
          const tableName = tableRow.table_name as string;
          const tableType =
            tableRow.table_type === "VIEW" ? "view" : "table";

          // Fetch columns
          const columnsResult = await client.query(
            `SELECT 
               c.column_name,
               c.data_type,
               c.udt_name,
               c.is_nullable,
               c.column_default,
               c.ordinal_position,
               CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
             FROM information_schema.columns c
             LEFT JOIN (
               SELECT ku.column_name
               FROM information_schema.table_constraints tc
               JOIN information_schema.key_column_usage ku
                 ON tc.constraint_name = ku.constraint_name
                 AND tc.table_schema = ku.table_schema
               WHERE tc.table_schema = $1
                 AND tc.table_name = $2
                 AND tc.constraint_type = 'PRIMARY KEY'
             ) pk ON c.column_name = pk.column_name
             WHERE c.table_schema = $1 AND c.table_name = $2
             ORDER BY c.ordinal_position`,
            [schemaName, tableName]
          );

          // Detect auto-increment (serial types or identity columns)
          const identityResult = await client.query(
            `SELECT column_name, identity_generation
             FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = $2
               AND (column_default LIKE 'nextval%' OR identity_generation IS NOT NULL)`,
            [schemaName, tableName]
          );
          const autoIncrementCols = new Set(
            identityResult.rows.map((r) => r.column_name as string)
          );

          const columns: ColumnInfo[] = columnsResult.rows.map((col) => ({
            name: col.column_name as string,
            type: (col.udt_name as string) || (col.data_type as string),
            nullable: col.is_nullable === "YES",
            defaultValue: col.column_default as string | null,
            isPrimaryKey: col.is_pk as boolean,
            isAutoIncrement: autoIncrementCols.has(col.column_name as string),
            ordinalPosition: col.ordinal_position as number,
          }));

          // Fetch foreign keys
          const fkResult = await client.query(
            `SELECT 
               kcu.column_name,
               ccu.table_schema AS foreign_table_schema,
               ccu.table_name AS foreign_table,
               ccu.column_name AS foreign_column
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu
               ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
             JOIN information_schema.constraint_column_usage ccu
               ON ccu.constraint_name = tc.constraint_name
               AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
               AND tc.table_schema = $1
               AND tc.table_name = $2`,
            [schemaName, tableName]
          );

          const foreignKeys: ForeignKeyInfo[] = fkResult.rows.map((fk) => ({
            columnName: fk.column_name as string,
            foreignTableSchema: fk.foreign_table_schema as string,
            foreignTable: fk.foreign_table as string,
            foreignColumn: fk.foreign_column as string,
          }));

          // Fetch indexes
          const indexResult = await client.query(
            `SELECT
               i.relname AS index_name,
               ix.indisunique AS is_unique,
               array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
             FROM pg_class t
             JOIN pg_namespace n ON n.oid = t.relnamespace
             JOIN pg_index ix ON ix.indrelid = t.oid
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
             WHERE n.nspname = $1 AND t.relname = $2
             GROUP BY i.relname, ix.indisunique
             ORDER BY i.relname`,
            [schemaName, tableName]
          );

          const indexes: IndexInfo[] = indexResult.rows.map((idx) => ({
            name: idx.index_name as string,
            columns: idx.columns as string[],
            isUnique: idx.is_unique as boolean,
          }));

          // Estimate row count
          let rowCount: number | null = null;
          try {
            const countResult = await client.query(
              `SELECT reltuples::bigint AS estimate
               FROM pg_class
               WHERE oid = ($1::text)::regclass`,
              [`${schemaName}.${tableName}`]
            );
            if (countResult.rows[0]) {
              rowCount = Number(countResult.rows[0].estimate);
            }
          } catch {
            // ignore - regclass cast may fail for views
          }

          tables.push({
            schema: schemaName,
            name: tableName,
            type: tableType,
            rowCount,
            columns,
            foreignKeys,
            indexes,
          });
        }

        schemas.push({ name: schemaName, tables });
      }

      return NextResponse.json({
        schemas,
        databaseName,
      } satisfies DatabaseMetadata);
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err: any) {
    console.error("[API] GET /api/data/metadata:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch database metadata" },
      { status: 500 }
    );
  }
}
