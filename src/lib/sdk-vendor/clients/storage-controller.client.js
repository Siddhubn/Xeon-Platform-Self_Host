import { isAxiosError } from "axios";
import { ApiError, NotFoundError, UnauthorizedError, } from "../errors/index.js";
/**
 * HTTP client for the Neon Storage Controller API.
 *
 * Responsibility: transport only.
 * This class is the boundary between the SDK and the network. It translates
 * method calls into HTTP requests and returns typed response bodies. It knows
 * nothing about business logic, caching, or validation.
 *
 * The AxiosInstance is injected at construction time (via `createHttpClient`)
 * so that connection pooling, timeouts, and retry behaviour are owned by the
 * infrastructure layer and not duplicated here.
 *
 * HTTP errors are converted to SDK error types before propagating:
 *   404 → NotFoundError
 *   401 / 403 → UnauthorizedError
 *   all other HTTP failures → ApiError
 * The original Axios error is preserved as `cause` on every thrown error.
 *
 * Endpoint surface note:
 *   /v1/ prefix         — "Virtual Pageserver": create, delete, get (single
 *                         tenant via passthrough), timeline list (proxied to
 *                         shard-zero pageserver via wildcard route)
 *   /control/v1/ prefix — Administrative surface: list tenants, describe
 *                         tenant, describe a timeline across all shards
 */
