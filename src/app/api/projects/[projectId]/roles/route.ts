import { NextRequest, NextResponse } from "next/server";
import { getProvider, createOperation, completeOperation } from "@/lib/providers/self-hosted-neon-provider";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { recordActivity } from "@/lib/activity-service";

// GET /api/projects/:projectId/roles?branchId=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const branchId = request.nextUrl.searchParams.get("branchId") || "";
    const provider = getProvider();

    if (!branchId) {
      return NextResponse.json({ error: "branchId is required" }, { status: 400 });
    }

    const roles = await provider.roles.list(projectId, branchId);
    return NextResponse.json({ roles });
  } catch (err: any) {
    console.error("[API] GET /api/projects/:projectId/roles:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch roles" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:projectId/roles
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const provider = getProvider();
    const opId = createOperation("create_role", projectId);

    try {
      completeOperation(opId, "running");
      const role = await provider.roles.create({
        projectId,
        branchId: body.branchId,
        name: body.name,
        password: body.password,
      });
      completeOperation(opId, "completed", role.id);

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
            branchId: body.branchId,
            roleName: body.name,
            action: "role_created",
            resourceType: "role",
            resourceId: role.id,
            resourceName: body.name,
            status: "success",
            actorName: user.name,
          });
        }
      } catch {}

      // Include any warning from the provider (e.g. PostgreSQL unreachable)
      const warning = (role as any).warning;
      const resp: any = { role };
      if (warning) resp.warning = warning;
      return NextResponse.json(resp, { status: 201 });
    } catch (err: any) {
      completeOperation(opId, "failed", err.message);
      throw err;
    }
  } catch (err: any) {
    console.error("[API] POST /api/projects/:projectId/roles:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create role" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId/roles?branchId=xxx&name=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const branchId = request.nextUrl.searchParams.get("branchId") || "";
    const roleName = request.nextUrl.searchParams.get("name") || "";
    const provider = getProvider();
    const opId = createOperation("delete_role", projectId);

    try {
      completeOperation(opId, "running");
      await provider.roles.delete(projectId, branchId, roleName);
      completeOperation(opId, "completed");
      return NextResponse.json({ success: true });
    } catch (err: any) {
      completeOperation(opId, "failed", err.message);
      throw err;
    }
  } catch (err: any) {
    console.error("[API] DELETE /api/projects/:projectId/roles:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete role" },
      { status: 500 }
    );
  }
}
