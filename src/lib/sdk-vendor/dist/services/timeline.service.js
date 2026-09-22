/**
 * Service layer for timeline operations.
 *
 * Responsibility: orchestration, not transport.
 * Expresses timeline operations in domain terms without any knowledge of HTTP,
 * Axios, URLs, or environment variables.
 *
 * The StorageControllerClient is injected at construction time, keeping this
 * class transport-independent and substitutable in tests.
 *
 * Method overview:
 *   list()   → TimelineInfo[]                 pageserver passthrough (shard-zero view)
 *   get()    → TenantTimelineDescribeResponse Storage Controller cross-shard view
 *   create() → TimelineCreateResponseStorcon  POST /v1/tenant/:id/timeline
 *   delete() → void                           DELETE /v1/tenant/:id/timeline/:id
 *
 * Endpoint mapping:
 *   list()   uses GET    /v1/tenant/:id/timeline                 (pageserver passthrough)
 *   get()    uses GET    /control/v1/tenant/:id/timeline/:id     (cross-shard describe)
 *   create() uses POST   /v1/tenant/:id/timeline
 *   delete() uses DELETE /v1/tenant/:id/timeline/:id
 */
export class TimelineService {
    storageController;
    constructor(storageController) {
        this.storageController = storageController;
    }
    /**
     * Returns all timelines for a tenant.
     *
     * Calls GET /v1/tenant/:tenantId/timeline — proxied to shard-zero pageserver.
     * Returns Vec<TimelineInfo> from the pageserver directly.
     *
     * @param tenantId - The 32-character hex tenant identifier.
     */
    async list(tenantId) {
        return this.storageController.listTimelines(tenantId);
    }
    /**
     * Returns the Storage Controller's cross-shard description of a timeline.
     *
     * Calls GET /control/v1/tenant/:tenantId/timeline/:timelineId.
     * Queries every shard's attached pageserver in parallel and returns:
     *   - shards               — one TimelineInfo per shard
     *   - image_consistent_lsn — minimum image LSN across all shards
     *
     * @param tenantId   - The 32-character hex tenant identifier.
     * @param timelineId - The 32-character hex timeline identifier.
     */
    async get(tenantId, timelineId) {
        return this.storageController.getTimeline(tenantId, timelineId);
    }
    /**
     * Creates a new timeline for a tenant.
     *
     * Calls POST /v1/tenant/:tenantId/timeline (returns 201 Created).
     *
     * The request uses a flattened union mode (serde untagged). Use one of:
     *   TimelineCreateRequestBranch    — branch from an existing timeline
     *   TimelineCreateRequestBootstrap — new root timeline (empty database)
     *   TimelineCreateRequestImport    — import from S3 pgdata
     *
     * @param tenantId - The 32-character hex tenant identifier.
     * @param request  - TimelineCreateRequest (one of the three mode variants).
     *
     * @returns TimelineCreateResponseStorcon — flattened TimelineInfo plus
     *          optional safekeeper assignment.
     */
    async create(tenantId, request) {
        return this.storageController.createTimeline(tenantId, request);
    }
    /**
     * Deletes a timeline. Irreversible.
     *
     * Calls DELETE /v1/tenant/:tenantId/timeline/:timelineId.
     *
     * @param tenantId   - The 32-character hex tenant identifier.
     * @param timelineId - The 32-character hex timeline identifier.
     */
    async delete(tenantId, timelineId) {
        return this.storageController.deleteTimeline(tenantId, timelineId);
    }
}
//# sourceMappingURL=timeline.service.js.map