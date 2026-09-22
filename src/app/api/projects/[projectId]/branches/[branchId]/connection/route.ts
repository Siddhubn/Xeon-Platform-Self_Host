import { NextRequest, NextResponse } from "next/server";
import { getConnectionService } from "@/lib/connection/connection-service";
import type { ConnectionNetworkMode, SslMode } from "@/lib/connection/types";

// GET /api/projects/:projectId/branches/:branchId/connection
// Returns connection details and all generated formats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string }> }
) {
  try {
    const { projectId, branchId } = await params;
    const query = request.nextUrl.searchParams;

    const databaseName = query.get("database") || undefined;
    const roleName = query.get("role") || undefined;
    const password = query.get("password") || undefined;
    const networkMode = (query.get("networkMode") as ConnectionNetworkMode) || "auto";
    const connectionType = (query.get("connectionType") as "direct" | "pooled") || "direct";
    const sslMode = (query.get("sslMode") as SslMode) || undefined;
    const customHost = query.get("host") || undefined;

    const service = getConnectionService();

    const details = await service.getConnectionDetails({
      projectId,
      branchId,
      databaseName,
      roleName,
      password,
      networkMode,
      connectionType,
      sslMode,
      customHost,
    });

    // Also fetch available databases and roles for the UI selectors
    const databases = service.listDatabases(projectId, branchId);
    const roles = service.listRoles(projectId, branchId);

    // Get Tailscale status
    const tailscaleStatus = service.getTailscaleStatus();

    return NextResponse.json({
      details,
      databases,
      roles,
      tailscaleStatus,
    });
  } catch (err: any) {
    console.error("[API] GET /api/projects/:projectId/branches/:branchId/connection:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate connection details" },
      { status: 500 }
    );
  }
}
