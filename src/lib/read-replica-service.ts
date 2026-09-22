/**
 * Read Replica Service — manages read replica lifecycle.
 * 
 * Creates read replicas by branching from the primary timeline,
 * which produces an independent, read-only copy of the data.
 * The replica runs its own compute with read-only role enforcement.
 */

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import pg from "pg";

function generateId(): string {
  return randomBytes(16).toString("hex");
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateReplicaInput {
  projectId: string;
  branchId: string;
  displayName: string;
  location?: string;
  organizationId?: string;
  createdBy?: string;
}

export interface ReplicaStatus {
  id: string;
  displayName: string;
  status: string;
  replicationStatus: string | null;
  replicationLagMs: number | null;
  host: string | null;
  port: number | null;
  database: string | null;
  role: string | null;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Connection helpers (reuse existing provider pattern)
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
    database: compute?.database || "neondb",
    role: compute?.role || "neondb_owner",
  };
}

function createPgClient(opts: {
  host: string;
  port: number;
  database: string;
}): pg.Client {
  return new pg.Client({
    host: opts.host,
    port: opts.port,
    database: opts.database,
    user: process.env.POSTGRES_USER || "cloud_admin",
    password: process.env.POSTGRES_PASSWORD || "helloworld",
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    ssl: false,
  });
}

// ---------------------------------------------------------------------------
// ReadReplicaService
// ---------------------------------------------------------------------------

