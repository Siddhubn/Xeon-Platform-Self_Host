import { NextRequest, NextResponse } from "next/server";
import { getProvider, createOperation, completeOperation } from "@/lib/providers/self-hosted-neon-provider";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notifyDatabaseCreated } from "@/lib/notification-service";
import { recordActivity } from "@/lib/activity-service";

// GET /api/projects/:projectId/databases?branchId=xxx
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

    const databases = await provider.databases.list(projectId, branchId);
    return NextResponse.json({ databases });
  } catch (err: any) {
    console.error("[API] GET /api/projects/:projectId/databases:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch databases" },
      { status: 500 }
    );
  }
}

// POST /api/projects/:projectId/databases
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const provider = getProvider();
    const opId = createOperation("create_database", projectId);

    try {
      completeOperation(opId, "running");
      const db = await provider.databases.create({
        projectId,
        branchId: body.branchId,
        name: body.name,
        ownerName: body.ownerName || "neondb_owner",
      });
      completeOperation(opId, "completed", db.id);

      // Record activity
      try {
        const user = await getCurrentUser();
        if (user) {
          const dbInstance = getDb();
          const cookie = request.headers.get("cookie") || "";
          const orgMatch = cookie.match(/active_org=([^;]+)/);
          const orgId = orgMatch?.[1] || undefined;
          recordActivity({
            userId: user.id,
            organizationId: orgId,
            projectId,
            branchId: body.branchId,
            databaseName: body.name,
            action: "database_created",
            resourceType: "database",
            resourceId: db.id,
            resourceName: body.name,
            status: "success",
            actorName: user.name,
          });
        }
      } catch {}

      // Create notification
      try {
        const user = await getCurrentUser();
        if (user) {
          const dbInstance = getDb();
          const cookie = request.headers.get("cookie") || "";
          const orgMatch = cookie.match(/active_org=([^;]+)/);
          const orgId = orgMatch?.[1] || undefined;
          notifyDatabaseCreated(user.id, orgId, body.name);
        }
      } catch {}

      const warning = (db as any).warning;
      const resp: any = { database: db };
      if (warning) resp.warning = warning;
      return NextResponse.json(resp, { status: 201 });
    } catch (err: any) {
      completeOperation(opId, "failed", err.message);
      throw err;
    }
  } catch (err: any) {
    console.error("[API] POST /api/projects/:projectId/databases:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create database" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:projectId/databases?branchId=xxx&name=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const branchId = request.nextUrl.searchParams.get("branchId") || "";
    const dbName = request.nextUrl.searchParams.get("name") || "";
    const provider = getProvider();
    const opId = createOperation("delete_database", projectId);

    try {
      completeOperation(opId, "running");
      await provider.databases.delete(projectId, branchId, dbName);
      completeOperation(opId, "completed");
      return NextResponse.json({ success: true });
    } catch (err: any) {
      completeOperation(opId, "failed", err.message);
      throw err;
    }
  } catch (err: any) {
    console.error("[API] DELETE /api/projects/:projectId/databases:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete database" },
      { status: 500 }
    );
  }
}
