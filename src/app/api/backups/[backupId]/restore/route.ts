import { NextRequest, NextResponse } from "next/server";
import { getRestoreService } from "@/lib/backup/restore-service";

// POST /api/backups/:backupId/restore — restore a backup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const { backupId } = await params;
    const body = await request.json();
    const service = getRestoreService();

    const result = await service.restoreBackup({
      backupId,
      targetProjectId: body.targetProjectId,
      targetBranchId: body.targetBranchId,
      targetDatabaseName: body.targetDatabaseName,
      safetyBackup: body.safetyBackup !== false, // Default to true
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      targetDatabase: result.targetDatabase,
    });
  } catch (err: any) {
    console.error("[API] POST /api/backups/:backupId/restore:", err);
    return NextResponse.json(
      { error: err.message || "Failed to restore backup" },
      { status: 500 }
    );
  }
}
