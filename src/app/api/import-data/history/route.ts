import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getImportHistory } from "@/lib/import-service";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/import-data/history
 * Get import job history for the current organisation.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const orgMembership = db
      .select()
      .from(schema.orgMemberships)
      .where(eq(schema.orgMemberships.userId, user.id))
      .all();
    const organizationId = orgMembership[0]?.organizationId;

    const jobs = getImportHistory(organizationId);

    // Strip sensitive connection data
    const safeJobs = jobs.map((job) => ({
      id: job.id,
      organizationId: job.organizationId,
      projectId: job.projectId,
      branchId: job.branchId,
      databaseName: job.databaseName,
      sourceHost: job.sourceHost,
      sourceDatabase: job.sourceDatabase,
      status: job.status,
      importMode: job.importMode,
      conflictStrategy: job.conflictStrategy,
      tablesTotal: job.tablesTotal,
      tablesCompleted: job.tablesCompleted,
      rowsImported: job.rowsImported,
      totalEstimatedRows: job.totalEstimatedRows,
      errorSummary: job.errorSummary,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
    }));

    return NextResponse.json({
      success: true,
      jobs: safeJobs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch import history" },
      { status: 500 }
    );
  }
}
