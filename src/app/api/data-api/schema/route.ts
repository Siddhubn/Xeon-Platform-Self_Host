import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

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

// GET /api/data-api/schema?projectId=X&branchId=Y&databaseName=Z
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

    const { introspectSchema } = await import("@/lib/data-api/schema-introspector");
    const conn = resolvePostgresConnection(projectId, branchId);

    try {
      const fullSchema = await introspectSchema({ ...conn, database: databaseName });
      return NextResponse.json(fullSchema);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // If PostgreSQL is unreachable, return empty schema
      if (message.includes("ECONNREFUSED") || message.includes("timeout") || message.includes("fetch failed")) {
        return NextResponse.json({
          tables: [],
          columns: [],
          foreignKeys: [],
          primaryKeys: [],
          functions: [],
          rlsPolicies: [],
          rlsEnabled: {},
          refreshedAt: new Date().toISOString(),
          warning: "PostgreSQL is unreachable. Schema introspection requires a running database.",
        });
      }
      throw err;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
