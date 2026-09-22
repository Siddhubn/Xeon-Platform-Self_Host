import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
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

// GET /api/admin/users — list users in active organisation
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

    const membership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.organizationId, activeOrgId)
        )
      )
      .get();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = db
      .select({
        membershipId: schema.orgMemberships.id,
        role: schema.orgMemberships.role,
        joinedAt: schema.orgMemberships.createdAt,
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        userRole: schema.users.role,
      })
      .from(schema.orgMemberships)
      .innerJoin(schema.users, eq(schema.orgMemberships.userId, schema.users.id))
      .where(eq(schema.orgMemberships.organizationId, activeOrgId))
      .all();

    const usersWithDetails = members.map((m) => {
      const allSessions = db
        .select()
        .from(schema.userSessions)
        .where(eq(schema.userSessions.userId, m.userId))
        .all()
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

      const lastSession = allSessions[0];
      const activeSessions = allSessions.filter((s) => !s.endedAt);

      return {
        ...m,
        lastLogin: lastSession?.createdAt || null,
        status: "active" as const,
        activeSessionCount: activeSessions.length,
      };
    });

    return NextResponse.json({ users: usersWithDetails });
  } catch (err: any) {
    console.error("[API] GET /api/admin/users:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users — create a new user
export async function POST(request: NextRequest) {
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

    const membership = db
      .select()
      .from(schema.orgMemberships)
      .where(
        and(
          eq(schema.orgMemberships.userId, userId),
          eq(schema.orgMemberships.organizationId, activeOrgId)
        )
      )
      .get();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, role, orgRole, password } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const existing = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    if (existing) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    const newUserId = `user-${crypto.randomUUID().slice(0, 8)}`;
    db.insert(schema.users)
      .values({
        id: newUserId,
        name,
        email,
        role: role || "developer",
      })
      .run();

    const memId = `mem-${crypto.randomUUID().slice(0, 8)}`;
    db.insert(schema.orgMemberships)
      .values({
        id: memId,
        userId: newUserId,
        organizationId: activeOrgId,
        role: orgRole || "member",
      })
      .run();

    if (password) {
      registerPassword(newUserId, email, password, name, role || "developer");
    }

    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId,
        organizationId: activeOrgId,
        action: "user.created",
        resourceType: "user",
        resourceId: newUserId,
        resourceName: name,
        details: JSON.stringify({ email, role: role || "developer", orgRole: orgRole || "member" }),
      })
      .run();

    return NextResponse.json(
      { user: { id: newUserId, name, email, role: role || "developer", orgRole: orgRole || "member" } },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[API] POST /api/admin/users:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/users — update a user's info
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { userId, name, email, role, orgRole, membershipId } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (name || email || role) {
      const updates: Record<string, unknown> = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (role) updates.role = role;

      db.update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, userId))
        .run();
    }

    if (orgRole && membershipId) {
      db.update(schema.orgMemberships)
        .set({ role: orgRole })
        .where(eq(schema.orgMemberships.id, membershipId))
        .run();
    }

    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId: sessionUserId,
        organizationId: activeOrgId,
        action: "user.updated",
        resourceType: "user",
        resourceId: userId,
        resourceName: name || "",
        details: JSON.stringify({ name, email, role, orgRole }),
      })
      .run();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API] PUT /api/admin/users:", err);
    return NextResponse.json(
      { error: err.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users — remove a user from the organisation
export async function DELETE(request: NextRequest) {
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

    const body = await request.json();
    const { userId, membershipId } = body;

    if (!userId || !membershipId) {
      return NextResponse.json({ error: "userId and membershipId are required" }, { status: 400 });
    }

    // Prevent removing yourself
    if (userId === sessionUserId) {
      return NextResponse.json({ error: "You cannot remove yourself from the organisation" }, { status: 400 });
    }

    // Prevent removing the owner
    const targetMembership = db
      .select()
      .from(schema.orgMemberships)
      .where(eq(schema.orgMemberships.id, membershipId))
      .get();

    if (targetMembership?.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the organisation owner" }, { status: 400 });
    }

    // Get target user name for logging
    const targetUser = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .get();

    // Remove membership
    db.delete(schema.orgMemberships)
      .where(eq(schema.orgMemberships.id, membershipId))
      .run();

    // Log activity
    db.insert(schema.activityLogs)
      .values({
        id: `act-${crypto.randomUUID().slice(0, 8)}`,
        userId: sessionUserId,
        organizationId: activeOrgId,
        action: "user.removed",
        resourceType: "user",
        resourceId: userId,
        resourceName: targetUser?.name || "",
        details: JSON.stringify({ removedBy: sessionUserId }),
      })
      .run();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API] DELETE /api/admin/users:", err);
    return NextResponse.json(
      { error: err.message || "Failed to remove user" },
      { status: 500 }
    );
  }
}
