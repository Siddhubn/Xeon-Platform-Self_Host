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

// GET /api/organizations/:orgId/members — list members of an organisation
export async function GET(
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

    // Verify requester is a member of this org
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

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = db
      .select({
        membershipId: schema.orgMemberships.id,
        role: schema.orgMemberships.role,
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
      })
      .from(schema.orgMemberships)
      .innerJoin(schema.users, eq(schema.orgMemberships.userId, schema.users.id))
      .where(eq(schema.orgMemberships.organizationId, orgId))
      .all();

    return NextResponse.json({ members });
  } catch (err: any) {
    console.error("[API] GET /api/organizations/:orgId/members:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch members" },
      { status: 500 }
    );
  }
}
