import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import { ReadReplicaService } from "@/lib/read-replica-service";

function getActiveOrgId(request: NextRequest, db: ReturnType<typeof getDb>): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/active_org=([^;]+)/);
  if (match) return match[1];
  return null;
}

// DELETE /api/replicas/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const replica = ReadReplicaService.get(id);
    if (!replica) {
      return NextResponse.json({ error: "Replica not found" }, { status: 404 });
    }

    await ReadReplicaService.delete(id);

    // Create notification
    try {
      const db = getDb();
      const activeOrgId = getActiveOrgId(request, db);
      const { notifyReplicaDeleted } = await import("@/lib/notification-service");
      notifyReplicaDeleted(user.id, activeOrgId || undefined, replica.displayName);
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
