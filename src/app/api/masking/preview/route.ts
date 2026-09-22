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

// POST /api/masking/preview
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, branchId, databaseName, schemaName, tableName, columnName, ruleType, configuration, customExpression } = body;

    if (!projectId || !branchId || !tableName || !columnName || !ruleType) {
      return NextResponse.json(
        { error: "projectId, branchId, tableName, columnName, and ruleType are required" },
        { status: 400 }
      );
    }

    const conn = resolvePostgresConnection(projectId, branchId);
    const { previewMasking } = await import("@/lib/data-masking/masking-engine");

    const preview = await previewMasking(
      { ...conn, database: databaseName || conn.database },
      { ruleType, configuration, customExpression },
      schemaName || "public",
      tableName,
      columnName,
      5
    );

    return NextResponse.json({ preview });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
