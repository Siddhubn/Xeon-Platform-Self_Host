// ---------------------------------------------------------------------------
// Backup Service — creates real PostgreSQL backups using pg_dump
// ---------------------------------------------------------------------------

import { execSync, exec as execCb } from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

const execAsync = promisify(execCb);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBackupInput {
  name: string;
  projectId: string;
  branchId?: string;
  databaseName: string;
  type: "full" | "schema" | "data";
  format?: "custom" | "plain" | "tar";
  scope?: "database" | "branch" | "project";
}

export interface BackupResult {
  id: string;
  name: string;
  status: "completed" | "failed";
  filePath?: string;
  fileSize?: number;
  checksum?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Storage path
// ---------------------------------------------------------------------------

function getBackupStoragePath(): string {
  const basePath =
    process.env.BACKUP_STORAGE_PATH || path.join(process.cwd(), ".data", "backups");
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
  return basePath;
}

// ---------------------------------------------------------------------------
// Connection resolver (duplicated from provider for isolation)
// ---------------------------------------------------------------------------

function resolvePostgresConnection(projectId: string, branchId: string) {
  const db = getDb();
  const compute = db
    .select()
    .from(schema.computes)
    .where(
      and(
        eq(schema.computes.projectId, projectId),
        eq(schema.computes.branchId, branchId),
        isNull(schema.computes.deletedAt)
      )
    )
    .get();

  return {
    host: compute?.host || process.env.POSTGRES_HOST || "localhost",
    port: compute?.port || parseInt(process.env.POSTGRES_PORT || "5432"),
    user: process.env.POSTGRES_USER || "cloud_admin",
    password: process.env.POSTGRES_PASSWORD || "helloworld",
    database: compute?.database || process.env.POSTGRES_DATABASE || "neondb",
  };
}

// ---------------------------------------------------------------------------
// Backup Service
// ---------------------------------------------------------------------------

export class BackupService {
  private db = getDb();

