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
    query_timeout: 10000,
    ssl: false,
  });
}

// -----------------------------------------------------------------------
// GET /api/data/databases?projectId=xxx&branchId=xxx
// -----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || "";
    const branchId = request.nextUrl.searchParams.get("branchId") || "";

    if (!projectId || !branchId) {
      return NextResponse.json(
        { error: "projectId and branchId are required" },
        { status: 400 }
      );
    }

    const conn = resolvePostgresConnection(projectId, branchId);
    const client = createPgClient({ ...conn, database: "postgres" });

    try {
      await client.connect();
      const result = await client.query(
        `SELECT datname FROM pg_database 
         WHERE datistemplate = false 
         AND datname NOT IN ('postgres')
         ORDER BY datname`
      );
      const databases = result.rows.map((r) => r.datname as string);

      // Always include 'postgres' at the beginning
      return NextResponse.json({
        databases: ["postgres", ...databases.filter((d) => d !== "postgres")],
      });
    } finally {
      await client.end().catch(() => {});
    }
  } catch (err: any) {
    console.error("[API] GET /api/data/databases:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch databases" },
      { status: 500 }
    );
  }
}
