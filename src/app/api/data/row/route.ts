import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import pg from "pg";

// -----------------------------------------------------------------------
// Connection resolver
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
    query_timeout: 15000,
    ssl: false,
  });
}

// -----------------------------------------------------------------------
// POST /api/data/row — Insert a new row
// -----------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, branchId, databaseName, schema: tableSchema, table, data } = body;

    if (!projectId || !branchId || !table || !data) {
      return NextResponse.json(
        { error: "projectId, branchId, table, and data are required" },
        { status: 400 }
      );
    }

    const conn = resolvePostgresConnection(projectId, branchId);
    const client = createPgClient({ ...conn, database: databaseName || "neondb" });

    try {
      await client.connect();

      const columns = Object.keys(data);
      const values = Object.values(data);
      const quotedColumns = columns.map((c) => `"${c.replace(/"/g, '""')}"`);
      const placeholders = values.map((_, i) => `$${i + 1}`);

      const query = `INSERT INTO "${(tableSchema || "public").replace(/"/g, '""')}"."${table.replace(/"/g, '""')}" (${quotedColumns.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`;
      const result = await client.query(query, values);

      return NextResponse.json({
        row: result.rows[0],
        success: true,
      });
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err: any) {
    console.error("[API] POST /api/data/row:", err);
    return NextResponse.json(
      { error: err.message || "Failed to insert row" },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------
// PUT /api/data/row — Update a row by primary key
// -----------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      branchId,
      databaseName,
      schema: tableSchema,
      table,
      primaryKey,
      data,
    } = body;

    console.log("[API] PUT /api/data/row - primaryKey:", primaryKey, "data:", data);

    if (!projectId || !branchId || !table || !primaryKey || !data) {
      return NextResponse.json(
        { error: "projectId, branchId, table, primaryKey, and data are required" },
        { status: 400 }
      );
    }

    const conn = resolvePostgresConnection(projectId, branchId);
    const client = createPgClient({ ...conn, database: databaseName || "neondb" });

    try {
      await client.connect();

      // Build SET clause
      const setClauses: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      for (const [col, val] of Object.entries(data)) {
        setClauses.push(`"${col.replace(/"/g, '""')}" = $${paramIndex}`);
        // Convert string numbers to actual numbers
        const numVal = Number(val);
        params.push(!isNaN(numVal) && val !== "" ? numVal : val);
        paramIndex++;
      }

      if (setClauses.length === 0) {
        return NextResponse.json(
          { error: "No columns to update" },
          { status: 400 }
        );
      }

      // Build WHERE clause from primary key
      const whereClauses: string[] = [];
      for (const [col, val] of Object.entries(primaryKey)) {
        if (val === undefined || val === null) continue;
        whereClauses.push(`"${col.replace(/"/g, '""')}" = $${paramIndex}`);
        // Convert string numbers to actual numbers for proper comparison
        const numVal = Number(val);
        params.push(!isNaN(numVal) && val !== "" ? numVal : val);
        paramIndex++;
      }

      if (whereClauses.length === 0) {
        return NextResponse.json(
          { error: "No valid primary key columns found. The table may not have a primary key defined." },
          { status: 400 }
        );
      }

      const query = `UPDATE "${(tableSchema || "public").replace(/"/g, '""')}"."${table.replace(/"/g, '""')}" SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")} RETURNING *`;
      console.log("[API] PUT query:", query, "params:", params);
      const result = await client.query(query, params);
      console.log("[API] PUT result.rowCount:", result.rowCount);

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: "Row not found (primary key may have changed). Query: " + query + " Params: " + JSON.stringify(params) },
          { status: 404 }
        );
      }

      return NextResponse.json({
        row: result.rows[0],
        success: true,
      });
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err: any) {
    console.error("[API] PUT /api/data/row:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update row" },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------
// DELETE /api/data/row — Delete a row by primary key
// -----------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      branchId,
      databaseName,
      schema: tableSchema,
      table,
      primaryKey,
    } = body;

    if (!projectId || !branchId || !table || !primaryKey) {
      return NextResponse.json(
        { error: "projectId, branchId, table, and primaryKey are required" },
        { status: 400 }
      );
    }

    const conn = resolvePostgresConnection(projectId, branchId);
    const client = createPgClient({ ...conn, database: databaseName || "neondb" });

    try {
      await client.connect();

      // Build WHERE clause from primary key
      const whereClauses: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      for (const [col, val] of Object.entries(primaryKey)) {
        whereClauses.push(`"${col.replace(/"/g, '""')}" = $${paramIndex}`);
        params.push(val);
        paramIndex++;
      }

      const query = `DELETE FROM "${(tableSchema || "public").replace(/"/g, '""')}"."${table.replace(/"/g, '""')}" WHERE ${whereClauses.join(" AND ")}`;
      const result = await client.query(query, params);

      return NextResponse.json({
        success: true,
        deletedCount: result.rowCount,
      });
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err: any) {
    console.error("[API] DELETE /api/data/row:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete row" },
      { status: 500 }
    );
  }
}
