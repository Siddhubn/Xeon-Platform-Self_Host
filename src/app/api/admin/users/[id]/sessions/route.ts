import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

function getSessionUserId(request: NextRequest): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/neon_session=([^;]+)/);
  if (!match) return null;
  try {
    const session = JSON.parse(decodeURIComponent(match[1]));
    return session.id || null;
  } catch {
    return null;
  }
}

function getActiveOrgId(request: NextRequest, db: ReturnType<typeof getDb>): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/active_org=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  const userId = getSessionUserId(request);
  if (!userId) return null;
  const firstMembership = db
    .select()
    .from(schema.orgMemberships)
    .where(eq(schema.orgMemberships.userId, userId))
    .get();
  return firstMembership?.organizationId || null;
}

// GET /api/admin/users/[id]/sessions — list active sessions for a user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUserId = getSessionUserId(request);
    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = getDb();
    const activeOrgId = getActiveOrgId(request, db);
    if (!activeOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionMembership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, sessionUserId),
          eq(schema.orgMemberships.organizationId, activeOrgId)
        )
      )
      .get();

    if (!sessionMembership || !["owner", "admin"].includes(sessionMembership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: targetUserId } = await params;

    // Get active sessions (where endedAt is null)
    const sessions = db
      .select()
      .from(schema.userSessions)
      .where(
        and(
          eq(schema.userSessions.userId, targetUserId),
          isNull(schema.userSessions.endedAt)
        )
      )
      .all();

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
      })),
    });
  } catch (err: any) {
    console.error("[API] GET /api/admin/users/[id]/sessions:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id]/sessions — revoke all active sessions for a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUserId = getSessionUserId(request);
    if (!sessionUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = getDb();
    const activeOrgId = getActiveOrgId(request, db);
    if (!activeOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionMembership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, sessionUserId),
          eq(schema.orgMemberships.organizationId, activeOrgId)
        )
      )
      .get();

    if (!sessionMembership || !["owner", "admin"].includes(sessionMembership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: targetUserId } = await params;

    // Check if this is a "revoke all" or revoke specific session
    let sessionId: string | null = null;
    try {
      const body = await request.json();
      sessionId = body.sessionId || null;
    } catch {
      // No body — revoke all
    }

    if (sessionId) {
      // Revoke specific session
      db.update(schema.userSessions)
        .set({ endedAt: new Date().toISOString() })
        .where(
          and(
            eq(schema.userSessions.id, sessionId),
            eq(schema.userSessions.userId, targetUserId)
          )
        )
        .run();
    } else {
      // Revoke all active sessions for this user
      const activeSessions = db
        .select()
        .from(schema.userSessions)
        .where(
          and(
            eq(schema.userSessions.userId, targetUserId),
            isNull(schema.userSessions.endedAt)
          )
        )
        .all();

      for (const s of activeSessions) {
        db.update(schema.userSessions)
          .set({ endedAt: new Date().toISOString() })
          .where(eq(schema.userSessions.id, s.id))
          .run();
      }
    }

    // Log activity
    const targetUser = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .get();

    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId: sessionUserId,
        organizationId: activeOrgId,
        action: "user.sessions_revoked",
        resourceType: "user",
        resourceId: targetUserId,
        resourceName: targetUser?.name || "",
        details: JSON.stringify({ revokedBy: sessionUserId, sessionId }),
      })
      .run();

    return NextResponse.json({ success: true, message: "Sessions revoked successfully" });
  } catch (err: any) {
    console.error("[API] DELETE /api/admin/users/[id]/sessions:", err);
    return NextResponse.json(
      { error: err.message || "Failed to revoke sessions" },
      { status: 500 }
    );
  }
}
