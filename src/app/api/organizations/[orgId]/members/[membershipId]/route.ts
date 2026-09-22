import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyUserRemoved } from "@/lib/notification-service";

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

// DELETE /api/organizations/:orgId/members/:membershipId — remove a member from the organisation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; membershipId: string }> }
) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId, membershipId } = await params;
    const db = getDb();

    // Verify requester is owner/admin of this specific org
    const requesterMembership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.organizationId, orgId)
        )
      )
      .get();

    if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the target membership
    const targetMembership = db
      .select()
      .from(schema.orgMemberships)
      .where(eq(schema.orgMemberships.id, membershipId))
      .get();

    if (!targetMembership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Verify the membership belongs to this org
    if (targetMembership.organizationId !== orgId) {
      return NextResponse.json({ error: "Membership does not belong to this organisation" }, { status: 400 });
    }

    // Prevent removing yourself
    if (targetMembership.userId === userId) {
      return NextResponse.json({ error: "You cannot remove yourself from the organisation" }, { status: 400 });
    }

    // Prevent removing the owner
    if (targetMembership.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the organisation owner" }, { status: 400 });
    }

    // Get target user name for logging
    const targetUser = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, targetMembership.userId))
      .get();

    // Remove membership
    db.delete(schema.orgMemberships)
      .where(eq(schema.orgMemberships.id, membershipId))
      .run();

    // Log activity
    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId,
        organizationId: orgId,
        action: "user.removed",
        resourceType: "user",
        resourceId: targetMembership.userId,
        resourceName: targetUser?.name || "",
        details: JSON.stringify({ removedBy: userId }),
      })
      .run();

    // Create notification for the removed user
    try {
      if (targetUser) {
        notifyUserRemoved(targetUser.id, orgId, targetUser.name);
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API] DELETE /api/organizations/:orgId/members/:membershipId:", err);
    return NextResponse.json(
      { error: err.message || "Failed to remove member" },
      { status: 500 }
    );
  }
}