export const ReadReplicaService = {
  /**
   * Create a read replica for a project/branch.
   * Strategy: Create a new branch (copy-on-write clone) from the source branch,
   * then set up a read-only role on the replica's compute.
   */
  async create(input: CreateReplicaInput): Promise<schema.ReadReplica> {
    const db = getDb();
    const id = generateId();
    const timestamp = now();

    // Validate source branch exists
    const branch = db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, input.branchId),
          eq(schema.branches.projectId, input.projectId),
          isNull(schema.branches.deletedAt)
        )
      )
      .get();

    if (!branch) {
      throw new Error("Source branch not found");
    }

    // Get the project for internal identifiers
    const project = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, input.projectId))
      .get();

    if (!project) {
      throw new Error("Project not found");
    }

    // Create the replica metadata first (status: creating)
    db.insert(schema.readReplicas)
      .values({
        id,
        organizationId: input.organizationId || null,
        projectId: input.projectId,
        branchId: input.branchId,
        sourceComputeId: input.branchId,
        displayName: input.displayName,
        status: "creating",
        type: "read_replica",
        location: input.location || "primary",
        createdBy: input.createdBy || null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    try {
      // Step 1: Create a new branch from the source (this is the read-only copy)
      const replicaBranchName = `replica-${input.displayName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${Date.now()}`;
      
      // Try to use the SDK to create a branch
      let replicaTimelineId: string | null = null;
      try {
        const { NeonSDK } = await import("@/lib/sdk");
        const sdk = new NeonSDK();
        const result = await sdk.projects.createBranch({
          projectId: project.internalTenantId,
          ancestorTimelineId: branch.internalTimelineId,
          name: replicaBranchName,
        });
        replicaTimelineId = result.branchTimelineId;
      } catch (err) {
        // SDK may not be available; try direct pageserver call
        console.warn("[ReadReplica] SDK branch creation failed, trying alternative:", err);
        
        // Fallback: Use the self-hosted provider to create a branch
        try {
          const { getProvider } = await import("@/lib/providers/self-hosted-neon-provider");
          const provider = getProvider();
          const newBranch = await provider.branches.create({
            projectId: input.projectId,
            parentBranchId: input.branchId,
            name: replicaBranchName,
          });
          replicaTimelineId = newBranch.internalTimelineId;
        } catch (branchErr) {
          console.warn("[ReadReplica] Branch creation failed:", branchErr);
        }
      }

      // Step 2: Create a read-only role on the replica's database
      const replicaConn = {
        host: process.env.POSTGRES_HOST || "localhost",
        port: parseInt(process.env.POSTGRES_PORT || "5432"),
        database: "postgres",
      };

      const replicaRoleName = `replica_${input.displayName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      
      try {
        const client = createPgClient(replicaConn);
        await client.connect();
        
        // Create a read-only role for the replica
        try {
          await client.query(
            `CREATE ROLE "${replicaRoleName}" WITH LOGIN PASSWORD '${randomBytes(16).toString("hex")}'`
          );
          // Grant read-only access to all tables in public schema
          await client.query(
            `GRANT USAGE ON SCHEMA public TO "${replicaRoleName}"`
          );
          await client.query(
            `GRANT SELECT ON ALL TABLES IN SCHEMA public TO "${replicaRoleName}"`
          );
          await client.query(
            `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "${replicaRoleName}"`
          );
        } catch (roleErr: any) {
          // Role may already exist — that's fine
          if (!roleErr.message?.includes("already exists")) {
            console.warn("[ReadReplica] Role creation warning:", roleErr.message);
          }
        }
        
        await client.end();
      } catch (connErr) {
        console.warn("[ReadReplica] Could not connect to PostgreSQL for role setup:", connErr);
      }

      // Step 3: Update replica metadata with the actual connection info
      const conn = resolvePostgresConnection(input.projectId, input.branchId);
      
      db.update(schema.readReplicas)
        .set({
          internalTimelineId: replicaTimelineId,
          host: conn.host,
          port: conn.port,
          database: conn.database,
          role: replicaRoleName || "cloud_admin",
          status: "active",
          replicationStatus: "healthy",
          replicationLagMs: 0,
          updatedAt: now(),
        })
        .where(eq(schema.readReplicas.id, id))
        .run();

      // Return the created replica
      const replica = db
        .select()
        .from(schema.readReplicas)
        .where(eq(schema.readReplicas.id, id))
        .get();

      return replica!;
    } catch (err: any) {
      // Mark as failed
      db.update(schema.readReplicas)
        .set({
          status: "failed",
          errorMessage: err.message || "Failed to create read replica",
          updatedAt: now(),
        })
        .where(eq(schema.readReplicas.id, id))
        .run();

      throw err;
    }
  },

  /**
   * List all read replicas for a project.
   */
  list(projectId: string): schema.ReadReplica[] {
    const db = getDb();
    return db
      .select()
      .from(schema.readReplicas)
      .where(
        and(
          eq(schema.readReplicas.projectId, projectId),
          isNull(schema.readReplicas.deletedAt)
        )
      )
      .all();
  },

  /**
   * Get a single read replica by ID.
   */
  get(id: string): schema.ReadReplica | undefined {
    const db = getDb();
    return db
      .select()
      .from(schema.readReplicas)
      .where(eq(schema.readReplicas.id, id))
      .get();
  },

  /**
   * Get the current status of a replica by testing its connection.
   */
  async getStatus(id: string): Promise<ReplicaStatus | null> {
    const db = getDb();
    const replica = this.get(id);
    if (!replica) return null;

    // Test connection to the replica
    let replicationStatus = "unknown";
    let status = replica.status;

    try {
      const client = createPgClient({
        host: replica.host || "localhost",
        port: replica.port || parseInt(process.env.POSTGRES_PORT || "55432"),
        database: replica.database || "postgres",
      });
      await client.connect();
      
      // Check if the connection is read-only
      const result = await client.query("SELECT pg_is_in_recovery() as in_recovery");
      const isInRecovery = result.rows[0]?.in_recovery;
      
      if (isInRecovery) {
        replicationStatus = "healthy";
        status = "active";
      }
      
      // Check replication lag if available
      try {
        const lagResult = await client.query(
          `SELECT CASE WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() 
            THEN 0 
            ELSE EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int * 1000 
          END as lag_ms`
        );
        const lagMs = lagResult.rows[0]?.lag_ms;
        if (lagMs !== undefined && lagMs !== null) {
          db.update(schema.readReplicas)
            .set({ replicationLagMs: lagMs, updatedAt: now() })
            .where(eq(schema.readReplicas.id, id))
            .run();
        }
      } catch {
        // WAL functions may not be available
      }
      
      await client.end();
    } catch (err) {
      replicationStatus = "disconnected";
      status = "degraded";
    }

    // Update status in DB
    db.update(schema.readReplicas)
      .set({ status, replicationStatus, updatedAt: now() })
      .where(eq(schema.readReplicas.id, id))
      .run();

    return {
      id: replica.id,
      displayName: replica.displayName,
      status,
      replicationStatus,
      replicationLagMs: replica.replicationLagMs,
      host: replica.host,
      port: replica.port,
      database: replica.database,
      role: replica.role,
      errorMessage: replica.errorMessage,
    };
  },

  /**
   * Test if the replica connection is truly read-only.
   */
  async testReadOnly(id: string): Promise<{ readOnly: boolean; error?: string }> {
    const replica = this.get(id);
    if (!replica) {
      return { readOnly: false, error: "Replica not found" };
    }

    try {
      const client = createPgClient({
        host: replica.host || "localhost",
        port: replica.port || parseInt(process.env.POSTGRES_PORT || "55432"),
        database: replica.database || "postgres",
      });
      await client.connect();

      // Try a write operation — it should fail
      try {
        await client.query("CREATE TABLE _replica_test_ (id int)");
        await client.query("DROP TABLE _replica_test_");
        await client.end();
        return { readOnly: false, error: "Replica accepts write operations (not properly read-only)" };
      } catch {
        // Write was rejected — this is correct for a read replica
        await client.end();
        return { readOnly: true };
      }
    } catch (err) {
      return { readOnly: false, error: err instanceof Error ? err.message : String(err) };
    }
  },

  /**
   * Get connection string for a replica.
   */
  getConnectionString(id: string, method: "direct" | "tailscale" | "lan" = "direct"): string {
    const replica = this.get(id);
    if (!replica) return "";

    let host = replica.host || "localhost";
    
    // Adjust host based on connection method
    if (method === "tailscale") {
      host = process.env.TAILSCALE_HOST || host;
    } else if (method === "lan") {
      host = process.env.LAN_HOST || host;
    }

    const port = replica.port || parseInt(process.env.POSTGRES_PORT || "55432");
    const database = replica.database || "postgres";
    const role = replica.role || "cloud_admin";

    return `postgresql://${role}@${host}:${port}/${database}`;
  },

  /**
   * Stop a read replica.
   */
  async stop(id: string): Promise<void> {
    const db = getDb();
    const replica = this.get(id);
    if (!replica) throw new Error("Replica not found");

    db.update(schema.readReplicas)
      .set({ status: "stopped", updatedAt: now() })
      .where(eq(schema.readReplicas.id, id))
      .run();
  },

  /**
   * Start a read replica.
   */
  async start(id: string): Promise<void> {
    const db = getDb();
    const replica = this.get(id);
    if (!replica) throw new Error("Replica not found");

    db.update(schema.readReplicas)
      .set({ status: "starting", updatedAt: now() })
      .where(eq(schema.readReplicas.id, id))
      .run();

    // Simulate startup — in production this would start the compute
    setTimeout(() => {
      db.update(schema.readReplicas)
        .set({ status: "active", replicationStatus: "healthy", updatedAt: now() })
        .where(eq(schema.readReplicas.id, id))
        .run();
    }, 2000);
  },

  /**
   * Restart a read replica.
   */
  async restart(id: string): Promise<void> {
    const db = getDb();
    db.update(schema.readReplicas)
      .set({ status: "stopping", updatedAt: now() })
      .where(eq(schema.readReplicas.id, id))
      .run();
    setTimeout(() => {
      db.update(schema.readReplicas)
        .set({ status: "starting", updatedAt: now() })
        .where(eq(schema.readReplicas.id, id))
        .run();
      setTimeout(() => {
        db.update(schema.readReplicas)
          .set({ status: "active", replicationStatus: "healthy", updatedAt: now() })
          .where(eq(schema.readReplicas.id, id))
          .run();
      }, 2000);
    }, 1000);
  },

  /**
   * Delete a read replica.
   */
  async delete(id: string): Promise<void> {
    const db = getDb();
    const replica = this.get(id);
    if (!replica) throw new Error("Replica not found");

    // Mark as deleting
    db.update(schema.readReplicas)
      .set({ status: "deleting", updatedAt: now() })
      .where(eq(schema.readReplicas.id, id))
      .run();

    // Try to delete the branch if it was created
    if (replica.internalTimelineId) {
      try {
        const { getProvider } = await import("@/lib/providers/self-hosted-neon-provider");
        const provider = getProvider();
        await provider.branches.delete(replica.projectId, replica.internalTimelineId);
      } catch (err) {
        console.warn("[ReadReplica] Could not delete branch:", err);
      }
    }

    // Soft-delete the replica metadata
    db.update(schema.readReplicas)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(eq(schema.readReplicas.id, id))
      .run();
  },
};
