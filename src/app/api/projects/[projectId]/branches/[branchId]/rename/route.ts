import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers/self-hosted-neon-provider";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { recordActivity } from "@/lib/activity-service";

// POST /api/projects/:projectId/branches/:branchId/rename — rename a branch (and its timeline display name)
// Invariant: branch.name == timeline display name, timeline ID unchanged
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string }> }
) {
  try {
    const { projectId, branchId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Branch name is required" },
        { status: 400 }
      );
    }

    // Get old name for activity recording
    const db = getDb();
    const oldBranch = db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, branchId),
          eq(schema.branches.projectId, projectId)
        )
      )
      .get();
    const oldName = oldBranch?.name || "unknown";

    const provider = getProvider();
    const branch = await provider.branches.rename(projectId, branchId, {
      name: name.trim(),
    });

    // Record activity
    try {
      const user = await getCurrentUser();
      if (user) {
        const cookie = request.headers.get("cookie") || "";
        const orgMatch = cookie.match(/active_org=([^;]+)/);
        const orgId = orgMatch?.[1] || undefined;
        recordActivity({
          userId: user.id,
          organizationId: orgId,
          projectId,
          branchId,
          action: "branch_renamed",
          resourceType: "branch",
          resourceId: branchId,
          resourceName: branch.name,
          status: "success",
          actorName: user.name,
          details: { oldName, newName: branch.name, internalTimelineId: oldBranch?.internalTimelineId },
        });
      }
    } catch {}

    return NextResponse.json({ branch });
  } catch (err: any) {
    console.error(
      "[API] POST /api/projects/:projectId/branches/:branchId/rename:",
      err
    );
    return NextResponse.json(
      { error: err.message || "Failed to rename branch" },
      { status: 500 }
    );
  }
}
