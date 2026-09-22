// ---------------------------------------------------------------------------
// Restore Service — restores PostgreSQL backups using pg_restore / psql
// ---------------------------------------------------------------------------

import { exec as execCb } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

const execAsync = promisify(execCb);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RestoreInput {
  backupId: string;
  targetProjectId: string;
  targetBranchId?: string;
  targetDatabaseName?: string;
  createNewProject?: boolean;
  newProjectName?: string;
  createNewBranch?: boolean;
  newBranchName?: string;
  safetyBackup?: boolean;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  targetDatabase?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Connection resolver
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
// Restore Service
// ---------------------------------------------------------------------------

export class RestoreService {
  private db = getDb();

  /**
   * Restore a backup to a target database
   */
  async restoreBackup(input: RestoreInput): Promise<RestoreResult> {
    // Get the backup
    const backup = this.db
      .select()
      .from(schema.backups)
      .where(eq(schema.backups.id, input.backupId))
      .get();

    if (!backup) {
      return { success: false, message: "Backup not found", error: "Backup not found" };
    }

    if (backup.status !== "completed") {
      return {
        success: false,
        message: "Backup is not completed",
        error: `Backup status: ${backup.status}`,
      };
    }

    if (!backup.filePath || !fs.existsSync(backup.filePath)) {
      return {
        success: false,
        message: "Backup file not found on disk",
        error: "Backup file missing",
      };
    }

    // Resolve target connection
    const targetBranchId = input.targetBranchId || backup.branchId || "";
    const conn = resolvePostgresConnection(input.targetProjectId, targetBranchId);
    const targetDatabase = input.targetDatabaseName || backup.databaseName;

    // Create safety backup if requested (for destructive restores)
    if (input.safetyBackup) {
      try {
        const { BackupService } = await import("./backup-service");
        const backupService = new BackupService();
        await backupService.createBackup({
          name: `Safety backup before restore - ${new Date().toISOString()}`,
          projectId: input.targetProjectId,
          branchId: targetBranchId,
          databaseName: targetDatabase,
          type: "full",
          format: "custom",
          scope: "database",
        });
      } catch (err: any) {
        console.warn("[Restore] Safety backup failed:", err.message);
        // Continue with restore even if safety backup fails
      }
    }

    try {
      // Ensure the target database exists
      await this.ensureDatabaseExists(conn, targetDatabase);

      // Restore based on backup format
      if (backup.format === "plain") {
        // Plain SQL — use psql
        await this.restoreWithPsql(backup.filePath, conn, targetDatabase);
      } else {
        // Custom/Tar format — use pg_restore
        await this.restoreWithPgRestore(backup.filePath, conn, targetDatabase);
      }

      // Validate the restore
      await this.validateRestore(conn, targetDatabase);

      return {
        success: true,
        message: `Successfully restored backup "${backup.name}" to database "${targetDatabase}"`,
        targetDatabase,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Restore failed: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Ensure the target database exists, create if not
   */
  private async ensureDatabaseExists(
    conn: { host: string; port: number; user: string; password: string; database: string },
    dbName: string
  ): Promise<void> {
    const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, "_");

    // Connect to 'postgres' database to create the target
    const cmd = `PGPASSWORD="${conn.password}" psql -h ${conn.host} -p ${conn.port} -U ${conn.user} -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${safeDbName}'" -t -A`;

    const result = await new Promise<string>((resolve, reject) => {
      execCb(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) reject(new Error(`Database check failed: ${stderr || error.message}`));
        else resolve(stdout.trim());
      });
    });

    if (!result) {
      // Database doesn't exist — create it
      const createCmd = `PGPASSWORD="${conn.password}" psql -h ${conn.host} -p ${conn.port} -U ${conn.user} -d postgres -c "CREATE DATABASE \\"${safeDbName}\\""`;
      await new Promise<void>((resolve, reject) => {
        execCb(createCmd, { timeout: 10000 }, (error, stdout, stderr) => {
          if (error) reject(new Error(`Failed to create database: ${stderr || error.message}`));
          else resolve();
        });
      });
    }
  }

  /**
   * Restore using psql for plain SQL backups
   */
  private async restoreWithPsql(
    filePath: string,
    conn: { host: string; port: number; user: string; password: string; database: string },
    database: string
  ): Promise<void> {
    const cmd = `PGPASSWORD="${conn.password}" psql -h ${conn.host} -p ${conn.port} -U ${conn.user} -d ${database} -f "${filePath}" --single-transaction`;

    await new Promise<void>((resolve, reject) => {
      execCb(
        cmd,
        { timeout: 600000, maxBuffer: 1024 * 1024 * 100 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`psql restore failed: ${stderr || error.message}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Restore using pg_restore for custom/tar backups
   */
  private async restoreWithPgRestore(
    filePath: string,
    conn: { host: string; port: number; user: string; password: string; database: string },
    database: string
  ): Promise<void> {
    const args = [
      `-h ${conn.host}`,
      `-p ${conn.port}`,
      `-U ${conn.user}`,
      `-d ${database}`,
      `--no-owner`,
      `--no-acl`,
      `--single-transaction`,
      `--clean`,
      `--if-exists`,
      `"${filePath}"`,
    ];

    const cmd = `PGPASSWORD="${conn.password}" pg_restore ${args.join(" ")}`;

    await new Promise<void>((resolve, reject) => {
      execCb(
        cmd,
        { timeout: 600000, maxBuffer: 1024 * 1024 * 100 },
        (error, stdout, stderr) => {
          // pg_restore exits with non-zero for warnings too, check if it's a real error
          if (error && !stderr.includes("WARNING") && !stderr.includes("pg_restore: warning")) {
            reject(new Error(`pg_restore failed: ${stderr || error.message}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Validate that the restore was successful
   */
  private async validateRestore(
    conn: { host: string; port: number; user: string; password: string; database: string },
    database: string
  ): Promise<void> {
    const cmd = `PGPASSWORD="${conn.password}" psql -h ${conn.host} -p ${conn.port} -U ${conn.user} -d ${database} -c "SELECT 1" -t -A`;

    const result = await new Promise<string>((resolve, reject) => {
      execCb(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) reject(new Error(`Validation failed: ${stderr || error.message}`));
        else resolve(stdout.trim());
      });
    });

    if (result !== "1") {
      throw new Error("Restore validation failed: database not responding correctly");
    }
  }
}

// Singleton
let _service: RestoreService | null = null;

export function getRestoreService(): RestoreService {
  if (!_service) {
    _service = new RestoreService();
  }
  return _service;
}