  /**
   * Create a real PostgreSQL backup using pg_dump
   */
  async createBackup(input: CreateBackupInput): Promise<BackupResult> {
    const id = crypto.randomBytes(16).toString("hex");
    const now = new Date().toISOString();
    const storagePath = getBackupStoragePath();

    // Resolve connection
    const conn = resolvePostgresConnection(
      input.projectId,
      input.branchId || ""
    );

    // Generate safe filename
    const safeDbName = input.databaseName.replace(/[^a-zA-Z0-9_]/g, "_");
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const fileName = `backup_${safeDbName}_${timestamp}.dump`;
    const filePath = path.join(storagePath, fileName);

    // Insert backup record
    this.db
      .insert(schema.backups)
      .values({
        id,
        name: input.name,
        projectId: input.projectId,
        branchId: input.branchId || null,
        databaseName: input.databaseName,
        type: input.type,
        format: input.format || "custom",
        status: "creating",
        scope: input.scope || "database",
        createdAt: now,
      })
      .run();

    try {
      // Build pg_dump command
      const args: string[] = [
        `-h`,
        conn.host,
        `-p`,
        String(conn.port),
        `-U`,
        conn.user,
        `-d`,
        input.databaseName,
        `--no-owner`,
        `--no-acl`,
      ];

      // Format
      let actualPath = filePath;
      switch (input.format) {
        case "plain":
          args.push("-Fp"); // Plain SQL
          actualPath = filePath.replace(".dump", ".sql");
          args.push("-f", actualPath);
          break;
        case "tar":
          args.push("-Ft"); // Tar format
          args.push("-f", filePath);
          break;
        case "custom":
        default:
          args.push("-Fc"); // Custom format (compressed, supports pg_restore)
          args.push("-f", filePath);
          break;
      }

      // Type flags
      switch (input.type) {
        case "schema":
          args.push("--schema-only");
          break;
        case "data":
          args.push("--data-only");
          break;
        case "full":
        default:
          // Full backup — no additional flags needed
          break;
      }

      // Execute pg_dump using execFile for proper argument handling (avoids shell escaping issues)
      const { execFile } = require("child_process") as typeof import("child_process");
      const execFileAsync = promisify(execFile);

      // Execute pg_dump using execFile for proper argument handling
      try {
        await execFileAsync("pg_dump", args, {
          timeout: 300000,
          maxBuffer: 1024 * 1024 * 100,
          env: { ...process.env, PGPASSWORD: conn.password },
        });
      } catch (error: any) {
        throw new Error(
          `pg_dump failed: ${error.message}\nStderr: ${error.stderr || ""}`
        );
      }

      // Validate backup file
      if (!fs.existsSync(actualPath)) {
        throw new Error("Backup file was not created");
      }

      const stats = fs.statSync(actualPath);
      if (stats.size === 0) {
        throw new Error("Backup file is empty");
      }

      // Calculate checksum
      const fileBuffer = fs.readFileSync(actualPath);
      const checksum = crypto
        .createHash("sha256")
        .update(fileBuffer)
        .digest("hex");

      // Update backup record
      const completedAt = new Date().toISOString();
      this.db
        .update(schema.backups)
        .set({
          status: "completed",
          filePath: actualPath,
          fileSize: stats.size,
          checksum,
          completedAt,
        })
        .where(eq(schema.backups.id, id))
        .run();

      return {
        id,
        name: input.name,
        status: "completed",
        filePath: actualPath,
        fileSize: stats.size,
        checksum,
        createdAt: now,
        completedAt,
      };
    } catch (err: any) {
      const errorMsg = err.message || "Unknown backup error";
      this.db
        .update(schema.backups)
        .set({
          status: "failed",
          error: errorMsg,
          completedAt: new Date().toISOString(),
        })
        .where(eq(schema.backups.id, id))
        .run();

      return {
        id,
        name: input.name,
        status: "failed",
        error: errorMsg,
        createdAt: now,
        completedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * List all backups for a project
   */
  listBackups(projectId: string): Array<typeof schema.backups.$inferSelect> {
    return this.db
      .select()
      .from(schema.backups)
      .where(
        and(
          eq(schema.backups.projectId, projectId),
          isNull(schema.backups.deletedAt)
        )
      )
      .all()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  /**
   * Get a single backup by ID
   */
  getBackup(id: string): typeof schema.backups.$inferSelect | undefined {
    return this.db
      .select()
      .from(schema.backups)
      .where(eq(schema.backups.id, id))
      .get();
  }

  /**
   * Delete a backup (soft delete + remove file)
   */
  async deleteBackup(id: string): Promise<{ success: boolean; error?: string }> {
    const backup = this.getBackup(id);
    if (!backup) {
      return { success: false, error: "Backup not found" };
    }

    // Delete the actual file if it exists
    if (backup.filePath && fs.existsSync(backup.filePath)) {
      try {
        fs.unlinkSync(backup.filePath);
      } catch (err: any) {
        return {
          success: false,
          error: `Failed to delete backup file: ${err.message}`,
        };
      }
    }

    // Soft delete metadata
    this.db
      .update(schema.backups)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(schema.backups.id, id))
      .run();

    return { success: true };
  }

  /**
   * Get backup file for download
   */
  getBackupStream(id: string): {
    stream: fs.ReadStream;
    fileName: string;
    contentType: string;
  } | null {
    const backup = this.getBackup(id);
    if (!backup || !backup.filePath || !fs.existsSync(backup.filePath)) {
      return null;
    }

    const isPlain = backup.format === "plain";
    return {
      stream: fs.createReadStream(backup.filePath),
      fileName: `${backup.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.${isPlain ? "sql" : "dump"}`,
      contentType: isPlain ? "text/plain" : "application/octet-stream",
    };
  }
}

// Singleton
let _service: BackupService | null = null;

export function getBackupService(): BackupService {
  if (!_service) {
    _service = new BackupService();
  }
  return _service;
}
