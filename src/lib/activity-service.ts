/**
 * Centralized Activity Recording Service
 *
 * All application events (branch, compute, database, role, backup, etc.)
 * flow through this service into the activity_logs table for monitoring.
 */

import { getDb } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";
import { eq, and, desc, sql, gte, lte, like, or, count } from "drizzle-orm";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Activity event types
// ---------------------------------------------------------------------------

export type ActivityResourceType =
  | "project"
  | "branch"
  | "compute"
  | "database"
  | "role"
  | "backup"
  | "restore"
  | "import"
  | "replica"
  | "data_api"
  | "security"
  | "auth"
  | "query"
  | "connection"
  | "configuration";

export type ActivityAction =
  // Project
  | "project_created"
  | "project_updated"
  | "project_deleted"
  | "project_renamed"
  // Branch
  | "branch_created"
  | "branch_updated"
  | "branch_deleted"
  | "branch_switched"
  | "branch_renamed"
  // Compute
  | "compute_created"
  | "compute_started"
  | "compute_stopped"
  | "compute_restarted"
  | "compute_updated"
  | "compute_failed"
  | "compute_deleted"
  // Database
  | "database_created"
  | "database_updated"
  | "database_deleted"
  | "database_connection"
  // Role
  | "role_created"
  | "role_updated"
  | "role_deleted"
  | "role_permission_changed"
  // Backup
  | "backup_started"
  | "backup_completed"
  | "backup_failed"
  | "backup_deleted"
  // Restore
  | "restore_started"
  | "restore_completed"
  | "restore_failed"
  // Import
  | "import_started"
  | "import_completed"
  | "import_failed"
  | "import_cancelled"
  // Replica
  | "replica_created"
  | "replica_started"
  | "replica_stopped"
  | "replica_restarted"
  | "replica_failed"
  | "replica_deleted"
  // Data API
  | "data_api_enabled"
  | "data_api_disabled"
  | "data_api_updated"
  // Security
  | "security_scan_completed"
  | "security_finding_detected"
  // Auth
  | "user_login"
  | "user_logout"
  | "password_changed"
  // Query
  | "query_executed"
  | "query_failed"
  // Connection
  | "connection_established"
  | "connection_closed"
  // Configuration
  | "configuration_updated";

export type ActivityStatus = "success" | "failed" | "warning" | "in_progress";

export interface RecordActivityParams {
  userId: string;
  organizationId?: string;
  projectId?: string;
  branchId?: string;
  computeId?: string;
  databaseName?: string;
  roleName?: string;
  action: ActivityAction;
  resourceType: ActivityResourceType;
  resourceId?: string;
  resourceName?: string;
  status?: ActivityStatus;
  actorName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  operationId?: string;
}

// ---------------------------------------------------------------------------
// Record a single activity event
// ---------------------------------------------------------------------------

export function recordActivity(params: RecordActivityParams): string {
  const db = getDb();
  const id = randomUUID();

  db.insert(activityLogs)
    .values({
      id,
      userId: params.userId,
      organizationId: params.organizationId || null,
      projectId: params.projectId || null,
      branchId: params.branchId || null,
      computeId: params.computeId || null,
      databaseName: params.databaseName || null,
      roleName: params.roleName || null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId || null,
      resourceName: params.resourceName || null,
      status: params.status || "success",
      actorName: params.actorName || null,
      details: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.ipAddress || null,
      operationId: params.operationId || null,
    })
    .run();

  return id;
}

// ---------------------------------------------------------------------------
// Query parameters for activity listing
// ---------------------------------------------------------------------------

