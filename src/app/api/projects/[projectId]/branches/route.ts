import { NextRequest, NextResponse } from "next/server";
import { getProvider, createOperation, completeOperation } from "@/lib/providers/self-hosted-neon-provider";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyBranchCreated, notifyBranchFailed } from "@/lib/notification-service";
import { recordActivity } from "@/lib/activity-service";

// GET /api/projects/:projectId/branches — list branches
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const provider = getProvider();
    const branches = await provider.branches.list(projectId);
    return NextResponse.json({ branches });
  } catch (err: any) {
    console.error("[API] GET /api/projects/:projectId/branches:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch branches" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:projectId/branches — create a branch
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const provider = getProvider();
    const opId = createOperation("create_branch", projectId);

    try {
      completeOperation(opId, "running");
      const branch = await provider.branches.create({
        projectId,
        name: body.name,
        parentBranchId: body.parentBranchId,
        ancestorLsn: body.ancestorLsn,
      });
      completeOperation(opId, "completed", branch.id);

      // Record activity
      try {
        const user = await getCurrentUser();
        if (user) {
          const db = getDb();
          const cookie = request.headers.get("cookie") || "";
          const orgMatch = cookie.match(/active_org=([^;]+)/);
          const orgId = orgMatch?.[1] || undefined;
          const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
          recordActivity({
            userId: user.id,
            organizationId: orgId,
            projectId,
            branchId: branch.id,
            action: "branch_created",
            resourceType: "branch",
            resourceId: branch.id,
            resourceName: branch.name,
            status: "success",
            actorName: user.name,
            details: { parentBranchId: body.parentBranchId },
          });
        }
      } catch {}

      // Create notification
      try {
        const user = await getCurrentUser();
        if (user) {
          const db = getDb();
          const cookie = request.headers.get("cookie") || "";
          const orgMatch = cookie.match(/active_org=([^;]+)/);
          const orgId = orgMatch?.[1] || undefined;
          const project = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
          notifyBranchCreated(user.id, orgId, branch.name, project?.name);
        }
      } catch {}

      return NextResponse.json({ branch }, { status: 201 });
    } catch (err: any) {
      completeOperation(opId, "failed", err.message);
      try {
        const user = await getCurrentUser();
        if (user) {
          const db = getDb();
          const cookie = request.headers.get("cookie") || "";
          const orgMatch = cookie.match(/active_org=([^;]+)/);
          const orgId = orgMatch?.[1] || undefined;
          notifyBranchFailed(user.id, orgId, body.name || "unknown", err.message);
        }
      } catch {}
      throw err;
    }
  } catch (err: any) {
    console.error("[API] POST /api/projects/:projectId/branches:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create branch" },
      { status: 500 }
    );
  }
}
