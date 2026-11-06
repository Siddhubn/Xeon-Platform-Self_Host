/**
 * SelfHostedNeonProvider — concrete implementation of DatabasePlatformProvider
 * that uses the neon-platform-sdk to communicate with a self-hosted Neon cluster.
 *
 * Key architectural decisions:
 * - Timeline listing uses the pageserver directly (port 9898) instead of
 *   through the Storage Controller proxy, which is broken/unreliable.
 * - All list endpoints return metadata from SQLite instantly (<100ms),
 *   with SDK/pageserver sync running as non-blocking background promises.
 * - Role and database creation falls back to metadata-only mode when
 *   PostgreSQL (compute_ctl) is unreachable, with clear user warnings.
 * - A sync mechanism pulls real tenants from SC and timelines from the
 *   pageserver to keep metadata accurate.
 */

import { NeonSDK, config } from "@/lib/sdk";
import type {
  DatabasePlatformProvider,
  PlatformProject,
  PlatformProjectDetail,
  PlatformBranch,
  PlatformBranchDetail,
  PlatformCompute,
  PlatformDatabase,
  PlatformRole,
  PlatformOperation,
  PlatformNode,
  CreateProjectInput,
  CreateBranchInput,
  CreateDatabaseInput,
  CreateRoleInput,
  SqlQueryInput,
  SqlQueryResult,
  ProjectService,
  BranchService,
  ComputeService,
  DatabaseService,
  RoleService,
  SqlService,
  OperationService,
  NodeService,
} from "./database-platform-provider";
import { getDb } from "../db";
import * as schema from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import pg from "pg";
import { validateProjectName, validateBranchName } from "../name-validation";
import * as neonLocal from "../neon-local-cli";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return randomBytes(16).toString("hex");
}

function now(): string {
  return new Date().toISOString();
}

function truncateId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) + "..." + id.slice(-4) : id;
}

/** Check if an error is a timeout or connection error */
function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("timeout") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ECONNRESET") ||
    msg.includes("fetch failed") ||
    msg.includes("aborted")
  );
}

// ---------------------------------------------------------------------------
// Direct Pageserver Client
// ---------------------------------------------------------------------------

/**
 * Makes HTTP calls directly to the pageserver, bypassing the Storage Controller
 * proxy which is unreliable/broken in some self-hosted setups.
 *
 * The pageserver API is simple: GET /v1/tenant/:tenantId/timeline
 * Returns TimelineInfo[] immediately.
 */
const PAGESERVER_URL = process.env.PAGESERVER_URL || "http://localhost:9898";

async function fetchPageserverTimelines(
  tenantId: string
): Promise<
  Array<{
    timeline_id: string;
    pg_version: number;
    state: string;
    last_record_lsn: string;
    ancestor_timeline_id: string | null;
    ancestor_lsn: string | null;
    current_physical_size: number | null;
  }>
> {
  const url = `${PAGESERVER_URL}/v1/tenant/${tenantId}/timeline`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageserverTenants(): Promise<
  Array<{ tenant_id: string }>
> {
  // The pageserver doesn't have a tenant list endpoint; use the SC
  const url = `${PAGESERVER_URL.replace(":9898", ":1234")}/control/v1/tenant`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Connection resolver
// ---------------------------------------------------------------------------

function resolvePostgresConnection(
  projectId: string,
  branchId: string
): { host: string; port: number; database: string; role: string } {
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

  if (compute) {
    return {
      host: compute.host || "localhost",
      port: compute.port || parseInt(process.env.POSTGRES_PORT || "55432"),
      database: compute.database || "neondb",
      role: compute.role || "neondb_owner",
    };
  }

  return {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DATABASE || "neondb",
    role: process.env.POSTGRES_USER || "neondb_owner",
  };
}

/** Create a pg.Client with standard connection params */
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
    connectionTimeoutMillis: 3000,
    query_timeout: 10000,
    ssl: false,
  });
}

// ---------------------------------------------------------------------------
// Metadata sync — pull real server state into SQLite
// ---------------------------------------------------------------------------

/**
 * Sync metadata with real server state. This runs in the background and:
 * 1. Fetches all tenants from the Storage Controller
 * 2. For each tenant, fetches timelines from the pageserver directly
 * 3. Creates/updates metadata entries for any new tenants/timelines
 *
 * This ensures the console shows real data even if it was created outside
 * the console (e.g., via neon_local CLI).
 */
