import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

function getActiveOrgId(request: NextRequest, db: ReturnType<typeof getDb>): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/active_org=([^;]+)/);
  if (match) return match[1];
  return null;
}

// GET /api/notifications/unread-count
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const db = getDb();
    const activeOrgId = getActiveOrgId(request, db);

    const conditions = [
      eq(schema.notifications.userId, user.id),
      eq(schema.notifications.status, "unread"),
    ];
    if (activeOrgId) {
      conditions.push(eq(schema.notifications.organizationId, activeOrgId));
    }

    const result = db
      .select({ count: schema.notifications.id })
      .from(schema.notifications)
      .where(and(...conditions))
      .all();

    return NextResponse.json({ unreadCount: result.length });
  } catch {
    return NextResponse.json({ unreadCount: 0 });
  }
}