export interface ActivityQueryParams {
  projectId?: string;
  branchId?: string;
  computeId?: string;
  databaseName?: string;
  roleName?: string;
  resourceType?: string;
  action?: string;
  status?: string;
  actorId?: string;
  search?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface ActivityQueryResult {
  activities: ActivityRecord[];
  total: number;
  hasMore: boolean;
}

export interface ActivityRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  projectId: string | null;
  branchId: string | null;
  computeId: string | null;
  databaseName: string | null;
  roleName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  status: string | null;
  actorName: string | null;
  details: string | null;
  ipAddress: string | null;
  operationId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query activities with filtering
// ---------------------------------------------------------------------------

export function queryActivities(params: ActivityQueryParams): ActivityQueryResult {
  const db = getDb();
  const conditions = [];
  const limit = params.limit || 50;
  const offset = params.offset || 0;

  if (params.projectId) {
    conditions.push(eq(activityLogs.projectId, params.projectId));
  }
  if (params.branchId) {
    conditions.push(eq(activityLogs.branchId, params.branchId));
  }
  if (params.computeId) {
    conditions.push(eq(activityLogs.computeId, params.computeId));
  }
  if (params.databaseName) {
    conditions.push(eq(activityLogs.databaseName, params.databaseName));
  }
  if (params.roleName) {
    conditions.push(eq(activityLogs.roleName, params.roleName));
  }
  if (params.resourceType) {
    conditions.push(eq(activityLogs.resourceType, params.resourceType));
  }
  if (params.action) {
    conditions.push(eq(activityLogs.action, params.action));
  }
  if (params.status) {
    conditions.push(eq(activityLogs.status, params.status));
  }
  if (params.actorId) {
    conditions.push(eq(activityLogs.userId, params.actorId));
  }
  if (params.startTime) {
    conditions.push(gte(activityLogs.createdAt, params.startTime));
  }
  if (params.endTime) {
    conditions.push(lte(activityLogs.createdAt, params.endTime));
  }
  if (params.search) {
    const searchTerm = `%${params.search}%`;
    conditions.push(
      or(
        like(activityLogs.resourceName, searchTerm),
        like(activityLogs.action, searchTerm),
        like(activityLogs.actorName, searchTerm),
        like(activityLogs.databaseName, searchTerm),
        like(activityLogs.roleName, searchTerm)
      )!
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const totalResult = db
    .select({ value: count() })
    .from(activityLogs)
    .where(whereClause)
    .get();
  const total = totalResult?.value || 0;

  // Get activities
  const activities = db
    .select()
    .from(activityLogs)
    .where(whereClause)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  return {
    activities,
    total,
    hasMore: offset + limit < total,
  };
}

// ---------------------------------------------------------------------------
// Get monitoring stats for a project/branch
// ---------------------------------------------------------------------------

export interface MonitoringStats {
  totalEvents: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  inProgressCount: number;
  eventsByResourceType: Record<string, number>;
  eventsByAction: Record<string, number>;
  recentActivity: ActivityRecord[];
  eventsLast24h: number;
  eventsLast7d: number;
  uniqueActors: number;
}

export function getMonitoringStats(
  projectId: string,
  branchId?: string
): MonitoringStats {
  const db = getDb();
  const conditions = [eq(activityLogs.projectId, projectId)];
  if (branchId) {
    conditions.push(eq(activityLogs.branchId, branchId));
  }
  const whereClause = and(...conditions);

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Total events
  const totalResult = db
    .select({ value: count() })
    .from(activityLogs)
    .where(whereClause)
    .get();
  const totalEvents = totalResult?.value || 0;

  // Success/Failed/Warning counts
  const successResult = db
    .select({ value: count() })
    .from(activityLogs)
    .where(and(...conditions, eq(activityLogs.status, "success")))
    .get();
  const failedResult = db
    .select({ value: count() })
    .from(activityLogs)
    .where(and(...conditions, eq(activityLogs.status, "failed")))
    .get();
  const warningResult = db
    .select({ value: count() })
    .from(activityLogs)
    .where(and(...conditions, eq(activityLogs.status, "warning")))
    .get();
  const inProgressResult = db
    .select({ value: count() })
    .from(activityLogs)
    .where(and(...conditions, eq(activityLogs.status, "in_progress")))
    .get();

  // Events by resource type
  const byResourceType = db
    .select({
      type: activityLogs.resourceType,
      value: count(),
    })
    .from(activityLogs)
    .where(whereClause)
    .groupBy(activityLogs.resourceType)
    .all();

  const eventsByResourceType: Record<string, number> = {};
  for (const row of byResourceType) {
    if (row.type) eventsByResourceType[row.type] = row.value;
  }

  // Events by action
  const byAction = db
    .select({
      action: activityLogs.action,
      value: count(),
    })
    .from(activityLogs)
    .where(whereClause)
    .groupBy(activityLogs.action)
    .all();

  const eventsByAction: Record<string, number> = {};
  for (const row of byAction) {
    eventsByAction[row.action] = row.value;
  }

  // Recent activity (last 20)
  const recentActivity = db
    .select()
    .from(activityLogs)
    .where(whereClause)
    .orderBy(desc(activityLogs.createdAt))
    .limit(20)
    .all();

  // Events last 24h
  const last24hResult = db
    .select({ value: count() })
    .from(activityLogs)
    .where(and(...conditions, gte(activityLogs.createdAt, last24h)))
    .get();

  // Events last 7d
  const last7dResult = db
    .select({ value: count() })
    .from(activityLogs)
    .where(and(...conditions, gte(activityLogs.createdAt, last7d)))
    .get();

  // Unique actors
  const uniqueActorsResult = db
    .select({ value: sql<string>`count(distinct ${activityLogs.userId})` })
    .from(activityLogs)
    .where(whereClause)
    .get();

  return {
    totalEvents,
    successCount: successResult?.value || 0,
    failedCount: failedResult?.value || 0,
    warningCount: warningResult?.value || 0,
    inProgressCount: inProgressResult?.value || 0,
    eventsByResourceType,
    eventsByAction,
    recentActivity,
    eventsLast24h: last24hResult?.value || 0,
    eventsLast7d: last7dResult?.value || 0,
    uniqueActors: parseInt(uniqueActorsResult?.value || "0", 10),
  };
}

// ---------------------------------------------------------------------------
// Get unique filter values for a project/branch
// ---------------------------------------------------------------------------

export interface FilterOptions {
  resourceTypes: string[];
  actions: string[];
  statuses: string[];
  actors: { id: string; name: string }[];
  databases: string[];
  roles: string[];
}

export function getFilterOptions(
  projectId: string,
  branchId?: string
): FilterOptions {
  const db = getDb();
  const conditions = [eq(activityLogs.projectId, projectId)];
  if (branchId) {
    conditions.push(eq(activityLogs.branchId, branchId));
  }
  const whereClause = and(...conditions);

  const resourceTypes = db
    .selectDistinct({ value: activityLogs.resourceType })
    .from(activityLogs)
    .where(whereClause)
    .all()
    .map((r) => r.value)
    .filter(Boolean) as string[];

  const actions = db
    .selectDistinct({ value: activityLogs.action })
    .from(activityLogs)
    .where(whereClause)
    .all()
    .map((r) => r.value)
    .filter(Boolean) as string[];

  const statuses = db
    .selectDistinct({ value: activityLogs.status })
    .from(activityLogs)
    .where(whereClause)
    .all()
    .map((r) => r.value)
    .filter(Boolean) as string[];

  const actors = db
    .selectDistinct({
      id: activityLogs.userId,
      name: activityLogs.actorName,
    })
    .from(activityLogs)
    .where(whereClause)
    .all()
    .filter((r) => r.id && r.name) as { id: string; name: string }[];

  const databases = db
    .selectDistinct({ value: activityLogs.databaseName })
    .from(activityLogs)
    .where(whereClause)
    .all()
    .map((r) => r.value)
    .filter(Boolean) as string[];

  const roles = db
    .selectDistinct({ value: activityLogs.roleName })
    .from(activityLogs)
    .where(whereClause)
    .all()
    .map((r) => r.value)
    .filter(Boolean) as string[];

  return { resourceTypes, actions, statuses, actors, databases, roles };
}
