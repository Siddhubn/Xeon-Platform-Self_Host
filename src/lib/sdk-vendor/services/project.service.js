import { randomBytes } from "node:crypto";
import { NotFoundError } from "../errors/index.js";
// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
function generateId() {
    return randomBytes(16).toString("hex");
}
/**
 * Polls tenants.get() until the tenant state slug is "Active".
 *
 * The Storage Controller transitions a tenant through Attaching → Activating →
 * Active after creation. Creating a Bootstrap timeline before the tenant is
 * Active will fail, so we wait here.
 */
async function waitUntilActive(tenants, tenantId, intervalMs = 500, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (true) {
        const info = await tenants.get(tenantId);
        const state = info.state;
        if ("slug" in state && state.slug === "Active") {
            return info;
        }
        if ("slug" in state && state.slug === "Stopping") {
            throw new Error(`Tenant ${tenantId} entered Stopping state while waiting for Active.`);
        }
        if (!("slug" in state)) {
            const broken = state;
            throw new Error(`Tenant ${tenantId} is Broken: ${broken.Broken.reason}`);
        }
        if (Date.now() >= deadline) {
            throw new Error(`Tenant ${tenantId} did not become Active within ${timeoutMs} ms. ` +
                `Last observed state: ${JSON.stringify(state)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
}
// ---------------------------------------------------------------------------
// ProjectService
// ---------------------------------------------------------------------------
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
export class ProjectService {
    tenants;
    timelines;
    constructor(tenants, timelines) {
        this.tenants = tenants;
        this.timelines = timelines;
    }
    // ---------------------------------------------------------------------------
    // Create
    // ---------------------------------------------------------------------------
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
    async create(pgVersion = 17) {
        const tenantId = generateId();
        const timelineId = generateId();
        await this.tenants.create({ new_tenant_id: tenantId });
        let tenant;
        try {
            tenant = await waitUntilActive(this.tenants, tenantId);
        }
        catch (err) {
            try {
                await this.tenants.delete(tenantId);
            }
            catch { }
            throw err;
        }
        let timeline;
        try {
            timeline = await this.timelines.create(tenantId, {
                new_timeline_id: timelineId,
                pg_version: pgVersion,
            });
        }
        catch (err) {
            try {
                await this.tenants.delete(tenantId);
            }
            catch { }
            throw err;
        }
        return { tenantId, tenant, timelineId, timeline };
    }
    // ---------------------------------------------------------------------------
    // List
    // ---------------------------------------------------------------------------
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
    async list() {
        const tenantDescriptions = await this.tenants.list();
        // Probe all tenants concurrently — tolerate individual failures
        const summaries = await Promise.all(tenantDescriptions.map(async (desc) => {
            let tlList = [];
            try {
                tlList = await this.timelines.list(desc.tenant_id);
            }
            catch {
                // Swallow — tenant may not be fully attached yet; return partial summary
            }
            const primary = tlList[0] ?? null;
            // Derive attachment status: attached if shard-zero has a node attached
            const firstShard = desc.shards[0];
            const attachmentStatus = firstShard !== undefined
                ? firstShard.node_attached !== null
                    ? { slug: "attached" }
                    : { slug: "maybe" }
                : null;
            return {
                projectId: desc.tenant_id,
                tenantId: desc.tenant_id,
                timelineId: primary?.timeline_id ?? null,
                attachmentStatus,
                pgVersion: primary?.pg_version ?? null,
                timelineCount: tlList.length,
                physicalSize: null, // not available at list level without extra describe calls
                policy: desc.policy,
                stripeSize: desc.stripe_size,
            };
        }));
        return summaries;
    }
    // ---------------------------------------------------------------------------
    // Get
    // ---------------------------------------------------------------------------
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
    async get(projectId) {
        // Steps 1 and 2 can run in parallel — describe needs only the ID,
        // timeline list also only needs the ID
        const [tenantDesc, tlList] = await Promise.all([
            this.tenants.describe(projectId),
            this.timelines.list(projectId),
        ]);
        const primaryTimelineId = tlList[0]?.timeline_id ?? null;
        let primaryTimeline = null;
        if (primaryTimelineId !== null) {
            try {
                primaryTimeline = await this.timelines.get(projectId, primaryTimelineId);
            }
            catch {
                // If cross-shard describe fails (e.g. 503 from the controller), degrade
                // gracefully — return null rather than failing the whole get()
            }
        }
        return {
            projectId,
            tenant: tenantDesc,
            primaryTimeline,
            primaryTimelineId,
            timelineCount: tlList.length,
            timelines: tlList,
        };
    }
    // ---------------------------------------------------------------------------
    // Delete
    // ---------------------------------------------------------------------------
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
    async delete(projectId) {
        // Step 1 — list timelines (tolerates empty list)
        let timelineIds = [];
        try {
            const tls = await this.timelines.list(projectId);
            timelineIds = tls.map((t) => t.timeline_id);
        }
        catch {
            // If listing fails the tenant may have no pageserver — proceed with deletion
        }
        // Step 2 — delete all timelines concurrently, tolerating NotFoundError
        await Promise.all(timelineIds.map(async (tlId) => {
            try {
                await this.timelines.delete(projectId, tlId);
            }
            catch (err) {
                if (err instanceof NotFoundError)
                    return; // already gone
                throw err;
            }
        }));
        // Step 3 — delete the tenant
        await this.tenants.delete(projectId);
        // Step 4 — verify deletion
        try {
            await this.tenants.get(projectId);
            // If get() succeeds, the tenant still exists — this should not happen
            throw new Error(`Tenant ${projectId} still exists after deletion.`);
        }
        catch (err) {
            if (err instanceof NotFoundError)
                return; // expected — deletion confirmed
            throw err;
        }
    }
    // ---------------------------------------------------------------------------
    // Branch — Create
    // ---------------------------------------------------------------------------
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
    async createBranch(request) {
        const branchTimelineId = generateId();
        const timeline = await this.timelines.create(request.projectId, {
            new_timeline_id: branchTimelineId,
            ancestor_timeline_id: request.ancestorTimelineId,
            ...(request.ancestorLsn !== undefined
                ? { ancestor_start_lsn: request.ancestorLsn }
                : {}),
        });
        return {
            projectId: request.projectId,
            branchTimelineId,
            ancestorTimelineId: request.ancestorTimelineId,
            ancestorLsn: timeline.ancestor_lsn,
            pgVersion: timeline.pg_version,
            name: request.name,
            timeline,
        };
    }
    // ---------------------------------------------------------------------------
    // Branch — List
    // ---------------------------------------------------------------------------
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
    async listBranches(projectId) {
        const allTimelines = await this.timelines.list(projectId);
        return allTimelines
            .filter((tl) => tl.ancestor_timeline_id !== null)
            .map((tl) => ({
            projectId,
            branchTimelineId: tl.timeline_id,
            ancestorTimelineId: tl.ancestor_timeline_id,
            ancestorLsn: tl.ancestor_lsn,
            pgVersion: tl.pg_version,
            state: tl.state,
            lastRecordLsn: tl.last_record_lsn,
        }));
    }
    // ---------------------------------------------------------------------------
    // Branch — Get
    // ---------------------------------------------------------------------------
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
    async getBranch(projectId, branchTimelineId) {
        // Step 1 — shard-zero view: find the timeline in the list to get ancestor info
        const allTimelines = await this.timelines.list(projectId);
        const tl = allTimelines.find((t) => t.timeline_id === branchTimelineId);
        if (tl === undefined) {
            throw new NotFoundError("branch timeline", branchTimelineId);
        }
        if (tl.ancestor_timeline_id === null) {
            throw new NotFoundError("branch timeline", `${branchTimelineId} (this is the project root timeline, not a branch)`);
        }
        // Step 2 — cross-shard describe
        const detail = await this.timelines.get(projectId, branchTimelineId);
        return {
            projectId,
            branchTimelineId,
            ancestorTimelineId: tl.ancestor_timeline_id,
            ancestorLsn: tl.ancestor_lsn,
            pgVersion: tl.pg_version,
            timeline: tl,
            detail,
        };
    }
    // ---------------------------------------------------------------------------
    // Branch — Delete
    // ---------------------------------------------------------------------------
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
    async deleteBranch(projectId, branchTimelineId) {
        // Guard: verify this timeline is actually a branch (has an ancestor).
        // This prevents accidental deletion of the root timeline via deleteBranch().
        const allTimelines = await this.timelines.list(projectId);
        const tl = allTimelines.find((t) => t.timeline_id === branchTimelineId);
        if (tl === undefined) {
            throw new NotFoundError("branch timeline", branchTimelineId);
        }
        if (tl.ancestor_timeline_id === null) {
            throw new Error(`Cannot delete branch timeline ${branchTimelineId}: ` +
                `this is the project's root Bootstrap Timeline. ` +
                `Use sdk.projects.delete(projectId) to delete the entire project.`);
        }
        await this.timelines.delete(projectId, branchTimelineId);
    }
}
//# sourceMappingURL=project.service.js.map