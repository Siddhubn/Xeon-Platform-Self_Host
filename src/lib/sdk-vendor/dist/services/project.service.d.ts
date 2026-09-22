import type { TenantService } from "./tenant.service.js";
import type { TimelineService } from "./timeline.service.js";
import type { TenantId, TenantInfo, TenantDescribeResponse, TenantAttachmentStatus, PlacementPolicy } from "../types/tenant.js";
import type { TimelineId, TimelineInfo, TimelineCreateResponseStorcon, TenantTimelineDescribeResponse, Lsn } from "../types/timeline.js";
/**
 * The result of a successful sdk.projects.create() call.
 *
 * A Project is the pairing of one Tenant (storage) with one Bootstrap Timeline
 * (the initial Postgres branch). Both are created atomically — if timeline
 * creation fails the tenant is automatically removed so no orphan exists.
 */
export interface ProjectCreateResult {
    /** The 32-character hex tenant identifier. */
    readonly tenantId: TenantId;
    /** Live pageserver state of the created tenant. */
    readonly tenant: TenantInfo;
    /** The 32-character hex timeline identifier. */
    readonly timelineId: TimelineId;
    /** Storage Controller response from the timeline creation. */
    readonly timeline: TimelineCreateResponseStorcon;
}
/**
 * A lightweight summary of a Project, returned by sdk.projects.list().
 *
 * Derived from TenantDescribeResponse (admin surface) and the tenant's
 * timeline list. The primary timeline is the first timeline returned by
 * sdk.timelines.list(); for newly created projects this is the Bootstrap
 * timeline.
 *
 * Tenants with no timelines are included with timelineId and pgVersion as null.
 */
export interface ProjectSummary {
    /** Project ID — same as the underlying Tenant ID. */
    readonly projectId: TenantId;
    readonly tenantId: TenantId;
    /** ID of the primary (first) timeline, or null if none exists. */
    readonly timelineId: TimelineId | null;
    /** Current attachment status from the administrative surface. */
    readonly attachmentStatus: TenantAttachmentStatus | null;
    /** Live Postgres major version from the primary timeline, or null. */
    readonly pgVersion: number | null;
    /** Total number of timelines owned by this project. */
    readonly timelineCount: number;
    /** Physical size of all layer files across shards (bytes), or null if unavailable. */
    readonly physicalSize: number | null;
    /** Placement policy for the tenant. */
    readonly policy: PlacementPolicy;
    /** Stripe size for sharded tenants. */
    readonly stripeSize: number;
}
/**
 * Full project details returned by sdk.projects.get(projectId).
 *
 * Combines the administrative tenant description with per-shard timeline
 * detail for the primary timeline (or null if the project has no timelines).
 */
export interface Project {
    /** Project ID — same as the underlying Tenant ID. */
    readonly projectId: TenantId;
    /** Full administrative description of the underlying tenant. */
    readonly tenant: TenantDescribeResponse;
    /** Cross-shard description of the primary timeline, or null if none exists. */
    readonly primaryTimeline: TenantTimelineDescribeResponse | null;
    /** ID of the primary timeline, or null if none exists. */
    readonly primaryTimelineId: TimelineId | null;
    /** Total number of timelines. */
    readonly timelineCount: number;
    /** All timelines (shard-zero view). */
    readonly timelines: readonly TimelineInfo[];
}
/**
 * Parameters for sdk.projects.createBranch().
 */
export interface BranchCreateRequest {
    /**
     * The project (tenant) to create the branch in.
     * Required — every branch belongs to exactly one project.
     */
    readonly projectId: TenantId;
    /**
     * The timeline to branch from (ancestor).
     * This is typically the project's root timeline, but any timeline within
     * the same project is valid.
     */
    readonly ancestorTimelineId: TimelineId;
    /**
     * Optional LSN at which to branch.
     * When omitted the branch is created at the ancestor's current tip (HEAD).
     */
    readonly ancestorLsn?: Lsn;
    /**
     * Optional human-readable name for the branch.
     * Not persisted by the Storage Controller — for dashboard / tooling use.
     */
    readonly name?: string;
}
/**
 * Result returned by sdk.projects.createBranch().
 */
