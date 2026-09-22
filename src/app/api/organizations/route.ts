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

// GET /api/organizations — list user's organisations
export async function GET(request: NextRequest) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();

    // Get all organisations the user is a member of
    const memberships = db
      .select({
        orgId: schema.orgMemberships.organizationId,
        role: schema.orgMemberships.role,
        membershipId: schema.orgMemberships.id,
      })
      .from(schema.orgMemberships)
      .where(eq(schema.orgMemberships.userId, userId))
      .all();

    const orgIds = memberships.map((m) => m.orgId);
    if (orgIds.length === 0) {
      return NextResponse.json({ organizations: [] });
    }

    // Fetch organisation details
    const organizations = db
      .select()
      .from(schema.organizations)
      .all()
      .filter((o) => orgIds.includes(o.id));

    // Merge membership role into org data
    const result = organizations.map((org) => {
      const membership = memberships.find((m) => m.orgId === org.id);
      return {
        ...org,
        userRole: membership?.role || "member",
        membershipId: membership?.membershipId,
      };
    });

    return NextResponse.json({ organizations: result });
  } catch (err: any) {
    console.error("[API] GET /api/organizations:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch organisations" },
      { status: 500 }
    );
  }
}

// POST /api/organizations — create a new organisation
export async function POST(request: NextRequest) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Organisation name is required" }, { status: 400 });
    }

    const db = getDb();
    const orgId = `org-${crypto.randomUUID().slice(0, 8)}`;
    const memId = `mem-${crypto.randomUUID().slice(0, 8)}`;

    // Create organisation
    db.insert(schema.organizations)
      .values({
        id: orgId,
        name: name.trim(),
        slug: slug || name.trim().toLowerCase().replace(/\s+/g, "-"),
        description: description || null,
        createdBy: userId,
      })
      .run();

    // Make creator the owner
    db.insert(schema.orgMemberships)
      .values({
        id: memId,
        userId,
        organizationId: orgId,
        role: "owner",
      })
      .run();

    // Log activity
    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId,
        organizationId: orgId,
        action: "organization.created",
        resourceType: "organization",
        resourceId: orgId,
        resourceName: name.trim(),
      })
      .run();

    const org = db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId))
      .get();

    return NextResponse.json({ organization: { ...org, userRole: "owner" } }, { status: 201 });
  } catch (err: any) {
    console.error("[API] POST /api/organizations:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create organisation" },
      { status: 500 }
    );
  }
}
