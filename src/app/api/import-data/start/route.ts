import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import {
  createImportJob,
  executeImport,
  parseConnectionString,
} from "@/lib/import-service";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyImportStarted } from "@/lib/notification-service";

/**
 * POST /api/import-data/start
 * Start a data import operation.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      connectionString,
      projectId,
      branchId,
      databaseName,
      tablesSelected,
      conflictStrategy,
      importMode,
      totalEstimatedRows,
    } = body;

    if (!connectionString || !projectId || !branchId || !databaseName) {
      return NextResponse.json(
        { error: "Connection string, projectId, branchId, and databaseName are required" },
        { status: 400 }
      );
    }

    // Validate connection string parses
    const parsed = parseConnectionString(connectionString);

    // Resolve active organisation
    const db = getDb();
    const orgMembership = db
      .select()
      .from(schema.orgMemberships)
      .where(eq(schema.orgMemberships.userId, user.id))
      .all();
    const organizationId = orgMembership[0]?.organizationId || undefined;

    // Verify destination exists
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

    // Create import job
    const job = createImportJob({
      organizationId,
      projectId,
      branchId,
      databaseName,
      sourceConnectionString: connectionString,
      importMode: importMode || "data_only",
      conflictStrategy: conflictStrategy || "fail",
      tablesSelected: tablesSelected || [],
      totalEstimatedRows,
      createdBy: user.id,
    });

    // Send started notification
    notifyImportStarted(user.id, organizationId || undefined, databaseName);

    // Execute import in background (non-blocking)
    // We use setImmediate to not block the response
    const jobId = job.id;
    setImmediate(() => {
      executeImport(jobId).catch((err) => {
        console.error(`Import job ${jobId} failed:`, err);
      });
    });

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: "pending",
        sourceHost: parsed.host,
        sourceDatabase: parsed.database,
        databaseName: job.databaseName,
        tablesTotal: job.tablesTotal,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to start import" },
      { status: 500 }
    );
  }
}
