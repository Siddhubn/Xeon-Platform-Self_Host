import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { registerPassword } from "@/lib/auth/password-store";

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

// POST /api/admin/users/[id]/password — admin reset a user's password
export async function POST(
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

    // Verify session user is admin/owner
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
    const body = await request.json();
    const { password } = body;

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Verify the target user exists
    const targetUser = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetUserId))
      .get();

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update the password in the shared auth store
    registerPassword(targetUserId, targetUser.email, password, targetUser.name, targetUser.role);

    // Log activity
    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId: sessionUserId,
        organizationId: activeOrgId,
        action: "user.password_reset",
        resourceType: "user",
        resourceId: targetUserId,
        resourceName: targetUser.name,
        details: JSON.stringify({ resetBy: sessionUserId }),
      })
      .run();

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    console.error("[API] POST /api/admin/users/[id]/password:", err);
    return NextResponse.json(
      { error: err.message || "Failed to reset password" },
      { status: 500 }
    );
  }
}
