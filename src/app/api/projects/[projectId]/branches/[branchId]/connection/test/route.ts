import { NextRequest, NextResponse } from "next/server";
import { getConnectionService } from "@/lib/connection/connection-service";
import type { ConnectionNetworkMode, SslMode } from "@/lib/connection/types";

// POST /api/projects/:projectId/branches/:branchId/connection/test
// Tests a real connection to the PostgreSQL database
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string }> }
) {
  try {
    const { projectId, branchId } = await params;
    const body = await request.json();

    const {
      databaseName,
      roleName,
      password,
      networkMode = "auto",
      sslMode,
      customHost,
    } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required to test the connection" },
        { status: 400 }
      );
    }

    const service = getConnectionService();

    const result = await service.testConnection({
      projectId,
      branchId,
      databaseName,
      roleName,
      password,
      networkMode,
      sslMode,
      customHost,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[API] POST /api/projects/:projectId/branches/:branchId/connection/test:", err);
    return NextResponse.json(
      { error: err.message || "Failed to test connection" },
      { status: 500 }
    );
  }
}
