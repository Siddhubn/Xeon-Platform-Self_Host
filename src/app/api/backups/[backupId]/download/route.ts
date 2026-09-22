import { NextRequest, NextResponse } from "next/server";
import { getBackupService } from "@/lib/backup/backup-service";

// GET /api/backups/:backupId/download — download backup file
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const { backupId } = await params;
    const service = getBackupService();
    const result = service.getBackupStream(backupId);

    if (!result) {
      return NextResponse.json(
        { error: "Backup file not found" },
        { status: 404 }
      );
    }

    // Stream the file to the client
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const fileBuffer = Buffer.concat(chunks);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("[API] GET /api/backups/:backupId/download:", err);
    return NextResponse.json(
      { error: err.message || "Failed to download backup" },
      { status: 500 }
    );
  }
}
