import { NextRequest, NextResponse } from "next/server";
import { getProvider, createOperation, completeOperation } from "@/lib/providers/self-hosted-neon-provider";

// GET /api/projects/:projectId/branches/:branchId
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string }> }
) {
  try {
    const { projectId, branchId } = await params;
    const provider = getProvider();
    const branch = await provider.branches.get(projectId, branchId);
    return NextResponse.json({ branch });
  } catch (err: any) {
    console.error("[API] GET /api/projects/:projectId/branches/:branchId:", err);
    return NextResponse.json({ error: err.message || "Branch not found" }, { status: 500 });
  }
}

// DELETE /api/projects/:projectId/branches/:branchId
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string }> }
) {
  try {
    const { projectId, branchId } = await params;
    const provider = getProvider();
    const opId = createOperation("delete_branch", projectId, branchId);

    try {
      completeOperation(opId, "running");
      await provider.branches.delete(projectId, branchId);
      completeOperation(opId, "completed");
      return NextResponse.json({ success: true });
    } catch (err: any) {
      completeOperation(opId, "failed", err.message);
      throw err;
    }
  } catch (err: any) {
    console.error("[API] DELETE /api/projects/:projectId/branches/:branchId:", err);
    return NextResponse.json({ error: err.message || "Failed to delete branch" }, { status: 500 });
  }
}
