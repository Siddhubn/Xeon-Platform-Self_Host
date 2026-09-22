import { NextRequest, NextResponse } from "next/server";
import {
  recoverEndpoint,
  safelyDeleteEndpoint,
  safelyDeleteBranch,
  safelyDeleteProject,
  safelyRecreateEndpoint,
  checkDependencies,
  canDeleteBranch,
  inspectProjectResources,
  checkEndpointHealth,
  runReconciliation,
  getLifecycleLogs,
} from "@/lib/resource-lifecycle";

// POST /api/projects/:projectId/lifecycle — lifecycle operations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { action, branchId, endpointId } = body;

    switch (action) {
      case "recover_endpoint": {
        if (!endpointId) {
          return NextResponse.json(
            { error: "endpointId is required" },
            { status: 400 }
          );
        }
        const result = await recoverEndpoint(endpointId);
        return NextResponse.json(result);
      }

      case "delete_endpoint": {
        if (!endpointId) {
          return NextResponse.json(
            { error: "endpointId is required" },
            { status: 400 }
          );
        }
        const result = await safelyDeleteEndpoint(endpointId);
        return NextResponse.json(result);
      }

      case "recreate_endpoint": {
        if (!endpointId) {
          return NextResponse.json(
            { error: "endpointId is required" },
            { status: 400 }
          );
        }
        const result = await safelyRecreateEndpoint(endpointId);
        return NextResponse.json(result);
      }

      case "delete_branch": {
        if (!branchId) {
          return NextResponse.json(
            { error: "branchId is required" },
            { status: 400 }
          );
        }
        const result = await safelyDeleteBranch(projectId, branchId);
        return NextResponse.json(result);
      }

      case "delete_project": {
        const result = await safelyDeleteProject(projectId);
        return NextResponse.json(result);
      }

      case "check_dependencies": {
        const deps = checkDependencies(projectId, branchId);
        return NextResponse.json({ dependencies: deps });
      }

      case "check_branch_delete": {
        if (!branchId) {
          return NextResponse.json(
            { error: "branchId is required" },
            { status: 400 }
          );
        }
        const result = canDeleteBranch(projectId, branchId);
        return NextResponse.json(result);
      }

      case "check_endpoint_health": {
        if (!endpointId) {
          return NextResponse.json(
            { error: "endpointId is required" },
            { status: 400 }
          );
        }
        const health = await checkEndpointHealth(endpointId);
        return NextResponse.json({ health });
      }

      case "inspect_resources": {
        const inspection = await inspectProjectResources(projectId);
        return NextResponse.json({ inspection });
      }

      case "reconcile": {
        const result = await runReconciliation();
        return NextResponse.json({ reconciliation: result });
      }

      case "get_logs": {
        const logs = getLifecycleLogs(body.limit || 100);
        return NextResponse.json({ logs });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[Lifecycle API] Error:", err);
    return NextResponse.json(
      { error: err.message || "Lifecycle operation failed" },
      { status: 500 }
    );
  }
}

// GET /api/projects/:projectId/lifecycle — get resource inspection
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const inspection = await inspectProjectResources(projectId);
    return NextResponse.json({ inspection });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to inspect resources" },
      { status: 500 }
    );
  }
}