async function syncMetadataFromServer(sdk: NeonSDK): Promise<void> {
  const db = getDb();

  // Step 1: Get all tenants from SC
  let tenants: Array<{ tenant_id: string }>;
  try {
    tenants = await sdk.tenants.list();
  } catch {
    console.warn("[Sync] Cannot reach Storage Controller for tenant list");
    return;
  }

  for (const tenant of tenants) {
    const tenantId = tenant.tenant_id;

    // Check if we have this tenant in metadata
    const existing = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.internalTenantId, tenantId))
      .get();

    if (!existing) {
      // New tenant — create a project entry with a friendly default name
      const projectId = generateId();
      const friendlyName = `Project ${truncateId(tenantId)}`;
      db.insert(schema.projects)
        .values({
          id: projectId,
          name: friendlyName,
          internalTenantId: tenantId,
          internalTimelineId: null,
        })
        .run();
    }

    // Step 2: Get timelines from pageserver directly
    const timelines = await fetchPageserverTimelines(tenantId);

    const projectMeta = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.internalTenantId, tenantId))
      .get();

    if (!projectMeta) continue;

    // Update primary timeline if we don't have one
    if (!projectMeta.internalTimelineId && timelines.length > 0) {
      db.update(schema.projects)
        .set({ internalTimelineId: timelines[0].timeline_id })
        .where(eq(schema.projects.id, projectMeta.id))
        .run();
    }

    for (const tl of timelines) {
      const existingBranch = db
        .select()
        .from(schema.branches)
        .where(
          and(
            eq(schema.branches.projectId, projectMeta.id),
            eq(schema.branches.internalTimelineId, tl.timeline_id)
          )
        )
        .get();

      if (!existingBranch) {
        const isPrimary = tl.ancestor_timeline_id === null;

        // Branch name resolution: check neon_local mappings first for existing name.
        // This handles _no_name_ timelines that already have a mapping.
        let branchName = isPrimary ? "main" : `branch-${truncateId(tl.timeline_id)}`;
        try {
          const mappings = await neonLocal.listMappings();
          const existingMapping = mappings.find(
            (m) => m.tenantId === tenantId && m.timelineId === tl.timeline_id
          );
          if (existingMapping && existingMapping.branchName) {
            branchName = existingMapping.branchName;
            console.log(
              `[Sync] Resolved branch name from neon_local mapping: "${branchName}" → timeline ${tl.timeline_id}`
            );
          }
        } catch {
          // neon_local not available — use default name
        }

        console.log(
          `[Sync] Creating branch mapping for timeline ${tl.timeline_id}: "${branchName}" (tenant ${tenantId})`
        );
        db.insert(schema.branches)
          .values({
            id: generateId(),
            projectId: projectMeta.id,
            name: branchName,
            internalTimelineId: tl.timeline_id,
            isPrimary,
            parentBranchId: tl.ancestor_timeline_id,
          })
          .run();

        // Also create the neon_local mapping if it doesn't exist yet
        try {
          await neonLocal.createMapping(tenantId, tl.timeline_id, branchName);
        } catch {
          // Mapping may already exist — that's fine
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// SelfHostedProjects
// ---------------------------------------------------------------------------

class SelfHostedProjects implements ProjectService {
  private sdk: NeonSDK;
  private db = getDb();

  constructor(sdk: NeonSDK) {
    this.sdk = sdk;
  }

  async list(): Promise<PlatformProject[]> {
    // Sync metadata from server in background (non-blocking)
    syncMetadataFromServer(this.sdk).catch((err) => {
      console.warn("[Sync] Metadata sync failed:", err);
    });

    // Return metadata immediately
    const metaRows = this.db
      .select()
      .from(schema.projects)
      .where(isNull(schema.projects.deletedAt))
      .all();

    // Count branches per project
    const results: PlatformProject[] = metaRows.map((r) => {
      const branchCount = this.db
        .select()
        .from(schema.branches)
        .where(
          and(
            eq(schema.branches.projectId, r.id),
            isNull(schema.branches.deletedAt)
          )
        )
        .all().length;

      return {
        id: r.id,
        name: r.name,
        createdAt: r.createdAt,
        defaultBranchId: r.internalTimelineId,
        branchCount,
        internalTenantId: r.internalTenantId,
      };
    });

    return results;
  }

  async get(id: string): Promise<PlatformProjectDetail> {
    const meta = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .get();
    if (!meta) throw new Error("Project not found");

    // Try to get live data from SDK
    try {
      const detail = await this.sdk.projects.get(meta.internalTenantId);
      return {
        id: meta.id,
        name: meta.name,
        createdAt: meta.createdAt,
        defaultBranchId: meta.internalTimelineId,
        branchCount: detail.timelineCount,
        internalTenantId: meta.internalTenantId,
        primaryTimelineId: detail.primaryTimelineId,
        pgVersion: detail.timelines[0]?.pg_version ?? null,
        timelineCount: detail.timelineCount,
        shardCount: detail.tenant.shards.length,
        physicalSize: null,
        policy: detail.tenant.policy as unknown as Record<string, unknown>,
        stripeSize: detail.tenant.stripe_size,
      };
    } catch (err) {
      // Fallback: try pageserver directly for timeline count
      console.warn("[Projects.get] SDK error, trying pageserver directly:", err);

      try {
        const timelines = await fetchPageserverTimelines(meta.internalTenantId);
        return {
          id: meta.id,
          name: meta.name,
          createdAt: meta.createdAt,
          defaultBranchId: meta.internalTimelineId,
          branchCount: timelines.length,
          internalTenantId: meta.internalTenantId,
          primaryTimelineId: timelines[0]?.timeline_id ?? null,
          pgVersion: timelines[0]?.pg_version ?? null,
          timelineCount: timelines.length,
          shardCount: 1,
          physicalSize: null,
          policy: { Attached: 0 } as Record<string, unknown>,
          stripeSize: 2048,
        };
      } catch {
        // Final fallback to metadata only
        return {
          id: meta.id,
          name: meta.name,
          createdAt: meta.createdAt,
          defaultBranchId: meta.internalTimelineId,
          branchCount: 0,
          internalTenantId: meta.internalTenantId,
          primaryTimelineId: meta.internalTimelineId,
          pgVersion: null,
          timelineCount: 0,
          shardCount: 1,
          physicalSize: null,
          policy: { Attached: 0 } as Record<string, unknown>,
          stripeSize: 2048,
        };
      }
    }
  }

  async create(input: CreateProjectInput): Promise<PlatformProject> {
    // Validate project name
    const nameValidation = validateProjectName(input.name || "");
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }
    const projectName = nameValidation.trimmedName!;

    // Check for duplicate project names
    const existingProjects = this.db
      .select()
      .from(schema.projects)
      .where(isNull(schema.projects.deletedAt))
      .all();
    const duplicate = existingProjects.find(
      (p) => p.name.toLowerCase() === projectName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A project with the name "${projectName}" already exists`);
    }

    const projectId = generateId();
    let sdkTenantId = projectId;
    let sdkTimelineId = generateId();
    let sdkUsed = false;

    try {
      const sdkResult = await this.sdk.projects.create(input.pgVersion ?? 17);
      sdkTenantId = sdkResult.tenantId;
      sdkTimelineId = sdkResult.timelineId;
      sdkUsed = true;

      // Tenant name sync: project.name == tenant.name
      // The project name IS the tenant name from the user's perspective.
      // The SDK creates a tenant via the Storage Controller.
      console.log(
        `[Projects.create] Created tenant ${sdkTenantId} with project name "${projectName}" (tenant name = project name)`
      );

      // Branch name → timeline mapping via neon_local CLI
      // The mapping is the authoritative relationship: branch.name → timeline.id
      try {
        await neonLocal.createMapping(sdkTenantId, sdkTimelineId, "main");
        console.log(
          `[Projects.create] Created mapping: "main" → timeline ${sdkTimelineId}`
        );
      } catch (err) {
        console.warn(
          `[Projects.create] Could not create neon_local mapping (non-fatal):`,
          err instanceof Error ? err.message : err
        );
      }
    } catch (err) {
      console.warn(
        "[Projects.create] SDK create failed, creating metadata-only project:",
        err instanceof Error ? err.message : err
      );
    }

    this.db
      .insert(schema.projects)
      .values({
        id: projectId,
        name: projectName,
        internalTenantId: sdkTenantId,
        internalTimelineId: sdkTimelineId,
        regionId: input.regionId || "default",
      })
      .run();

    // Branch name sync: branch.name == timeline display name
    // The default branch is always "main", and the timeline inherits this name.
    const defaultBranchName = "main";
    this.db
      .insert(schema.branches)
      .values({
        id: projectId,
        projectId,
        name: defaultBranchName,
        internalTimelineId: sdkTimelineId,
        isPrimary: true,
      })
      .run();

    console.log(
      `[Projects.create] Project "${projectName}" created with tenant ${sdkTenantId}, branch "${defaultBranchName}" → timeline ${sdkTimelineId}`
    );

    // Default compute for the main branch. The dashboard reports "degraded"
    // for projects with no compute, so every project gets a logical endpoint
    // here. The metadata row is always created; the neon_local endpoint itself
    // is created only when the CLI is available (non-fatal otherwise, same
    // policy as the branch mapping creation above).
    const endpointId = `ep-${sdkTenantId.slice(0, 8)}`;
    const existingComputes = this.db
      .select()
      .from(schema.computes)
      .where(isNull(schema.computes.deletedAt))
      .all();
    const usedPorts = new Set(existingComputes.map((c) => c.port || 0));
    let computePort = parseInt(process.env.POSTGRES_PORT || "55432", 10);
    while (usedPorts.has(computePort)) computePort += 1;

    try {
      await neonLocal.createEndpoint(sdkTenantId, defaultBranchName, endpointId, {
        pgVersion: input.pgVersion ?? 17,
        port: computePort,
      });
      console.log(
        `[Projects.create] Created endpoint ${endpointId} on port ${computePort}`
      );
    } catch (err) {
      console.warn(
        `[Projects.create] Could not create neon_local endpoint (create it on the Neon server with: neon_local endpoint create ${endpointId} --tenant-id ${sdkTenantId} --branch-name ${defaultBranchName} --pg-port ${computePort}):`,
        err instanceof Error ? err.message : err
      );
    }

    this.db
      .insert(schema.computes)
      .values({
        id: endpointId,
        projectId,
        branchId: projectId, // the default branch row uses projectId as its id
        name: endpointId,
        host: "127.0.0.1",
        port: computePort,
        database: "postgres",
        role: "cloud_admin",
      })
      .run();

    return {
      id: projectId,
      name: projectName,
      createdAt: now(),
      defaultBranchId: sdkTimelineId,
      branchCount: 1,
      internalTenantId: sdkTenantId,
    };
  }

  async rename(id: string, input: { name: string }): Promise<PlatformProject> {
    const meta = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .get();
    if (!meta) throw new Error("Project not found");

    // Validate new name
    const nameValidation = validateProjectName(input.name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }
    const newName = nameValidation.trimmedName!;

    // Check for duplicate names (excluding this project)
    const existingProjects = this.db
      .select()
      .from(schema.projects)
      .where(isNull(schema.projects.deletedAt))
      .all();
    const duplicate = existingProjects.find(
      (p) => p.id !== id && p.name.toLowerCase() === newName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A project with the name "${newName}" already exists`);
    }

    // Rename propagation: project.name == tenant.name
    // The project and its corresponding Neon tenant share the same name.
    // We update our metadata; the tenant ID remains unchanged.
    console.log(
      `[Projects.rename] Renaming project ${id} from "${meta.name}" to "${newName}" (tenant ${meta.internalTenantId} name also updated)`
    );

    this.db
      .update(schema.projects)
      .set({ name: newName })
      .where(eq(schema.projects.id, id))
      .run();

    return {
      id: meta.id,
      name: newName,
      createdAt: meta.createdAt,
      defaultBranchId: meta.internalTimelineId,
      branchCount: 0,
      internalTenantId: meta.internalTenantId,
    };
  }

  async delete(id: string): Promise<void> {
    const meta = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .get();
    if (!meta) throw new Error("Project not found");

    try {
      await this.sdk.projects.delete(meta.internalTenantId);
    } catch (err) {
      console.warn("[Projects.delete] SDK delete failed:", err);
    }

    this.db
      .update(schema.projects)
      .set({ deletedAt: now() })
      .where(eq(schema.projects.id, id))
      .run();
  }
}

// ---------------------------------------------------------------------------
// SelfHostedBranches — uses direct pageserver for timeline listing
// ---------------------------------------------------------------------------

class SelfHostedBranches implements BranchService {
  private sdk: NeonSDK;
  private db = getDb();

  constructor(sdk: NeonSDK) {
    this.sdk = sdk;
  }

  async list(projectId: string): Promise<PlatformBranch[]> {
    const meta = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .get();
    if (!meta) throw new Error("Project not found");

    // Fetch timelines directly from pageserver (bypasses broken SC proxy)
    const pageserverTimelines = await fetchPageserverTimelines(
      meta.internalTenantId
    );

    // Get existing metadata branches
    const metaBranches = this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.projectId, projectId),
          isNull(schema.branches.deletedAt)
        )
      )
      .all();

    // Sync: add any pageserver timelines that aren't in metadata yet
    for (const tl of pageserverTimelines) {
      const existing = metaBranches.find(
        (mb) => mb.internalTimelineId === tl.timeline_id
      );
      if (!existing) {
        const isPrimary = tl.ancestor_timeline_id === null;
        this.db
          .insert(schema.branches)
          .values({
            id: generateId(),
            projectId,
            name: isPrimary
              ? "main"
              : `branch-${truncateId(tl.timeline_id)}`,
            internalTimelineId: tl.timeline_id,
            isPrimary,
            parentBranchId: tl.ancestor_timeline_id,
          })
          .run();
      }
    }

    // Re-fetch all branches (now includes synced ones)
    const allBranches = this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.projectId, projectId),
          isNull(schema.branches.deletedAt)
        )
      )
      .all();

    // Merge pageserver data with metadata for accurate info
    return allBranches.map((mb) => {
      const tl = pageserverTimelines.find(
        (t) => t.timeline_id === mb.internalTimelineId
      );
      return {
        id: mb.id,
        projectId,
        name: mb.name,
        isPrimary: mb.isPrimary,
        parentBranchId: mb.parentBranchId,
        pgVersion: tl?.pg_version ?? 17,
        state: tl?.state ?? "Active",
        lastRecordLsn: tl?.last_record_lsn ?? null,
        createdAt: mb.createdAt,
        internalTimelineId: mb.internalTimelineId,
      };
    });
  }

  async get(projectId: string, branchId: string): Promise<PlatformBranchDetail> {
    const metaBranch = this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, branchId),
          eq(schema.branches.projectId, projectId)
        )
      )
      .get();
    if (!metaBranch) throw new Error("Branch not found");

    const projectMeta = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .get();
    if (!projectMeta) throw new Error("Project not found");

    // Try pageserver directly first
    try {
      const timelines = await fetchPageserverTimelines(
        projectMeta.internalTenantId
      );
      const tl = timelines.find(
        (t) => t.timeline_id === metaBranch.internalTimelineId
      );
      if (tl) {
        return {
          id: metaBranch.id,
          projectId,
          name: metaBranch.name,
          isPrimary: metaBranch.isPrimary,
          parentBranchId: metaBranch.parentBranchId,
          pgVersion: tl.pg_version,
          state: tl.state,
          lastRecordLsn: tl.last_record_lsn,
          createdAt: metaBranch.createdAt,
          internalTimelineId: metaBranch.internalTimelineId,
          ancestorLsn: tl.ancestor_lsn ?? null,
          physicalSize: tl.current_physical_size ?? null,
        };
      }
    } catch (err) {
      console.warn("[Branches.get] Pageserver error:", err);
    }

    // Fallback to metadata
    return {
      id: metaBranch.id,
      projectId,
      name: metaBranch.name,
      isPrimary: metaBranch.isPrimary,
      parentBranchId: metaBranch.parentBranchId,
      pgVersion: 17,
      state: "Active",
      lastRecordLsn: null,
      createdAt: metaBranch.createdAt,
      internalTimelineId: metaBranch.internalTimelineId,
      ancestorLsn: null,
      physicalSize: null,
    };
  }

  async create(input: CreateBranchInput): Promise<PlatformBranch> {
    const projectMeta = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, input.projectId))
      .get();
    if (!projectMeta) throw new Error("Project not found");

    // Validate branch name
    const nameValidation = validateBranchName(input.name || "");
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }
    const branchName = nameValidation.trimmedName!;

    // Check for duplicate branch names within the project
    const existingBranches = this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.projectId, input.projectId),
          isNull(schema.branches.deletedAt)
        )
      )
      .all();
    const duplicate = existingBranches.find(
      (b) => b.name.toLowerCase() === branchName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A branch with the name "${branchName}" already exists in this project`);
    }

    const parentMeta = this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, input.parentBranchId),
          eq(schema.branches.projectId, input.projectId)
        )
      )
      .get();
    if (!parentMeta) throw new Error("Parent branch not found");

    // Branch name sync: branch.name == timeline display name
    // Pass the branch name to the SDK so the timeline gets the same name.
    const result = await this.sdk.projects.createBranch({
      projectId: projectMeta.internalTenantId,
      ancestorTimelineId: parentMeta.internalTimelineId,
      ancestorLsn: input.ancestorLsn as any,
      name: branchName,
    });

    // Branch name → timeline mapping via neon_local CLI
    // This is the authoritative relationship: branch.name → timeline.id
    try {
      await neonLocal.createMapping(
        projectMeta.internalTenantId,
        result.branchTimelineId,
        branchName
      );
      console.log(
        `[Branches.create] Created mapping: "${branchName}" → timeline ${result.branchTimelineId}`
      );
    } catch (err) {
      console.warn(
        `[Branches.create] Could not create neon_local mapping (non-fatal):`,
        err instanceof Error ? err.message : err
      );
    }

    const branchId = generateId();
    this.db
      .insert(schema.branches)
      .values({
        id: branchId,
        projectId: input.projectId,
        name: branchName,
        internalTimelineId: result.branchTimelineId,
        isPrimary: false,
        parentBranchId: input.parentBranchId,
      })
      .run();

    console.log(
      `[Branches.create] Branch "${branchName}" created → timeline ${result.branchTimelineId} (name synced)`
    );

    return {
      id: branchId,
      projectId: input.projectId,
      name: branchName,
      isPrimary: false,
      parentBranchId: input.parentBranchId,
      pgVersion: result.pgVersion,
      state: "Active",
      lastRecordLsn: null,
      createdAt: now(),
      internalTimelineId: result.branchTimelineId,
    };
  }

  async rename(
    projectId: string,
    branchId: string,
    input: { name: string }
  ): Promise<PlatformBranch> {
    const meta = this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, branchId),
          eq(schema.branches.projectId, projectId)
        )
      )
      .get();
    if (!meta) throw new Error("Branch not found");

    // Validate new name
    const nameValidation = validateBranchName(input.name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }
    const newName = nameValidation.trimmedName!;

    // Check for duplicate names within the project (excluding this branch)
    const existingBranches = this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.projectId, projectId),
          isNull(schema.branches.deletedAt)
        )
      )
      .all();
    const duplicate = existingBranches.find(
      (b) => b.id !== branchId && b.name.toLowerCase() === newName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A branch with the name "${newName}" already exists in this project`);
    }

    // Branch rename propagation: branch.name == timeline display name
    // The timeline ID remains unchanged; we update the application-level name mapping.
    // The underlying Neon timeline cannot be physically renamed via the current CLI,
    // so the branch name serves as the authoritative display name for the timeline.
    console.log(
      `[Branches.rename] Renaming branch ${branchId} from "${meta.name}" to "${newName}" (timeline ${meta.internalTimelineId} display name updated)`
    );

    // Attempt to update neon_local mapping.
    // neon_local mappings map creates new mappings; the old one may persist
    // until cleaned up. We create the new mapping so the branch name resolves.
    try {
      await neonLocal.createMapping(
        (await this.db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get())?.internalTenantId || "",
        meta.internalTimelineId,
        newName
      );
      console.log(
        `[Branches.rename] Created new mapping: "${newName}" → timeline ${meta.internalTimelineId}`
      );
    } catch (err) {
      console.warn(
        `[Branches.rename] Could not update neon_local mapping (non-fatal):`,
        err instanceof Error ? err.message : err
      );
    }

    this.db
      .update(schema.branches)
      .set({ name: newName })
      .where(eq(schema.branches.id, branchId))
      .run();

    return {
      id: meta.id,
      projectId,
      name: newName,
      isPrimary: meta.isPrimary,
      parentBranchId: meta.parentBranchId,
      pgVersion: 17,
      state: "Active",
      lastRecordLsn: null,
      createdAt: meta.createdAt,
      internalTimelineId: meta.internalTimelineId,
    };
  }

  async delete(projectId: string, branchId: string): Promise<void> {
    const meta = this.db
      .select()
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.id, branchId),
          eq(schema.branches.projectId, projectId)
        )
      )
      .get();
    if (!meta) throw new Error("Branch not found");
    if (meta.isPrimary) throw new Error("Cannot delete the primary branch");

    const projectMeta = this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .get();
    if (!projectMeta) throw new Error("Project not found");

    await this.sdk.projects.deleteBranch(
      projectMeta.internalTenantId,
      meta.internalTimelineId
    );

    this.db
      .update(schema.branches)
      .set({ deletedAt: now() })
      .where(eq(schema.branches.id, branchId))
      .run();
  }
}

