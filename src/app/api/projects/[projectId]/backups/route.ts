import { NextRequest, NextResponse } from "next/server";
import { getBackupService } from "@/lib/backup/backup-service";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyBackupCompleted, notifyBackupFailed } from "@/lib/notification-service";

// GET /api/projects/:projectId/backups — list all backups
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const service = getBackupService();
    const backups = service.listBackups(projectId);
    return NextResponse.json({ backups });
  } catch (err: any) {
    console.error("[API] GET /api/projects/:projectId/backups:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch backups" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:projectId/backups — create a new backup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();
  try {
    const service = getBackupService();

    const result = await service.createBackup({
      name: body.name || `Backup ${new Date().toISOString()}`,
      projectId,
      branchId: body.branchId,
      databaseName: body.databaseName || "neondb",
      type: body.type || "full",
      format: body.format || "custom",
      scope: body.scope || "database",
    });

    // Create notification
    try {
      const user = await getCurrentUser();
      if (user) {
        const db = getDb();
        const cookie = request.headers.get("cookie") || "";
        const orgMatch = cookie.match(/active_org=([^;]+)/);
        const orgId = orgMatch?.[1] || undefined;
        const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
        notifyBackupCompleted(user.id, orgId, result.name || body.name, project?.name);
      }
    } catch {}

    return NextResponse.json({ backup: result }, { status: 201 });
  } catch (err: any) {
    console.error("[API] POST /api/projects/:projectId/backups:", err);
    try {
      const user = await getCurrentUser();
      if (user) {
        const db = getDb();
        const cookie = request.headers.get("cookie") || "";
        const orgMatch = cookie.match(/active_org=([^;]+)/);
        const orgId = orgMatch?.[1] || undefined;
        notifyBackupFailed(user.id, orgId, body.name || "unknown", err.message);
      }
    } catch {}
    return NextResponse.json(
      { error: err.message || "Failed to create backup" },
      { status: 500 }
    );
  }
}
