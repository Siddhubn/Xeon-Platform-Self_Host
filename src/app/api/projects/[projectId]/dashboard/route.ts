import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * GET /api/projects/:projectId/dashboard
 * Returns consolidated project overview data for the dashboard.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const db = getDb();

    // Verify project exists
    const project = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .get();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get branches
    const branches = db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.projectId, projectId))
      .all();

    // Get databases
    const databases = db
      .select()
      .from(schema.databases)
      .where(eq(schema.databases.projectId, projectId))
      .all();

    // Get computes
    const computes = db
      .select()
      .from(schema.computes)
      .where(eq(schema.computes.projectId, projectId))
      .all();

    // Get read replicas
    const replicas = db
      .select()
      .from(schema.readReplicas)
      .where(
        and(
          eq(schema.readReplicas.projectId, projectId),
          eq(schema.readReplicas.status, "active")
        )
      )
      .all();

    // Get backups
    const backups = db
      .select()
      .from(schema.backups)
      .where(eq(schema.backups.projectId, projectId))
      .orderBy(desc(schema.backups.createdAt))
      .limit(5)
      .all();

    // Get recent operations
    const operations = db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.projectId, projectId))
      .orderBy(desc(schema.operations.createdAt))
      .limit(10)
      .all();

    // Get recent notifications for this project
    const notifications = db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, user.id),
          eq(schema.notifications.resourceType, "project"),
          eq(schema.notifications.resourceId, projectId)
        )
      )
      .orderBy(desc(schema.notifications.createdAt))
      .limit(10)
      .all();

    // Get Data API status
    const dataApiConfigs = db
      .select()
      .from(schema.dataApiConfigs)
      .where(eq(schema.dataApiConfigs.projectId, projectId))
      .all();

    const dataApiEnabled = dataApiConfigs.some((c) => c.enabled);

    // Get masking operations
    const maskingOps = db
      .select()
      .from(schema.maskingOperations)
      .where(eq(schema.maskingOperations.projectId, projectId))
      .orderBy(desc(schema.maskingOperations.createdAt))
      .limit(5)
      .all();

    // Get import jobs
    const importJobs = db
      .select()
      .from(schema.importJobs)
      .where(eq(schema.importJobs.projectId, projectId))
      .orderBy(desc(schema.importJobs.createdAt))
      .limit(5)
      .all();

    // Calculate health status
    const activeComputes = computes.filter((c) => !c.deletedAt);
    const activeBranches = branches.filter((b) => !b.deletedAt);
    const activeDatabases = databases.filter((d) => !d.deletedAt);
    const failedOps = operations.filter((o) => o.status === "failed");
    const activeImports = importJobs.filter((j) => j.status === "running" || j.status === "pending");

    let healthStatus: "healthy" | "warning" | "degraded" = "healthy";
    if (failedOps.length > 0) healthStatus = "warning";
    if (activeComputes.length === 0) healthStatus = "degraded";

    // Build recent activity from operations, backups, and imports
    const recentActivity: Array<{
      type: string;
      title: string;
      resource?: string;
      status: string;
      timestamp: string;
    }> = [];

    for (const op of operations.slice(0, 5)) {
      recentActivity.push({
        type: "operation",
        title: op.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        resource: op.resourceId || undefined,
        status: op.status,
        timestamp: op.createdAt,
      });
    }

    for (const backup of backups.slice(0, 3)) {
      recentActivity.push({
        type: "backup",
        title: `Backup: ${backup.name}`,
        resource: backup.databaseName,
        status: backup.status,
        timestamp: backup.createdAt,
      });
    }

    for (const imp of importJobs.slice(0, 3)) {
      recentActivity.push({
        type: "import",
        title: "Data Import",
        resource: imp.databaseName,
        status: imp.status,
        timestamp: imp.createdAt,
      });
    }

    // Sort by timestamp
    recentActivity.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
      },
      health: healthStatus,
      summary: {
        branches: activeBranches.length,
        databases: activeDatabases.length,
        computes: activeComputes.length,
        replicas: replicas.length,
        backups: backups.length,
      },
      branches: activeBranches.map((b) => ({
        id: b.id,
        name: b.name,
        isPrimary: b.isPrimary,
      })),
      computes: activeComputes.map((c) => ({
        id: c.id,
        name: c.name,
        host: c.host,
        port: c.port,
        database: c.database,
      })),
      databases: activeDatabases.map((d) => ({
        id: d.id,
        name: d.name,
      })),
      replicas: replicas.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        status: r.status,
        replicationStatus: r.replicationStatus,
      })),
      recentActivity: recentActivity.slice(0, 8),
      activeOperations: operations
        .filter((o) => o.status === "pending" || o.status === "running")
        .map((o) => ({
          id: o.id,
          type: o.type,
          status: o.status,
          createdAt: o.createdAt,
        })),
      dataApiEnabled,
      lastBackup: backups[0]
        ? {
            name: backups[0].name,
            status: backups[0].status,
            createdAt: backups[0].createdAt,
          }
        : null,
      activeImports: activeImports.map((j) => ({
        id: j.id,
        databaseName: j.databaseName,
        status: j.status,
        tablesCompleted: j.tablesCompleted,
        tablesTotal: j.tablesTotal,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