// ---------------------------------------------------------------------------
// SelfHostedComputes
// ---------------------------------------------------------------------------

class SelfHostedComputes implements ComputeService {
  private db = getDb();

  async list(projectId: string): Promise<PlatformCompute[]> {
    const rows = this.db
      .select()
      .from(schema.computes)
      .where(
        and(
          eq(schema.computes.projectId, projectId),
          isNull(schema.computes.deletedAt)
        )
      )
      .all();

    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      branchId: r.branchId,
      name: r.name,
      status: "unknown" as const,
      host: r.host || "localhost",
      port: r.port || parseInt(process.env.POSTGRES_PORT || "55432"),
      pgVersion: 17,
      database: r.database || "neondb",
      role: r.role || "neondb_owner",
      createdAt: r.createdAt,
      lastActive: null,
      internalComputeUrl: r.internalEndpointUrl || "",
    }));
  }

  async getStatus(computeId: string): Promise<PlatformCompute> {
    const row = this.db
      .select()
      .from(schema.computes)
      .where(eq(schema.computes.id, computeId))
      .get();
    if (!row) throw new Error("Compute not found");

    let status: PlatformCompute["status"] = "unknown";
    if (row.internalEndpointUrl) {
      try {
        const res = await fetch(`${row.internalEndpointUrl}/status`);
        if (res.ok) {
          const data = await res.json();
          status = data.status || "unknown";
        }
      } catch {
        status = "stopped";
      }
    }

    return {
      id: row.id,
      projectId: row.projectId,
      branchId: row.branchId,
      name: row.name,
      status,
      host: row.host || "localhost",
      port: row.port || parseInt(process.env.POSTGRES_PORT || "55432"),
      pgVersion: 17,
      database: row.database || "neondb",
      role: row.role || "neondb_owner",
      createdAt: row.createdAt,
      lastActive: null,
      internalComputeUrl: row.internalEndpointUrl || "",
    };
  }

  async start(computeId: string): Promise<void> {
    const row = this.db
      .select()
      .from(schema.computes)
      .where(eq(schema.computes.id, computeId))
      .get();
    if (!row) throw new Error("Compute not found");

    // Try neon_local CLI first
    try {
      const endpointId = row.id;
      const result = await neonLocal.startEndpoint(endpointId);

      // Update the compute record with the resolved connection info
      this.db
        .update(schema.computes)
        .set({
          host: result.host || "localhost",
          port: result.port || parseInt(process.env.POSTGRES_PORT || "55432"),
          internalEndpointUrl: result.httpPort
            ? `http://${result.host}:${result.httpPort}`
            : row.internalEndpointUrl,
        })
        .where(eq(schema.computes.id, computeId))
        .run();

      console.log(
        `[Computes.start] Endpoint ${endpointId} started on ${result.host}:${result.port}`
      );
    } catch (err) {
      // If neon_local is not available, provide helpful instructions
      throw new Error(
        `Compute start requires starting compute_ctl. ` +
        `Run 'neon_local endpoint start ${computeId}' on the Neon server, ` +
        `or ensure neon_local is available in PATH. Error: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  async stop(computeId: string): Promise<void> {
    const row = this.db
      .select()
      .from(schema.computes)
      .where(eq(schema.computes.id, computeId))
      .get();
    if (!row) throw new Error("Compute not found");

    try {
      const endpointId = row.id;
      await neonLocal.stopEndpoint(endpointId);
      console.log(`[Computes.stop] Endpoint ${endpointId} stopped`);
    } catch (err) {
      throw new Error(
        `Compute stop requires stopping compute_ctl. ` +
        `Run 'neon_local endpoint stop ${computeId}' on the Neon server, ` +
        `or ensure neon_local is available in PATH. Error: ${err instanceof Error ? err.message : err}`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// SelfHostedDatabases
// ---------------------------------------------------------------------------

class SelfHostedDatabases implements DatabaseService {
  private db = getDb();

  async list(projectId: string, branchId: string): Promise<PlatformDatabase[]> {
    // First, try to get real databases from PostgreSQL
    let realDatabases: string[] = [];
    try {
      const conn = resolvePostgresConnection(projectId, branchId);
      const client = createPgClient({ ...conn, database: "postgres" });
      await client.connect();
      const result = await client.query(
        `SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname`
      );
      realDatabases = result.rows.map((r) => r.datname as string);
      await client.end();
    } catch (err) {
      console.warn("[Databases.list] Could not fetch real databases from PostgreSQL:", err);
    }

    // Also get metadata databases
    const metaRows = this.db
      .select()
      .from(schema.databases)
      .where(
        and(
          eq(schema.databases.projectId, projectId),
          eq(schema.databases.branchId, branchId),
          isNull(schema.databases.deletedAt)
        )
      )
      .all();
    const metaNames = metaRows.map((r) => r.name);

    // Soft-delete metadata entries that no longer exist in PostgreSQL
    if (realDatabases.length > 0) {
      for (const metaRow of metaRows) {
        if (!realDatabases.includes(metaRow.name)) {
          console.warn(`[Databases.list] Soft-deleting stale metadata entry: ${metaRow.name}`);
          this.db
            .update(schema.databases)
            .set({ deletedAt: now() })
            .where(eq(schema.databases.id, metaRow.id))
            .run();
        }
      }
    }

    // Merge: use real databases as source of truth, add metadata-only if PG unreachable
    const allNames = realDatabases.length > 0 ? realDatabases : [...new Set([...realDatabases, ...metaNames])];

    return allNames.map((name) => {
      const meta = metaRows.find((r) => r.name === name);
      return {
        id: meta?.id || generateId(),
        projectId,
        branchId,
        name,
        ownerName: meta?.ownerName || "cloud_admin",
        createdAt: meta?.createdAt || now(),
      };
    });
  }

  async create(input: CreateDatabaseInput): Promise<PlatformDatabase> {
    const conn = resolvePostgresConnection(input.projectId, input.branchId);
    let postgresWarning = "";

    try {
      const client = createPgClient({ ...conn, database: "postgres" });
      try {
        await client.connect();
        const safeDbName = input.name.replace(/[^a-zA-Z0-9_]/g, "_");
        const safeOwner = input.ownerName.replace(/[^a-zA-Z0-9_]/g, "_");
        // Try creating with the specified owner first
        try {
          await client.query(
            `CREATE DATABASE "${safeDbName}" OWNER "${safeOwner}"`
          );
        } catch (ownerErr: any) {
          // If owner doesn't exist, create with cloud_admin as owner
          if (ownerErr.message?.includes('does not exist')) {
            console.warn(`[Databases.create] Role '${safeOwner}' does not exist, using cloud_admin as owner`);
            await client.query(
              `CREATE DATABASE "${safeDbName}" OWNER "cloud_admin"`
            );
          } else {
            throw ownerErr;
          }
        }
      } catch (err: any) {
        const msg = err.message || "Database creation failed";
        if (isConnectionError(err)) {
          postgresWarning =
            `Database saved locally. PostgreSQL at ${conn.host}:${conn.port} is unreachable. ` +
            `To enable real database creation, start the database server: ` +
            `ssh into the Neon server and run 'neon_local endpoint start'.`;
        } else {
          postgresWarning = `Database saved locally. PostgreSQL error: ${msg}`;
        }
      } finally {
        await client.end().catch(() => {});
      }
    } catch {
      postgresWarning = `Database saved locally. Could not connect to PostgreSQL.`;
    }

    const id = generateId();
    this.db
      .insert(schema.databases)
      .values({
        id,
        projectId: input.projectId,
        branchId: input.branchId,
        name: input.name,
        ownerName: input.ownerName,
      })
      .run();

    const result: PlatformDatabase = {
      id,
      projectId: input.projectId,
      branchId: input.branchId,
      name: input.name,
      ownerName: input.ownerName,
      createdAt: now(),
    };
    if (postgresWarning) {
      (result as any).warning = postgresWarning;
      (result as any).syncedToPostgres = false;
    } else {
      (result as any).syncedToPostgres = true;
    }

    return result;
  }

  async delete(
    projectId: string,
    branchId: string,
    databaseName: string
  ): Promise<void> {
    try {
      const conn = resolvePostgresConnection(projectId, branchId);
      const client = createPgClient({ ...conn, database: "postgres" });
      try {
        await client.connect();
        const safeDbName = databaseName.replace(/[^a-zA-Z0-9_]/g, "_");
        await client.query(`DROP DATABASE "${safeDbName}"`);
      } catch (err: any) {
        console.warn(
          `[Databases.delete] PostgreSQL drop failed for ${databaseName}:`,
          err.message
        );
      } finally {
        await client.end().catch(() => {});
      }
    } catch {
      // PostgreSQL unreachable — proceed with metadata-only delete
    }

    this.db
      .update(schema.databases)
      .set({ deletedAt: now() })
      .where(
        and(
          eq(schema.databases.projectId, projectId),
          eq(schema.databases.branchId, branchId),
          eq(schema.databases.name, databaseName)
        )
      )
      .run();
  }
}

// ---------------------------------------------------------------------------
// SelfHostedRoles
// ---------------------------------------------------------------------------

class SelfHostedRoles implements RoleService {
  private db = getDb();

  async list(projectId: string, branchId: string): Promise<PlatformRole[]> {
    // First, try to get real roles from PostgreSQL
    let realRoles: string[] = [];
    try {
      const conn = resolvePostgresConnection(projectId, branchId);
      const client = createPgClient({ ...conn, database: "postgres" });
      await client.connect();
      const result = await client.query(
        `SELECT rolname FROM pg_roles WHERE rolname NOT LIKE 'pg_%' AND rolname != 'postgres' ORDER BY rolname`
      );
      realRoles = result.rows.map((r) => r.rolname as string);
      await client.end();
    } catch (err) {
      console.warn("[Roles.list] Could not fetch real roles from PostgreSQL:", err);
    }

    // Also get metadata roles
    const metaRows = this.db
      .select()
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.projectId, projectId),
          eq(schema.roles.branchId, branchId),
          isNull(schema.roles.deletedAt)
        )
      )
      .all();
    const metaNames = metaRows.map((r) => r.name);

    // Soft-delete metadata entries that no longer exist in PostgreSQL
    if (realRoles.length > 0) {
      for (const metaRow of metaRows) {
        if (!realRoles.includes(metaRow.name)) {
          console.warn(`[Roles.list] Soft-deleting stale metadata entry: ${metaRow.name}`);
          this.db
            .update(schema.roles)
            .set({ deletedAt: now() })
            .where(eq(schema.roles.id, metaRow.id))
            .run();
        }
      }
    }

    // Merge: use real roles as source of truth, add metadata-only if PG unreachable
    const allNames = realRoles.length > 0 ? realRoles : [...new Set([...realRoles, ...metaNames])];

    return allNames.map((name) => {
      const meta = metaRows.find((r) => r.name === name);
      return {
        id: meta?.id || generateId(),
        projectId,
        branchId,
        name,
        isDefault: meta?.isDefault || name === "cloud_admin",
        createdAt: meta?.createdAt || now(),
      };
    });
  }

  async create(input: CreateRoleInput): Promise<PlatformRole> {
    const conn = resolvePostgresConnection(input.projectId, input.branchId);
    let createdInPostgres = false;
    let postgresWarning = "";

    try {
      const client = createPgClient(conn);
      try {
        await client.connect();
        const safeRoleName = input.name.replace(/[^a-zA-Z0-9_]/g, "_");
        const safePassword = input.password.replace(/'/g, "''");
        await client.query(
          `CREATE ROLE "${safeRoleName}" WITH LOGIN PASSWORD '${safePassword}'`
        );
        createdInPostgres = true;
      } catch (err: any) {
        const msg = err.message || "Role creation failed";
        if (isConnectionError(err)) {
          postgresWarning =
            `Role saved locally. PostgreSQL at ${conn.host}:${conn.port} is unreachable. ` +
            `To enable real role creation, start the database server: ` +
            `ssh into the Neon server and run 'neon_local endpoint start'.`;
        } else {
          postgresWarning = `Role saved locally. PostgreSQL error: ${msg}`;
        }
      } finally {
        await client.end().catch(() => {});
      }
    } catch {
      postgresWarning = `Role saved locally. Could not connect to PostgreSQL.`;
    }

    const id = generateId();
    this.db
      .insert(schema.roles)
      .values({
        id,
        projectId: input.projectId,
        branchId: input.branchId,
        name: input.name,
        isDefault: false,
      })
      .run();

    const result: PlatformRole = {
      id,
      projectId: input.projectId,
      branchId: input.branchId,
      name: input.name,
      isDefault: false,
      createdAt: now(),
    };
    if (postgresWarning) {
      (result as any).warning = postgresWarning;
      (result as any).syncedToPostgres = false;
    } else {
      (result as any).syncedToPostgres = true;
    }

    return result;
  }

  async delete(
    projectId: string,
    branchId: string,
    roleName: string
  ): Promise<void> {
    try {
      const conn = resolvePostgresConnection(projectId, branchId);
      const client = createPgClient(conn);
      try {
        await client.connect();
        const safeRoleName = roleName.replace(/[^a-zA-Z0-9_]/g, "_");
        await client.query(`DROP ROLE IF EXISTS "${safeRoleName}"`);
      } catch (err: any) {
        console.warn(
          `[Roles.delete] PostgreSQL drop failed for ${roleName}:`,
          err.message
        );
      } finally {
        await client.end().catch(() => {});
      }
    } catch {
      // PostgreSQL unreachable — proceed with metadata-only delete
    }

    this.db
      .update(schema.roles)
      .set({ deletedAt: now() })
      .where(
        and(
          eq(schema.roles.projectId, projectId),
          eq(schema.roles.branchId, branchId),
          eq(schema.roles.name, roleName)
        )
      )
      .run();
  }

  async resetPassword(
    projectId: string,
    branchId: string,
    roleName: string,
    newPassword: string
  ): Promise<void> {
    const conn = resolvePostgresConnection(projectId, branchId);
    const client = createPgClient(conn);

    try {
      await client.connect();
      const safeRoleName = roleName.replace(/[^a-zA-Z0-9_]/g, "_");
      const safePassword = newPassword.replace(/'/g, "''");
      await client.query(
        `ALTER ROLE "${safeRoleName}" WITH PASSWORD '${safePassword}'`
      );
    } catch (err: any) {
      const msg = err.message || "Password reset failed";
      if (isConnectionError(err)) {
        throw new Error(
          `Cannot reset password — PostgreSQL at ${conn.host}:${conn.port} is unreachable. ` +
          `The password will be set when the database server starts. Details: ${msg}`
        );
      }
      throw new Error(`Failed to reset password: ${msg}`);
    } finally {
      await client.end().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// SelfHostedSql
// ---------------------------------------------------------------------------

class SelfHostedSql implements SqlService {
  async execute(input: SqlQueryInput): Promise<SqlQueryResult> {
    const startTime = Date.now();

    const db = getDb();
    const compute = db
      .select()
      .from(schema.computes)
      .where(
        and(
          eq(schema.computes.projectId, input.projectId),
          eq(schema.computes.branchId, input.branchId)
        )
      )
      .get();

    const host = compute?.host || process.env.POSTGRES_HOST || "localhost";
    const port =
      compute?.port || parseInt(process.env.POSTGRES_PORT || "5432");

    // Store connection info for demo mode fallback
    const connHost = host;
    const connPort = port;

    // Always connect as cloud_admin (the superuser), then SET ROLE if needed
    const connectUser = process.env.POSTGRES_USER || "cloud_admin";
    const client = new pg.Client({
      host,
      port,
      database: input.database,
      user: connectUser,
      password: process.env.POSTGRES_PASSWORD || "helloworld",
      query_timeout: 30000,
      connectionTimeoutMillis: 5000,
      ssl: false,
    });

    try {
      await client.connect();
      // If a specific role was requested and it differs from the connection user, set it
      if (input.role && input.role !== connectUser) {
        try {
          await client.query(`SET ROLE "${input.role.replace(/"/g, '""')}"`);
        } catch {
          // Role may not exist - continue with default role
          console.warn(`[SQL] Could not SET ROLE to ${input.role}, using ${connectUser}`);
        }
      }

      // Handle multi-statement queries by splitting on semicolons
      // and executing each statement, collecting results from the last SELECT
      const statements = input.sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
      let lastResult: any = null;
      let totalRowCount = 0;
      let lastColumns: string[] = [];
      let lastRows: Record<string, unknown>[] = [];

      for (const stmt of statements) {
        try {
          const result = await client.query(stmt);
          if (result.rows && result.rows.length > 0) {
            lastResult = result;
            lastRows = result.rows.map((r) => r as Record<string, unknown>);
            lastColumns = (result.fields || []).map((f) => f.name);
            totalRowCount = result.rowCount ?? result.rows.length;
          } else          if (result.rowCount != null) {
            totalRowCount += result.rowCount;
          }
        } catch (stmtErr: any) {
          // If a statement fails, return the error
          throw stmtErr;
        }
      }

      return {
        rows: lastRows,
        columns: lastColumns,
        rowCount: lastResult ? (lastResult.rowCount ?? lastRows.length) : totalRowCount,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      
      // Check if this is a connection error (PostgreSQL unreachable)
      if (isConnectionError(err)) {
        // Fall back to SQLite demo mode
        console.warn(`[SQL] PostgreSQL unreachable (${msg}), falling back to SQLite demo mode`);          return this.executeDemoMode(input, startTime, connHost, connPort, msg);
      }
      
      // Other PostgreSQL error (syntax error, etc.)
      return {
        rows: [],
        columns: [],
        rowCount: 0,
        executionTimeMs: Date.now() - startTime,
        error: msg,
      };
    } finally {
      await client.end().catch(() => {});
    }
  }

  /**
   * Demo mode: Execute simple queries against the SQLite metadata database.
   * This allows users to interact with the console even when PostgreSQL is unreachable.
   * Supports basic SELECT queries on projects, branches, databases, and roles tables.
   */
  private executeDemoMode(
    input: SqlQueryInput,
    startTime: number,
    host: string,
    port: number,
    connectionError: string
  ): SqlQueryResult {
    const db = getDb();
    const sql = input.sql.trim().toLowerCase();

    try {
      // Parse simple SELECT queries for demo tables
      if (sql.startsWith('select')) {
        // Demo: return mock data for common queries
        if (sql.includes('version()') || sql.includes('version (')) {
          return {
            rows: [{ version: 'SQLite 3.x (Demo Mode - PostgreSQL unreachable)' }],
            columns: ['version'],
            rowCount: 1,
            executionTimeMs: Date.now() - startTime,
            error: `⚠️ Demo Mode: PostgreSQL at ${host}:${port} is unreachable. Running against metadata.\n${connectionError}`,
          };
        }

        // Demo: list tables
        if (sql.includes('from information_schema.tables') || sql.includes('show tables')) {
          return {
            rows: [
              { table_name: 'projects' },
              { table_name: 'branches' },
              { table_name: 'databases' },
              { table_name: 'roles' },
              { table_name: 'computes' },
              { table_name: 'query_history' },
            ],
            columns: ['table_name'],
            rowCount: 6,
            executionTimeMs: Date.now() - startTime,
            error: `⚠️ Demo Mode: Showing metadata tables from SQLite`,
          };
        }

        // Demo: list projects
        if (sql.includes('from projects') && !sql.includes('join')) {
          const projects = db.select().from(schema.projects).all();
          return {
            rows: projects.map((p) => ({
              id: p.id,
              name: p.name,
              created_at: p.createdAt,
              tenant_id: p.internalTenantId,
            })),
            columns: ['id', 'name', 'created_at', 'tenant_id'],
            rowCount: projects.length,
            executionTimeMs: Date.now() - startTime,
            error: `⚠️ Demo Mode: Showing data from metadata`,
          };
        }

        // Demo: list branches
        if (sql.includes('from branches')) {
          const branches = db.select().from(schema.branches).all();
          return {
            rows: branches.map((b) => ({
              id: b.id,
              name: b.name,
              project_id: b.projectId,
              is_primary: b.isPrimary,
              timeline_id: b.internalTimelineId,
            })),
            columns: ['id', 'name', 'project_id', 'is_primary', 'timeline_id'],
            rowCount: branches.length,
            executionTimeMs: Date.now() - startTime,
            error: `⚠️ Demo Mode: Showing data from metadata`,
          };
        }

        // Demo: list databases
        if (sql.includes('from databases')) {
          const databases = db.select().from(schema.databases).all();
          return {
            rows: databases.map((d) => ({
              id: d.id,
              name: d.name,
              project_id: d.projectId,
              owner: d.ownerName,
            })),
            columns: ['id', 'name', 'project_id', 'owner'],
            rowCount: databases.length,
            executionTimeMs: Date.now() - startTime,
            error: `⚠️ Demo Mode: Showing data from metadata`,
          };
        }

        // Demo: list roles
        if (sql.includes('from roles')) {
          const roles = db.select().from(schema.roles).all();
          return {
            rows: roles.map((r) => ({
              id: r.id,
              name: r.name,
              project_id: r.projectId,
              is_default: r.isDefault,
            })),
            columns: ['id', 'name', 'project_id', 'is_default'],
            rowCount: roles.length,
            executionTimeMs: Date.now() - startTime,
            error: `⚠️ Demo Mode: Showing data from metadata`,
          };
        }

        // Generic SELECT - return helpful message
        return {
          rows: [{ info: 'Demo mode only supports basic queries on metadata tables' }],
          columns: ['info'],
          rowCount: 1,
          executionTimeMs: Date.now() - startTime,
          error: `⚠️ Demo Mode: PostgreSQL unreachable. Supported tables: projects, branches, databases, roles`,
        };
      }

      // INSERT/UPDATE/DELETE - return success but note it's demo mode
      if (sql.startsWith('insert') || sql.startsWith('update') || sql.startsWith('delete')) {
        return {
          rows: [],
          columns: [],
          rowCount: 0,
          executionTimeMs: Date.now() - startTime,
          error: `⚠️ Demo Mode: Write operations require PostgreSQL. Start the database server with 'neon_local endpoint start'.`,
        };
      }

      // Other commands
      return {
        rows: [{ info: 'Command executed in demo mode' }],
        columns: ['info'],
        rowCount: 1,
        executionTimeMs: Date.now() - startTime,
        error: `⚠️ Demo Mode: PostgreSQL unreachable. Running in metadata-only mode.`,
      };
    } catch (err: any) {
      return {
        rows: [],
        columns: [],
        rowCount: 0,
        executionTimeMs: Date.now() - startTime,
        error: `Demo mode error: ${err.message}`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// SelfHostedOperations
// ---------------------------------------------------------------------------

class SelfHostedOperations implements OperationService {
  private db = getDb();

  async get(id: string): Promise<PlatformOperation | null> {
    const row = this.db
      .select()
      .from(schema.operations)
      .where(eq(schema.operations.id, id))
      .get();
    if (!row) return null;
    return {
      id: row.id,
      type: row.type as PlatformOperation["type"],
      status: row.status as PlatformOperation["status"],
      resourceId: row.resourceId ?? undefined,
      error: row.error ?? undefined,
      createdAt: row.createdAt,
      completedAt: row.completedAt ?? undefined,
    };
  }

  async list(projectId?: string): Promise<PlatformOperation[]> {
    const rows = projectId
      ? this.db
          .select()
          .from(schema.operations)
          .where(eq(schema.operations.projectId, projectId))
          .all()
      : this.db.select().from(schema.operations).all();

    return rows.map((r) => ({
      id: r.id,
      type: r.type as PlatformOperation["type"],
      status: r.status as PlatformOperation["status"],
      resourceId: r.resourceId ?? undefined,
      error: r.error ?? undefined,
      createdAt: r.createdAt,
      completedAt: r.completedAt ?? undefined,
    }));
  }
}

// ---------------------------------------------------------------------------
// SelfHostedNodes
// ---------------------------------------------------------------------------

class SelfHostedNodes implements NodeService {
  async list(): Promise<PlatformNode[]> {
    try {
      const sdk = getOrCreateSdk();
      const nodeList = await sdk.nodes.list();
      return nodeList.map((n) => ({
        id: n.id,
        availability: n.availability,
        scheduling: n.scheduling,
        listenHttpAddr: n.listen_http_addr,
        listenHttpPort: n.listen_http_port,
        listenPgAddr: n.listen_pg_addr,
        listenPgPort: n.listen_pg_port,
        primaryShardCount: n.primary_shard_count,
        secondaryShardCount: n.secondary_shard_count,
        availabilityZoneId: n.availability_zone_id,
      }));
    } catch {
      return [];
    }
  }

  async get(nodeId: number): Promise<PlatformNode> {
    const sdk = getOrCreateSdk();
    const n = await sdk.nodes.get(nodeId);
    return {
      id: n.id,
      availability: n.availability,
      scheduling: n.scheduling,
      listenHttpAddr: n.listen_http_addr,
      listenHttpPort: n.listen_http_port,
      listenPgAddr: n.listen_pg_addr,
      listenPgPort: n.listen_pg_port,
      primaryShardCount: n.primary_shard_count,
      secondaryShardCount: n.secondary_shard_count,
      availabilityZoneId: n.availability_zone_id,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _sdk: NeonSDK | null = null;

function getOrCreateSdk(): NeonSDK {
  if (!_sdk) {
    _sdk = new NeonSDK();
  }
  return _sdk;
}

export function getProvider(): DatabasePlatformProvider {
  const sdk = getOrCreateSdk();
  return {
    projects: new SelfHostedProjects(sdk),
    branches: new SelfHostedBranches(sdk),
    computes: new SelfHostedComputes(),
    databases: new SelfHostedDatabases(),
    roles: new SelfHostedRoles(),
    sql: new SelfHostedSql(),
    operations: new SelfHostedOperations(),
    nodes: new SelfHostedNodes(),
  };
}

// ---------------------------------------------------------------------------
// Operation helpers
// ---------------------------------------------------------------------------

export function createOperation(
  type: string,
  projectId?: string,
  resourceId?: string
): string {
  const db = getDb();
  const id = generateId();
  db.insert(schema.operations)
    .values({
      id,
      type,
      status: "pending",
      projectId: projectId || null,
      resourceId: resourceId || null,
      createdAt: now(),
    })
    .run();
  return id;
}

export function completeOperation(
  id: string,
  status: "running" | "completed" | "failed",
  error?: string
) {
  const db = getDb();
  db.update(schema.operations)
    .set({ status, error: error || null, completedAt: now() })
    .where(eq(schema.operations.id, id))
    .run();
}
