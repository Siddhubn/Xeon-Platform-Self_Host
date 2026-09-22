import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers/self-hosted-neon-provider";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { recordActivity } from "@/lib/activity-service";

// POST /api/projects/:projectId/rename — rename a project (and its corresponding tenant)
// Invariant: project.name == tenant.name
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    // Get old name for activity recording
    const db = getDb();
    const oldProject = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .get();
    const oldName = oldProject?.name || "unknown";

    const provider = getProvider();
    const project = await provider.projects.rename(projectId, { name: name.trim() });

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
          action: "project_renamed",
          resourceType: "project",
          resourceId: projectId,
          resourceName: project.name,
          status: "success",
          actorName: user.name,
          details: { oldName, newName: project.name },
        });
      }
    } catch {}

    return NextResponse.json({ project });
  } catch (err: any) {
    console.error("[API] POST /api/projects/:projectId/rename:", err);
    return NextResponse.json(
      { error: err.message || "Failed to rename project" },
      { status: 500 }
    );
  }
}
