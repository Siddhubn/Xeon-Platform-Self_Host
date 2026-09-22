import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

function getActiveOrgId(request: NextRequest, db: ReturnType<typeof getDb>): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/active_org=([^;]+)/);
  if (match) return match[1];
  return null;
}

// GET /api/notifications — list notifications for current user + active org
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getDb();
    const activeOrgId = getActiveOrgId(request, db);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const conditions = [eq(schema.notifications.userId, user.id)];
    if (activeOrgId) {
      conditions.push(eq(schema.notifications.organizationId, activeOrgId));
    }

    const notifications = db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    // Get unread count
    const unreadConditions = [
      eq(schema.notifications.userId, user.id),
      eq(schema.notifications.status, "unread"),
    ];
    if (activeOrgId) {
      unreadConditions.push(eq(schema.notifications.organizationId, activeOrgId));
    }

    const unreadResult = db
      .select({ count: schema.notifications.id })
      .from(schema.notifications)
      .where(and(...unreadConditions))
      .all();

    return NextResponse.json({
      notifications,
      unreadCount: unreadResult.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
