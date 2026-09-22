import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

// PATCH /api/organizations/:orgId — update organisation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    const db = getDb();

    // Verify user is owner/admin of this org
    const membership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.organizationId, orgId)
        )
      )
      .get();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description } = body;

    // Build update fields
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push("name = ?");
      values.push(name.trim());
    }
    if (slug !== undefined) {
      updates.push("slug = ?");
      values.push(slug.trim());
    }
    if (description !== undefined) {
      updates.push("description = ?");
      values.push(description);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    updates.push("updated_at = datetime('now')");
    values.push(orgId);

    // Execute raw SQL via the underlying sqlite client
    const sqlStr = `UPDATE organizations SET ${updates.join(", ")} WHERE id = ?`;
    db.$client.prepare(sqlStr).run(...values);

    // Log activity
    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId,
        organizationId: orgId,
        action: "organization.updated",
        resourceType: "organization",
        resourceId: orgId,
        resourceName: name || undefined,
      })
      .run();

    const org = db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId))
      .get();

    return NextResponse.json({ organization: { ...org, userRole: membership.role } });
  } catch (err: any) {
    console.error("[API] PATCH /api/organizations/:orgId:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update organisation" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/:orgId — delete organisation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orgId } = await params;
    const db = getDb();

    // Verify user is owner
    const membership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.organizationId, orgId)
        )
      )
      .get();

    if (!membership || membership.role !== "owner") {
      return NextResponse.json({ error: "Only owners can delete organisations" }, { status: 403 });
    }

    // Delete memberships first, then activity, then org
    db.$client.prepare(`DELETE FROM org_memberships WHERE organization_id = ?`).run(orgId);
    db.$client.prepare(`DELETE FROM activity_logs WHERE organization_id = ?`).run(orgId);
    db.$client.prepare(`DELETE FROM organizations WHERE id = ?`).run(orgId);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API] DELETE /api/organizations/:orgId:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete organisation" },
      { status: 500 }
    );
  }
}
