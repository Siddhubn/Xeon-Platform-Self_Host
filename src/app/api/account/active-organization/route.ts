import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

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

// GET /api/account/active-organization — get the user's active organisation
export async function GET(request: NextRequest) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    // Get active org from cookie or preferences
    const cookie = request.headers.get("cookie") || "";
    const activeOrgMatch = cookie.match(/active_org=([^;]+)/);
    let activeOrgId = activeOrgMatch ? decodeURIComponent(activeOrgMatch[1]) : null;

    // Get user's memberships
    const memberships = db
      .select({
        orgId: schema.orgMemberships.organizationId,
        role: schema.orgMemberships.role,
      })
      .from(schema.orgMemberships)
      .where(eq(schema.orgMemberships.userId, userId))
      .all();

    if (memberships.length === 0) {
      return NextResponse.json({ organization: null, memberships: [] });
    }

    // If no active org set, use the first one
    if (!activeOrgId || !memberships.find((m) => m.orgId === activeOrgId)) {
      activeOrgId = memberships[0].orgId;
    }

    // Fetch active org details
    const org = db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, activeOrgId))
      .get();

    if (!org) {
      return NextResponse.json({ organization: null, memberships: [] });
    }

    const membership = memberships.find((m) => m.orgId === activeOrgId);

    // Fetch all org details for the switcher
    const orgIds = memberships.map((m) => m.orgId);
    const allOrgs = db
      .select()
      .from(schema.organizations)
      .all()
      .filter((o) => orgIds.includes(o.id));

    const enrichedOrgs = allOrgs.map((o) => {
      const m = memberships.find((mem) => mem.orgId === o.id);
      return { ...o, userRole: m?.role || "member" };
    });

    return NextResponse.json({
      organization: { ...org, userRole: membership?.role || "member" },
      organizations: enrichedOrgs,
    });
  } catch (err: any) {
    console.error("[API] GET /api/account/active-organization:", err);
    return NextResponse.json(
      { error: err.message || "Failed to get active organisation" },
      { status: 500 }
    );
  }
}

// POST /api/account/active-organization — set the active organisation
export async function POST(request: NextRequest) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json({ error: "Organisation ID is required" }, { status: 400 });
    }

    const db = getDb();

    // Verify user is a member of this org
    const membership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.organizationId, organizationId)
        )
      )
      .get();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organisation" }, { status: 403 });
    }

    // Log the switch
    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId,
        organizationId,
        action: "organization.switched",
        resourceType: "organization",
        resourceId: organizationId,
      })
      .run();

    // Set the cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("active_org", organizationId, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err: any) {
    console.error("[API] POST /api/account/active-organization:", err);
    return NextResponse.json(
      { error: err.message || "Failed to set active organisation" },
      { status: 500 }
    );
  }
}
