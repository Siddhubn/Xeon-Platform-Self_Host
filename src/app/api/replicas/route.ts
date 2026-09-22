import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ReadReplicaService } from "@/lib/read-replica-service";
import { eq, and, isNull } from "drizzle-orm";

function getActiveOrgId(request: NextRequest, db: ReturnType<typeof getDb>): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/active_org=([^;]+)/);
  if (match) return match[1];
  return null;
}

// GET /api/replicas?projectId=X — list replicas for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const replicas = ReadReplicaService.list(projectId);
    return NextResponse.json({ replicas });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/replicas — create a read replica
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, branchId, displayName, location } = body;

    if (!projectId || !branchId || !displayName) {
      return NextResponse.json(
        { error: "projectId, branchId, and displayName are required" },
        { status: 400 }
      );
    }

    // Validate display name
    if (displayName.length < 2 || displayName.length > 64) {
      return NextResponse.json(
        { error: "Display name must be between 2 and 64 characters" },
        { status: 400 }
      );
    }

    const db = getDb();
    const activeOrgId = getActiveOrgId(request, db);

    const replica = await ReadReplicaService.create({
      projectId,
      branchId,
      displayName,
      location,
      organizationId: activeOrgId || undefined,
      createdBy: user.id,
    });

    // Create notification
    try {
      const { notifyReplicaCreated } = await import("@/lib/notification-service");
      notifyReplicaCreated(user.id, activeOrgId || undefined, displayName);
    } catch {}

    return NextResponse.json({ replica }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
