import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import {
  introspectSourceSchema,
  introspectDestinationSchema,
  compareSchemas,
  parseConnectionString,
} from "@/lib/import-service";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/import-data/compare-schema
 * Compare source and destination schemas for compatibility.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { connectionString, projectId, branchId, databaseName } = body;

    if (!connectionString || !projectId || !branchId || !databaseName) {
      return NextResponse.json(
        { error: "Connection string, projectId, branchId, and databaseName are required" },
        { status: 400 }
      );
    }

    // Resolve destination compute
    const db = getDb();
    const compute = db
      .select()
      .from(schema.computes)
      .where(
        and(
          eq(schema.computes.projectId, projectId),
          eq(schema.computes.branchId, branchId)
        )
      )
      .get();

    if (!compute) {
      return NextResponse.json(
        { error: "Destination compute not found" },
        { status: 404 }
      );
    }

    // Introspect both schemas
    const [sourceSchema, destSchema] = await Promise.all([
      introspectSourceSchema(connectionString),
      introspectDestinationSchema(
        compute.host || "localhost",
        compute.port || 5432,
        databaseName,
        compute.role || "neondb_owner",
        "" // Internal connection
      ),
    ]);

    // Compare schemas
    const comparison = compareSchemas(sourceSchema, destSchema);

    return NextResponse.json({
      success: true,
      comparison,
      source: {
        totalTables: sourceSchema.totalTables,
        totalEstimatedRows: sourceSchema.totalEstimatedRows,
      },
      destination: {
        totalTables: destSchema.totalTables,
        totalEstimatedRows: destSchema.totalEstimatedRows,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to compare schemas" },
      { status: 500 }
    );
  }
}
