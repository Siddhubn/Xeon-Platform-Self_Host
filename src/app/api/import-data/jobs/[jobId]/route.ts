import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getImportJob, getImportJobResults } from "@/lib/import-service";

/**
 * GET /api/import-data/jobs/:jobId
 * Get import job details and table results.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const job = getImportJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Import job not found" }, { status: 404 });
    }

    const tableResults = getImportJobResults(jobId);

    // Strip sensitive data
    const safeJob = {
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
      tablesSelected: job.tablesSelected,
      tablesTotal: job.tablesTotal,
      tablesCompleted: job.tablesCompleted,
      rowsImported: job.rowsImported,
      totalEstimatedRows: job.totalEstimatedRows,
      errorSummary: job.errorSummary,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdBy: job.createdBy,
      createdAt: job.createdAt,
    };

    return NextResponse.json({
      success: true,
      job: safeJob,
      tableResults: tableResults.map((r) => ({
        id: r.id,
        schemaName: r.schemaName,
        tableName: r.tableName,
        sourceRowCount: r.sourceRowCount,
        importedRowCount: r.importedRowCount,
        status: r.status,
        errorMessage: r.errorMessage,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch job details" },
      { status: 500 }
    );
  }
}
