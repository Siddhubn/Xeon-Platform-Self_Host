/**
 * Notification Service — centralized service for creating, reading,
 * and managing user notifications across the application.
 */

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType = "success" | "error" | "warning" | "info" | "activity" | "system";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

export interface CreateNotificationInput {
  userId: string;
  organizationId?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message?: string;
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  actionUrl?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  type: string;
  priority: string;
  title: string;
  message: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  actionUrl: string | null;
  status: string;
  readAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return randomBytes(16).toString("hex");
}

// Deduplication: prevent the same notification type+resource from being
// created more than once within the given window (default 5 seconds).
const recentNotifications = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const last = recentNotifications.get(key);
  if (last && now - last < DEDUP_WINDOW_MS) {
    return true;
  }
  recentNotifications.set(key, now);
  // Cleanup old entries periodically
  if (recentNotifications.size > 1000) {
    for (const [k, v] of recentNotifications) {
      if (now - v > DEDUP_WINDOW_MS * 2) recentNotifications.delete(k);
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Notification Service
// ---------------------------------------------------------------------------

export const NotificationService = {
  /**
   * Create a new notification for a user.
   */
  create(input: CreateNotificationInput): NotificationRecord | null {
    const dedupKey = `${input.userId}:${input.type}:${input.resourceType || ""}:${input.resourceId || ""}:${input.title}`;
    if (isDuplicate(dedupKey)) {
      return null;
    }

    const db = getDb();
    const id = generateId();
    const now = new Date().toISOString();

    db.insert(schema.notifications)
      .values({
        id,
        userId: input.userId,
        organizationId: input.organizationId || null,
        type: input.type,
        priority: input.priority || "normal",
        title: input.title,
        message: input.message || null,
        resourceType: input.resourceType || null,
        resourceId: input.resourceId || null,
        resourceName: input.resourceName || null,
        actionUrl: input.actionUrl || null,
        status: "unread",
        createdAt: now,
      })
      .run();

    return {
      id,
      userId: input.userId,
      organizationId: input.organizationId || null,
      type: input.type,
      priority: input.priority || "normal",
      title: input.title,
      message: input.message || null,
      resourceType: input.resourceType || null,
      resourceId: input.resourceId || null,
      resourceName: input.resourceName || null,
      actionUrl: input.actionUrl || null,
      status: "unread",
      readAt: null,
      createdAt: now,
    };
  },

  /**
   * Get notifications for a user, optionally filtered by organization.
   */
  getForUser(
    userId: string,
    organizationId?: string | null,
    limit: number = 50,
    offset: number = 0
  ): NotificationRecord[] {
    const db = getDb();
    const conditions = [eq(schema.notifications.userId, userId)];
    if (organizationId) {
      conditions.push(eq(schema.notifications.organizationId, organizationId));
    }

    const rows = db
      .select()
      .from(schema.notifications)
      .where(and(...conditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    return rows;
  },

  /**
   * Get unread notification count for a user.
   */
  getUnreadCount(userId: string, organizationId?: string | null): number {
    const db = getDb();
    const conditions = [
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.status, "unread"),
    ];
    if (organizationId) {
      conditions.push(eq(schema.notifications.organizationId, organizationId));
    }

    const result = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.notifications)
      .where(and(...conditions))
      .get();

    return result?.count || 0;
  },

  /**
   * Mark a single notification as read.
   */
  markAsRead(notificationId: string, userId: string): boolean {
    const db = getDb();
    const now = new Date().toISOString();

    // Verify ownership before updating
    const existing = db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.id, notificationId),
          eq(schema.notifications.userId, userId)
        )
      )
      .get();

    if (!existing) return false;

    db.update(schema.notifications)
      .set({ status: "read", readAt: now })
      .where(eq(schema.notifications.id, notificationId))
      .run();

    return true;
  },

  /**
   * Mark all notifications as read for a user.
   */
  markAllAsRead(userId: string, organizationId?: string | null): number {
    const db = getDb();
    const now = new Date().toISOString();
    const conditions = [
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.status, "unread"),
    ];
    if (organizationId) {
      conditions.push(eq(schema.notifications.organizationId, organizationId));
    }

    db.update(schema.notifications)
      .set({ status: "read", readAt: now })
      .where(and(...conditions))
      .run();

    return 0;
  },

  /**
   * Delete old notifications (cleanup).
   */
  cleanup(userId: string, olderThanDays: number = 30): void {
    const db = getDb();
    const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
    db.delete(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          sql`${schema.notifications.createdAt} < ${cutoff}`
        )
      )
      .run();
  },
};

// ---------------------------------------------------------------------------
// Convenience helpers for common application events
// ---------------------------------------------------------------------------

export function notifyBackupCompleted(userId: string, orgId: string | undefined, backupName: string, projectName?: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Backup completed successfully",
    message: projectName || undefined,
    resourceType: "backup",
    resourceName: backupName,
    actionUrl: "/backups",
  });
}

export function notifyBackupFailed(userId: string, orgId: string | undefined, backupName: string, error?: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "error",
    priority: "high",
    title: "Backup failed",
    message: error || "Unable to complete the backup. Please try again.",
    resourceType: "backup",
    resourceName: backupName,
    actionUrl: "/backups",
  });
}

export function notifyBranchCreated(userId: string, orgId: string | undefined, branchName: string, projectName?: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Branch created successfully",
    message: projectName || undefined,
    resourceType: "branch",
    resourceName: branchName,
    actionUrl: "/branches",
  });
}