export class StorageControllerClient {
    client;
    constructor(client) {
        this.client = client;
    }
    // ---------------------------------------------------------------------------
    // Private transport helpers
    // ---------------------------------------------------------------------------
    /**
     * Issues a GET request, unwraps `.data`, converts Axios errors to SDK errors.
     * Named `fetch` internally to avoid collision with the public `get()` method.
     */
    async fetch(path) {
        try {
            const response = await this.client.get(path);
            return response.data;
        }
        catch (err) {
            throw StorageControllerClient.wrapError(err, path);
        }
    }
    async post(path, body) {
        try {
            const response = await this.client.post(path, body);
            return response.data;
        }
        catch (err) {
            throw StorageControllerClient.wrapError(err, path);
        }
    }
    async del(path) {
        try {
            await this.client.delete(path);
        }
        catch (err) {
            throw StorageControllerClient.wrapError(err, path);
        }
    }
    async put(path, body) {
        try {
            const response = await this.client.put(path, body);
            return response.data;
        }
        catch (err) {
            throw StorageControllerClient.wrapError(err, path);
        }
    }
    async putVoid(path, body) {
        try {
            await this.client.put(path, body);
        }
        catch (err) {
            throw StorageControllerClient.wrapError(err, path);
        }
    }
    /**
     * Issues a PUT with no request body (query-params only).
     * Used for endpoints like node delete that take only path + query params.
     */
    async putEmpty(path) {
        try {
            await this.client.put(path);
        }
        catch (err) {
            throw StorageControllerClient.wrapError(err, path);
        }
    }
    static wrapError(err, path) {
        if (!isAxiosError(err)) {
            return err;
        }
        const status = err.response?.status;
        const serverMessage = err.response?.data?.msg ??
            err.message;
        const cause = { cause: err };
        if (status === 404)
            return new NotFoundError("resource", path, cause);
        if (status === 401 || status === 403)
            return new UnauthorizedError(serverMessage, cause);
        return new ApiError(serverMessage, status, cause);
    }
    // ---------------------------------------------------------------------------
    // Tenant operations
    // ---------------------------------------------------------------------------
    /**
     * Lists all tenants known to the Storage Controller.
     *
     * Calls: GET /control/v1/tenant
     *
     * This endpoint lives on the administrative surface (/control/v1/), not
     * the Virtual Pageserver surface (/v1/), because listing is a cluster-wide
     * administrative operation. The /v1/ prefix does not expose a GET without
     * a tenant ID.
     *
     * Supports optional cursor-based pagination:
     *   limit      — maximum number of tenants to return
     *   startAfter — return only tenants with ID strictly after this value
     */
    async list(options) {
        const params = new URLSearchParams();
        if (options?.limit !== undefined) {
            params.set("limit", String(options.limit));
        }
        if (options?.startAfter !== undefined) {
            params.set("start_after", options.startAfter);
        }
        const query = params.size > 0 ? `?${params.toString()}` : "";
        return this.fetch(`/control/v1/tenant${query}`);
    }
    /**
     * Returns the live pageserver state for a single tenant.
     *
     * Calls: GET /v1/tenant/:tenant_id
     *
     * Passthrough to the shard-zero pageserver. Returns TenantInfo with live
     * attachment state, physical size, and GC blocking status.
     */
    async get(tenantId) {
        return this.fetch(`/v1/tenant/${tenantId}`);
    }
    /**
     * Returns the full administrative description of a tenant.
     *
     * Calls: GET /control/v1/tenant/:tenant_id
     *
     * Returns shard placements, placement policy, scheduling policies, and
     * tenant config from the Storage Controller's own in-memory state.
     * Does not require the tenant to be attached to a pageserver.
     */
    async describe(tenantId) {
        return this.fetch(`/control/v1/tenant/${tenantId}`);
    }
    /**
     * Creates a new tenant on the Storage Controller.
     *
     * Calls: POST /v1/tenant
     *
     * Returns the shard placement assignments chosen by the controller.
     */
    async create(request) {
        return this.post("/v1/tenant", request);
    }
    /**
     * Deletes a tenant and all its data. Irreversible.
     *
     * Calls: DELETE /v1/tenant/:tenant_id
     */
    async delete(tenantId) {
        return this.del(`/v1/tenant/${tenantId}`);
    }
    // ---------------------------------------------------------------------------
    // Timeline operations
    // ---------------------------------------------------------------------------
    /**
     * Lists all timelines for a tenant.
     *
     * Calls: GET /v1/tenant/:tenant_id/timeline
     *
     * This is a passthrough to the shard-zero pageserver via the Virtual
     * Pageserver wildcard route. The Storage Controller does not have its own
     * timeline list endpoint — it proxies this request directly.
     * Returns Vec<TimelineInfo> from the pageserver.
     */
    async listTimelines(tenantId) {
        return this.fetch(`/v1/tenant/${tenantId}/timeline`);
    }
    /**
     * Returns the Storage Controller's cross-shard description of a timeline.
     *
     * Calls: GET /control/v1/tenant/:tenant_id/timeline/:timeline_id
     *
     * Queries every shard's attached pageserver in parallel and returns
     * TenantTimelineDescribeResponse:
     *   shards              — Vec<TimelineInfo>, one entry per shard
     *   image_consistent_lsn — minimum image LSN across all shards (HADRON only)
     *
     * This is the authoritative multi-shard view. The /v1/ passthrough only
     * returns the shard-zero perspective.
     */
    async getTimeline(tenantId, timelineId) {
        return this.fetch(`/control/v1/tenant/${tenantId}/timeline/${timelineId}`);
    }
    /**
     * Creates a new timeline for a tenant.
     *
     * Calls: POST /v1/tenant/:tenant_id/timeline  (returns 201 Created)
     *
     * The request body is a TimelineCreateRequest with a flattened mode field
     * (serde untagged). The three modes are:
     *   Branch    — branch an existing timeline at an optional ancestor LSN
     *   Bootstrap — create a root timeline (empty database)
     *   ImportPgdata — import Postgres data from S3
     *
     * Returns TimelineCreateResponseStorcon which flattens TimelineInfo and
     * adds an optional safekeepers field.
     */
    async createTimeline(tenantId, request) {
        return this.post(`/v1/tenant/${tenantId}/timeline`, request);
    }
    /**
     * Deletes a timeline. Irreversible.
     *
     * Calls: DELETE /v1/tenant/:tenant_id/timeline/:timeline_id
     *
     * The Storage Controller waits until the deletion is acknowledged by all
     * shards before returning 200. In-progress deletions may return 202 or 409,
     * which the client handles by retrying internally.
     */
    async deleteTimeline(tenantId, timelineId) {
        return this.del(`/v1/tenant/${tenantId}/timeline/${timelineId}`);
    }
    // ---------------------------------------------------------------------------
    // Node operations
    // ---------------------------------------------------------------------------
    /**
     * Lists all pageserver nodes registered with the Storage Controller.
     *
     * Calls: GET /control/v1/node
     *
     * This endpoint lives on the administrative surface (/control/v1/) and
     * returns every node known to the controller regardless of availability
     * state. Nodes may be Active, Offline, or Decomissioned.
     *
     * Returns NodeDescribeResponse[] — the same shape as the single-node
     * status endpoint, making it straightforward to process both uniformly.
     */
    async listNodes() {
        return this.fetch("/control/v1/node");
    }
    /**
     * Returns the status of a single pageserver node.
     *
     * Calls: GET /control/v1/node/:node_id
     *
     * Returns NodeDescribeResponse with the node's availability state,
     * scheduling policy, listen addresses, and shard counts from the
     * Storage Controller's in-memory state.
     *
     * @param nodeId - The numeric node identifier.
     */
    async getNode(nodeId) {
        return this.fetch(`/control/v1/node/${nodeId}`);
    }
    /**
     * Registers a new pageserver node with the Storage Controller.
     *
     * Calls: POST /control/v1/node  (Auth scope: Infra)
     *
     * Typically called by the pageserver on startup to announce its listen
     * addresses. Re-registering an existing node (e.g. after a restart)
     * is safe — the controller updates the stored addresses in place.
     *
     * Returns void on success (HTTP 200, empty body).
     *
     * @param request - NodeRegisterRequest with the node's ID and listen addresses.
     */
    async registerNode(request) {
        return this.post("/control/v1/node", request);
    }
    /**
     * Updates the availability state and/or scheduling policy of a node.
     *
     * Calls: PUT /control/v1/node/:node_id/config  (Auth scope: Admin)
     *
     * Both `availability` and `scheduling` are optional in the request body.
     * Omitting a field leaves the current value unchanged on the controller.
     *
     * The `node_id` field in the request body must equal the path parameter;
     * the Storage Controller returns HTTP 400 if they differ.
     *
     * Returns void on success (HTTP 200, empty body).
     *
     * @param nodeId  - The numeric node identifier (used in the URL path).
     * @param request - NodeConfigureRequest — must include node_id matching nodeId.
     */
    async configureNode(nodeId, request) {
        return this.putVoid(`/control/v1/node/${nodeId}/config`, request);
    }
    /**
     * Starts the asynchronous deletion of a pageserver node.
     *
     * Calls: PUT /control/v1/node/:node_id/delete[?force=true]  (Auth scope: Admin)
     *
     * The Storage Controller performs deletion asynchronously in a background
     * task. This method returns as soon as the task has been accepted (HTTP 200).
     * The actual deletion — migrating all shards away and removing the node from
     * the registry — continues in the background.
     *
     * Preconditions enforced by the Storage Controller:
     *   • Node must exist (404 if not)
     *   • No other background operation may be in progress (409 Conflict)
     *   • At least one other schedulable node must exist (412 PreconditionFailed)
     *   • Node scheduling must be Active or Pause (412 if Draining/Filling/Deleting)
     *
     * When force=true the controller skips waiting for observed locations to be
     * moved away before writing the tombstone, allowing deletion to complete even
     * if the node is unreachable.
     *
     * After this call the node's scheduling policy transitions to "Deleting".
     * Poll GET /control/v1/node/:node_id until it returns HTTP 404 (NotFoundError)
     * to confirm that the background task has completed.
     *
     * @param nodeId  - The numeric node identifier.
     * @param options - Optional flags: force (default false).
     */
    async startNodeDelete(nodeId, options) {
        const force = options?.force ?? false;
        const query = force ? "?force=true" : "";
        return this.putEmpty(`/control/v1/node/${nodeId}/delete${query}`);
    }
    /**
     * Cancels an in-progress asynchronous node deletion.
     *
     * Calls: DELETE /control/v1/node/:node_id/delete  (Auth scope: Infra)
     *
     * Signals the background deletion task to stop via a cancellation token.
     * The Storage Controller restores the node's scheduling policy to whatever
     * it was before the deletion started (Active or Pause).
     *
     * Returns HTTP 202 Accepted. Throws PreconditionFailed (ApiError) if no
     * deletion is currently in progress for the given node.
     *
     * @param nodeId - The numeric node identifier.
     */
    async cancelNodeDelete(nodeId) {
        return this.del(`/control/v1/node/${nodeId}/delete`);
    }
}
//# sourceMappingURL=storage-controller.client.js.map