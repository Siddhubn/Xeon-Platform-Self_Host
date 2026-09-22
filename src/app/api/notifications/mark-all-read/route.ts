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

// POST /api/notifications/mark-all-read
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getDb();
    const activeOrgId = getActiveOrgId(request, db);
    const now = new Date().toISOString();

    const conditions = [
      eq(schema.notifications.userId, user.id),
      eq(schema.notifications.status, "unread"),
    ];
    if (activeOrgId) {
      conditions.push(eq(schema.notifications.organizationId, activeOrgId));
    }

    db.update(schema.notifications)
      .set({ status: "read", readAt: now })
      .where(and(...conditions))
      .run();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
