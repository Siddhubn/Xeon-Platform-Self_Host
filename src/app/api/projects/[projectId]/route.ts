import { NextRequest, NextResponse } from "next/server";
import { getProvider, createOperation, completeOperation } from "@/lib/providers/self-hosted-neon-provider";

// GET /api/projects/:projectId — get project detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const provider = getProvider();
    const project = await provider.projects.get(projectId);

    // Also fetch branches for the project
    const branches = await provider.branches.list(projectId);

    return NextResponse.json({ project, branches });
  } catch (err: any) {
    console.error("[API] GET /api/projects/:projectId:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId — delete a project
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const provider = getProvider();
    const opId = createOperation("delete_project", projectId);

    try {
      completeOperation(opId, "running");
      await provider.projects.delete(projectId);
      completeOperation(opId, "completed");
      return NextResponse.json({ success: true });
    } catch (err: any) {
      completeOperation(opId, "failed", err.message);
      throw err;
    }
  } catch (err: any) {
    console.error("[API] DELETE /api/projects/:projectId:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete project" },
      { status: 500 }
    );
  }
}
