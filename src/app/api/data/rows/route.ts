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
): { host: string; port: number } {
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
    query_timeout: 30000,
    ssl: false,
  });
}

// -----------------------------------------------------------------------
// GET /api/data/rows?projectId=xxx&branchId=xxx&databaseName=xxx&schema=xxx&table=xxx&offset=0&limit=50&sortColumn=xxx&sortDirection=asc&filterColumn=xxx&filterOperator=eq&filterValue=xxx
// -----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || "";
    const branchId = request.nextUrl.searchParams.get("branchId") || "";
    const databaseName =
      request.nextUrl.searchParams.get("databaseName") || "neondb";
    const tableSchema =
      request.nextUrl.searchParams.get("schema") || "public";
    const tableName = request.nextUrl.searchParams.get("table") || "";
    const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    const sortColumn = request.nextUrl.searchParams.get("sortColumn");
    const sortDirection =
      request.nextUrl.searchParams.get("sortDirection") || "asc";
    const filterColumn = request.nextUrl.searchParams.get("filterColumn");
    const filterOperator =
      request.nextUrl.searchParams.get("filterOperator") || "contains";
    const filterValue = request.nextUrl.searchParams.get("filterValue");

    if (!projectId || !branchId || !tableName) {
      return NextResponse.json(
        { error: "projectId, branchId, and table are required" },
        { status: 400 }
      );
    }

    const conn = resolvePostgresConnection(projectId, branchId);
    const client = createPgClient({ ...conn, database: databaseName });

    try {
      await client.connect();

      // Build the query with identifier quoting
      const quotedSchema = `"${tableSchema.replace(/"/g, '""')}"`;
      const quotedTable = `"${tableName.replace(/"/g, '""')}"`;

      // Build WHERE clause
      let whereClause = "";
      const params: unknown[] = [];
      let paramIndex = 1;

      if (filterColumn && filterValue !== null && filterValue !== undefined && filterValue !== "") {
        const quotedFilterCol = `"${filterColumn.replace(/"/g, '""')}"`;
        switch (filterOperator) {
          case "eq":
            whereClause = `WHERE ${quotedFilterCol} = $${paramIndex}`;
            params.push(filterValue);
            paramIndex++;
            break;
          case "neq":
            whereClause = `WHERE ${quotedFilterCol} != $${paramIndex}`;
            params.push(filterValue);
            paramIndex++;
            break;
          case "gt":
            whereClause = `WHERE ${quotedFilterCol} > $${paramIndex}`;
            params.push(filterValue);
            paramIndex++;
            break;
          case "gte":
            whereClause = `WHERE ${quotedFilterCol} >= $${paramIndex}`;
            params.push(filterValue);
            paramIndex++;
            break;
          case "lt":
            whereClause = `WHERE ${quotedFilterCol} < $${paramIndex}`;
            params.push(filterValue);
            paramIndex++;
            break;
          case "lte":
            whereClause = `WHERE ${quotedFilterCol} <= $${paramIndex}`;
            params.push(filterValue);
            paramIndex++;
            break;
          case "contains":
            whereClause = `WHERE ${quotedFilterCol}::text ILIKE $${paramIndex}`;
            params.push(`%${filterValue}%`);
            paramIndex++;
            break;
          case "startsWith":
            whereClause = `WHERE ${quotedFilterCol}::text ILIKE $${paramIndex}`;
            params.push(`${filterValue}%`);
            paramIndex++;
            break;
          case "endsWith":
            whereClause = `WHERE ${quotedFilterCol}::text ILIKE $${paramIndex}`;
            params.push(`%${filterValue}`);
            paramIndex++;
            break;
          case "isNull":
            whereClause = `WHERE ${quotedFilterCol} IS NULL`;
            break;
          case "isNotNull":
            whereClause = `WHERE ${quotedFilterCol} IS NOT NULL`;
            break;
          case "isEmpty":
            whereClause = `WHERE ${quotedFilterCol}::text = ''`;
            break;
          case "isNotEmpty":
            whereClause = `WHERE ${quotedFilterCol}::text != ''`;
            break;
          default:
            whereClause = `WHERE ${quotedFilterCol}::text ILIKE $${paramIndex}`;
            params.push(`%${filterValue}%`);
            paramIndex++;
        }
      }

      // Build ORDER BY clause
      let orderClause = "";
      if (sortColumn) {
        const quotedSortCol = `"${sortColumn.replace(/"/g, '""')}"`;
        const direction = sortDirection.toLowerCase() === "desc" ? "DESC" : "ASC";
        orderClause = `ORDER BY ${quotedSortCol} ${direction} NULLS LAST`;
      } else {
        orderClause = `ORDER BY 1`;
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM ${quotedSchema}.${quotedTable} ${whereClause}`;
      const countResult = await client.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0]?.count || "0");

      // Get rows
      const dataQuery = `SELECT * FROM ${quotedSchema}.${quotedTable} ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`;
      const dataResult = await client.query(dataQuery, params);

      // Get column info for the table
      const columnsResult = await client.query(
        `SELECT column_name, data_type, udt_name, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [tableSchema, tableName]
      );

      const columns = columnsResult.rows.map((col) => ({
        name: col.column_name as string,
        type: (col.udt_name as string) || (col.data_type as string),
        nullable: col.is_nullable === "YES",
        defaultValue: col.column_default as string | null,
      }));

      // Get primary key columns
      const pkResult = await client.query(
        `SELECT ku.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage ku
           ON tc.constraint_name = ku.constraint_name
           AND tc.table_schema = ku.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = $1
           AND tc.table_name = $2`,
        [tableSchema, tableName]
      );
      const primaryKeys = pkResult.rows.map((r) => r.column_name as string);

      return NextResponse.json({
        rows: dataResult.rows,
        columns,
        primaryKeys,
        totalCount,
        offset,
        limit,
      });
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err: any) {
    console.error("[API] GET /api/data/rows:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch rows" },
      { status: 500 }
    );
  }
}