export function notifyBranchFailed(userId: string, orgId: string | undefined, branchName: string, error?: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "error",
    priority: "high",
    title: "Branch creation failed",
    message: error || "Unable to create the branch. Please try again.",
    resourceType: "branch",
    resourceName: branchName,
    actionUrl: "/branches",
  });
}

export function notifyDatabaseCreated(userId: string, orgId: string | undefined, dbName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Database created successfully",
    resourceType: "database",
    resourceName: dbName,
    actionUrl: "/databases",
  });
}

export function notifyDataApiEnabled(userId: string, orgId: string | undefined, dbName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Data API enabled",
    message: "The REST API is now active for this database.",
    resourceType: "data_api",
    resourceName: dbName,
    actionUrl: "/data-api",
  });
}

export function notifyDataApiDisabled(userId: string, orgId: string | undefined, dbName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "info",
    title: "Data API disabled",
    resourceType: "data_api",
    resourceName: dbName,
    actionUrl: "/data-api",
  });
}

export function notifyMaskingCompleted(userId: string, orgId: string | undefined, branchName: string, rulesApplied: number) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Anonymized branch is ready",
    message: `${rulesApplied} masking rule(s) applied.`,
    resourceType: "masking",
    resourceName: branchName,
    actionUrl: "/data-anonymization",
  });
}

export function notifyMaskingFailed(userId: string, orgId: string | undefined, branchName: string, error?: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "error",
    priority: "high",
    title: "Data anonymization failed",
    message: error || "Unable to complete the anonymization. Please try again.",
    resourceType: "masking",
    resourceName: branchName,
    actionUrl: "/data-anonymization",
  });
}

export function notifyUserAdded(userId: string, orgId: string | undefined, addedUserName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "activity",
    title: "New member added",
    message: `${addedUserName} has been added to the organisation.`,
    resourceType: "user",
    resourceName: addedUserName,
    actionUrl: "/admin/users",
  });
}

export function notifyUserRemoved(userId: string, orgId: string | undefined, removedUserName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "warning",
    title: "Member removed",
    message: `${removedUserName} has been removed from the organisation.`,
    resourceType: "user",
    resourceName: removedUserName,
    actionUrl: "/admin/users",
  });
}

export function notifyRestoreCompleted(userId: string, orgId: string | undefined, branchName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Restore completed successfully",
    resourceType: "branch",
    resourceName: branchName,
    actionUrl: "/backups",
  });
}

export function notifyRestoreFailed(userId: string, orgId: string | undefined, branchName: string, error?: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "error",
    priority: "high",
    title: "Restore operation failed",
    message: error || "Unable to restore. Please try again.",
    resourceType: "backup",
    resourceName: branchName,
    actionUrl: "/backups",
  });
}

export function notifyComputeEvent(userId: string, orgId: string | undefined, event: "started" | "stopped" | "failed", computeName: string) {
  const typeMap = { started: "success" as const, stopped: "info" as const, failed: "error" as const };
  const titleMap = { started: "Compute started", stopped: "Compute stopped", failed: "Compute failed" };
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: typeMap[event],
    priority: event === "failed" ? "high" : "normal",
    title: titleMap[event],
    resourceType: "compute",
    resourceName: computeName,
    actionUrl: "/compute",
  });
}

export function notifyProjectCreated(userId: string, orgId: string | undefined, projectName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Project created successfully",
    resourceType: "project",
    resourceName: projectName,
    actionUrl: "/projects",
  });
}

export function notifySchemaRefreshed(userId: string, orgId: string | undefined) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "info",
    title: "Schema cache refreshed",
    resourceType: "data_api",
    actionUrl: "/data-api",
  });
}

export function notifyReplicaCreated(userId: string, orgId: string | undefined, replicaName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Read replica is ready",
    message: "The replica is now available for read-only connections.",
    resourceType: "compute",
    resourceName: replicaName,
    actionUrl: "/compute",
  });
}

export function notifyReplicaDeleted(userId: string, orgId: string | undefined, replicaName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "info",
    title: "Read replica deleted",
    message: `${replicaName} has been removed.`,
    resourceType: "compute",
    actionUrl: "/compute",
  });
}

export function notifyReplicaFailed(userId: string, orgId: string | undefined, replicaName: string, error?: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "error",
    priority: "high",
    title: "Read replica creation failed",
    message: error || "Unable to create the read replica. Please try again.",
    resourceType: "compute",
    resourceName: replicaName,
    actionUrl: "/compute",
  });
}

export function notifyImportCompleted(userId: string, orgId: string | undefined, rowsImported: number, dbName: string) {
  const formattedRows = rowsImported >= 1_000_000
    ? `${(rowsImported / 1_000_000).toFixed(1)} million`
    : rowsImported >= 1_000
    ? `${(rowsImported / 1_000).toFixed(1)}k`
    : `${rowsImported}`;
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "success",
    title: "Import completed successfully",
    message: `${formattedRows} rows imported into ${dbName}.`,
    resourceType: "import",
    resourceName: dbName,
    actionUrl: "/import-data",
  });
}

export function notifyImportFailed(userId: string, orgId: string | undefined, error: string, dbName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "error",
    priority: "high",
    title: "Data import failed",
    message: "The import could not be completed. View import details for more information.",
    resourceType: "import",
    resourceName: dbName,
    actionUrl: "/import-data",
  });
}

export function notifyImportStarted(userId: string, orgId: string | undefined, dbName: string) {
  return NotificationService.create({
    userId,
    organizationId: orgId,
    type: "info",
    title: "Import started",
    message: `Importing data into ${dbName}.`,
    resourceType: "import",
    resourceName: dbName,
    actionUrl: "/import-data",
  });
}