export interface BranchCreateResult {
    /** The project (tenant) that owns this branch. */
    readonly projectId: TenantId;
    /** The newly created branch timeline ID. */
    readonly branchTimelineId: TimelineId;
    /** The ancestor (parent) timeline ID. */
    readonly ancestorTimelineId: TimelineId;
    /** The LSN at which the branch was created (branch point). */
    readonly ancestorLsn: Lsn | null;
    /** Postgres major version inherited from the ancestor. */
    readonly pgVersion: number;
    /** Optional name supplied at creation time. */
    readonly name: string | undefined;
    /** Raw Storage Controller response. */
    readonly timeline: TimelineCreateResponseStorcon;
}
/**
 * Lightweight summary of a branch, returned by sdk.projects.listBranches().
 */
export interface BranchSummary {
    /** The project (tenant) that owns this branch. */
    readonly projectId: TenantId;
    /** The branch timeline ID. */
    readonly branchTimelineId: TimelineId;
    /** The ancestor (parent) timeline ID. */
    readonly ancestorTimelineId: TimelineId;
    /** The LSN at which the branch was created. */
    readonly ancestorLsn: Lsn | null;
    /** Postgres major version. */
    readonly pgVersion: number;
    /** Current timeline state. */
    readonly state: TimelineInfo["state"];
    /** Last WAL record LSN. */
    readonly lastRecordLsn: Lsn;
}
/**
 * Full branch details returned by sdk.projects.getBranch().
 */
export interface Branch {
    /** The project (tenant) that owns this branch. */
    readonly projectId: TenantId;
    /** The branch timeline ID. */
    readonly branchTimelineId: TimelineId;
    /** The ancestor (parent) timeline ID. */
    readonly ancestorTimelineId: TimelineId;
    /** The LSN at which the branch was created. */
    readonly ancestorLsn: Lsn | null;
    /** Postgres major version. */
    readonly pgVersion: number;
    /** Shard-zero view of this branch timeline. */
    readonly timeline: TimelineInfo;
    /** Cross-shard description (one entry per shard). */
    readonly detail: TenantTimelineDescribeResponse;
}
/**
 * Higher-level service that orchestrates Tenant + Timeline operations as the
 * "Project" abstraction.
 *
 * Responsibility: composite operations built on top of TenantService and
 * TimelineService. No HTTP logic lives here — all network calls are delegated
 * to the injected services.
 *
 * ## What is a Project?
 *
 *   Tenant   → storage unit — holds all page data for one logical database cluster
 *   Timeline → branch       — a point-in-time history of WAL records
 *   Project  → Tenant + Bootstrap Timeline (the root branch)
 *
 * ## Methods
 *
 *   create()          — create Tenant + Bootstrap Timeline atomically
 *   list()            — list all projects (all tenants + their timelines)
 *   get(projectId)    — get full project details (tenant describe + timeline)
 *   delete(projectId) — delete all timelines then the tenant
 *
 * ## Failure handling for create()
 *
 * If the Bootstrap Timeline creation fails after the Tenant was already
 * created, the Tenant is automatically deleted to prevent orphan storage
 * units.
 *
 * ## Fault tolerance for list()
 *
 * If a single tenant's timeline fetch fails, that tenant is still included in
 * the result with timelineCount = 0 and timelineId = null. The error is
 * swallowed so one broken tenant does not prevent the rest from being returned.
 */
