import { NextRequest, NextResponse } from "next/server";
import { getProvider, createOperation, completeOperation } from "@/lib/providers/self-hosted-neon-provider";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notifyProjectCreated } from "@/lib/notification-service";

// GET /api/projects — list all projects
export async function GET() {
  try {
    const provider = getProvider();
    const projects = await provider.projects.list();
    return NextResponse.json({ projects });
  } catch (err: any) {
    console.error("[API] GET /api/projects:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects — create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const provider = getProvider();
    const opId = createOperation("create_project");

    try {
      completeOperation(opId, "running");
      const project = await provider.projects.create({
        name: body.name,
        pgVersion: body.pgVersion || 17,
        regionId: body.regionId,
      });
      completeOperation(opId, "completed", undefined);

      // Create notification for the user
      try {
        const user = await getCurrentUser();
        if (user) {
          const db = getDb();
          const cookie = request.headers.get("cookie") || "";
          const orgMatch = cookie.match(/active_org=([^;]+)/);
          const orgId = orgMatch?.[1] || undefined;
          notifyProjectCreated(user.id, orgId, project.name);
        }
      } catch {
        // Don't fail the request if notification fails
      }

      return NextResponse.json({ project }, { status: 201 });
    } catch (err: any) {
      completeOperation(opId, "failed", err.message);
      throw err;
    }
  } catch (err: any) {
    console.error("[API] POST /api/projects:", err);
    return NextResponse.json(
      { error: err.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
