import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

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

// GET /api/admin/activity — list activity logs for active organisation
export async function GET(request: NextRequest) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = getDb();
    const activeOrgId = getActiveOrgId(request, db);
    if (!activeOrgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify membership
    const membership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        require("drizzle-orm").and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.organizationId, activeOrgId)
        )
      )
      .get();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch activity logs with user info
    const logs = db
      .select({
        id: schema.activityLogs.id,
        action: schema.activityLogs.action,
        resourceType: schema.activityLogs.resourceType,
        resourceId: schema.activityLogs.resourceId,
        resourceName: schema.activityLogs.resourceName,
        details: schema.activityLogs.details,
        createdAt: schema.activityLogs.createdAt,
        userId: schema.users.id,
        userName: schema.users.name,
        userEmail: schema.users.email,
      })
      .from(schema.activityLogs)
      .innerJoin(schema.users, eq(schema.activityLogs.userId, schema.users.id))
      .where(eq(schema.activityLogs.organizationId, activeOrgId))
      .all()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, 100);

    return NextResponse.json({ logs });
  } catch (err: any) {
    console.error("[API] GET /api/admin/activity:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