export declare class ProjectService {
    private readonly tenants;
    private readonly timelines;
    constructor(tenants: TenantService, timelines: TimelineService);
    /**
     * Creates a new Project: one Tenant and one Bootstrap Timeline.
     *
     * Workflow:
     *   1. Generate random IDs for tenant and timeline.
     *   2. Create the tenant (POST /v1/tenant).
     *   3. Poll GET /v1/tenant/:id until state becomes Active.
     *   4. Create a Bootstrap timeline (POST /v1/tenant/:id/timeline).
     *   5. Return { tenantId, tenant, timelineId, timeline }.
     *
     * On step 3 or 4 failure the created tenant is automatically deleted.
     *
     * @param pgVersion - Postgres major version (default: 16).
     */
    create(pgVersion?: number): Promise<ProjectCreateResult>;
    /**
     * Lists all projects on the cluster.
     *
     * Calls GET /control/v1/tenant to enumerate tenants, then probes every
     * tenant's timeline list concurrently. Faults on individual tenants are
     * swallowed so one unreachable tenant does not fail the entire request.
     *
     * Returns a ProjectSummary[] where each summary includes:
     *   - projectId / tenantId
     *   - primary timeline ID (first timeline, or null)
     *   - timeline count
     *   - pg_version from the primary timeline (or null)
     *   - placement policy, stripe size, physical size
     */
    list(): Promise<ProjectSummary[]>;
    /**
     * Returns full project details for a given project ID.
     *
     * Calls:
     *   1. GET /control/v1/tenant/:id  — full tenant description
     *   2. GET /v1/tenant/:id/timeline — timeline list
     *   3. GET /control/v1/tenant/:id/timeline/:id — cross-shard describe of primary
     *
     * Steps 2 and 3 run sequentially (3 depends on 1's result). If the project
     * has no timelines, primaryTimeline and primaryTimelineId are null.
     *
     * @param projectId - The 32-character hex project/tenant identifier.
     */
    get(projectId: TenantId): Promise<Project>;
    /**
     * Deletes a project and all its associated data. Irreversible.
     *
     * Workflow:
     *   1. List all timelines for the project.
     *   2. Delete every timeline concurrently (NotFoundError is tolerated).
     *   3. Delete the tenant.
     *   4. Verify the tenant no longer exists (throws if it does).
     *
     * Throws if the tenant cannot ultimately be deleted.
     *
     * @param projectId - The 32-character hex project/tenant identifier.
     */
    delete(projectId: TenantId): Promise<void>;
    /**
     * Creates a new Branch timeline within a Project.
     *
     * A Branch is a timeline created with `TimelineCreateRequestBranch` — it has
     * a non-null `ancestor_timeline_id`. The project's root Bootstrap Timeline is
     * never affected.
     *
     * Workflow:
     *   1. Generate a random timeline ID.
     *   2. POST /v1/tenant/:projectId/timeline with the branch request body.
     *   3. Return BranchCreateResult.
     *
     * @param request - Branch parameters: projectId, ancestorTimelineId,
     *   optional ancestorLsn (HEAD if omitted), optional name.
     */
    createBranch(request: BranchCreateRequest): Promise<BranchCreateResult>;
    /**
     * Lists all Branch timelines for a Project.
     *
     * Returns only branch timelines — timelines whose `ancestor_timeline_id` is
     * non-null. The project's root Bootstrap Timeline (ancestor_timeline_id === null)
     * is excluded.
     *
     * Calls GET /v1/tenant/:projectId/timeline (pageserver passthrough) and
     * filters the result locally.
     *
     * @param projectId - The 32-character hex project/tenant identifier.
     */
    listBranches(projectId: TenantId): Promise<BranchSummary[]>;
    /**
     * Returns full details for a single Branch timeline.
     *
     * Calls:
     *   1. GET /v1/tenant/:projectId/timeline — list all timelines (shard-zero view)
     *   2. GET /control/v1/tenant/:projectId/timeline/:branchTimelineId — cross-shard describe
     *
     * Throws NotFoundError if:
     *   - The project does not exist.
     *   - The timeline does not exist.
     *   - The timeline is the root Bootstrap Timeline (not a branch).
     *
     * @param projectId       - The 32-character hex project/tenant identifier.
     * @param branchTimelineId - The 32-character hex branch timeline identifier.
     */
    getBranch(projectId: TenantId, branchTimelineId: TimelineId): Promise<Branch>;
    /**
     * Deletes a single Branch timeline. Irreversible.
     *
     * Only the specified branch timeline is deleted. The project, the root
     * Bootstrap Timeline, and all other timelines are left untouched.
     *
     * Throws NotFoundError if:
     *   - The branch timeline does not exist.
     *   - The specified timeline is the root Bootstrap Timeline.
     *     (Deleting the root would destroy the project's database — use
     *     sdk.projects.delete() for full project teardown instead.)
     *
     * @param projectId       - The 32-character hex project/tenant identifier.
     * @param branchTimelineId - The 32-character hex branch timeline identifier.
     */
    deleteBranch(projectId: TenantId, branchTimelineId: TimelineId): Promise<void>;
}
//# sourceMappingURL=project.service.d.ts.map