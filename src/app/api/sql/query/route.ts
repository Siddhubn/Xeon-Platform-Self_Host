import { NextRequest, NextResponse } from "next/server";
import { getProvider, createOperation, completeOperation } from "@/lib/providers/self-hosted-neon-provider";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { randomBytes } from "crypto";

// POST /api/sql/query — execute a SQL query
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, branchId, database, role, sql } = body;

    if (!sql || !projectId || !branchId) {
      return NextResponse.json(
        { error: "projectId, branchId, and sql are required" },
        { status: 400 }
      );
    }

    const provider = getProvider();
    const result = await provider.sql.execute({
      projectId,
      branchId,
      database: database || "neondb",
      role: role || "neondb_owner",
      sql,
    });

    // Log to query history
    try {
      const db = getDb();
      db.insert(schema.queryHistory).values({
        id: randomBytes(8).toString("hex"),
        projectId,
        branchId,
        database: database || "neondb",
        role: role || "neondb_owner",
        sql,
        executionTimeMs: result.executionTimeMs,
        rowCount: result.rowCount,
        error: result.error || null,
      }).run();
    } catch {
      // Don't fail the query if history logging fails
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API] POST /api/sql/query:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute query" },
      { status: 500 }
    );
  }
}
