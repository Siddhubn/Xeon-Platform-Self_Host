import { NextRequest, NextResponse } from "next/server";
import { getBackupService } from "@/lib/backup/backup-service";

// GET /api/backups/:backupId — get backup details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const { backupId } = await params;
    const service = getBackupService();
    const backup = service.getBackup(backupId);

    if (!backup) {
      return NextResponse.json({ error: "Backup not found" }, { status: 404 });
    }

    return NextResponse.json({ backup });
  } catch (err: any) {
    console.error("[API] GET /api/backups/:backupId:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch backup" },
      { status: 500 }
    );
  }
}

// DELETE /api/backups/:backupId — delete a backup
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const { backupId } = await params;
    const service = getBackupService();
    const result = await service.deleteBackup(backupId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API] DELETE /api/backups/:backupId:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete backup" },
      { status: 500 }
    );
  }
}
