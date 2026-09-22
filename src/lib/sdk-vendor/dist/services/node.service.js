/**
 * Service layer for pageserver node operations.
 *
 * Responsibility: orchestration, not transport.
 * This layer sits above StorageControllerClient and below NeonSDK. It expresses
 * node operations in domain terms without any knowledge of HTTP, Axios,
 * URLs, or environment variables.
 *
 * The StorageControllerClient is injected at construction time, keeping this
 * class transport-independent and straightforward to substitute in tests.
 *
 * Method overview:
 *   list()              → NodeDescribeResponse[]  all nodes known to the Storage Controller
 *   get(nodeId)         → NodeDescribeResponse    single node status
 *   register(request)   → void                    register a new pageserver node
 *   configure(nodeId,r) → void                    update availability / scheduling policy
 *   drain(nodeId)       → void                    convenience: scheduling → "Draining"
 *   cancelDrain(nodeId) → void                    convenience: scheduling → "Active"
 *   fill(nodeId)        → void                    convenience: scheduling → "Filling"
 *   cancelFill(nodeId)  → void                    convenience: scheduling → "Active"
 *   delete(nodeId,opts) → void                    start async node deletion
 *   cancelDelete(nodeId)→ void                    cancel an in-progress deletion
 *
 * Endpoint mapping:
 *   list()        uses GET    /control/v1/node                    (admin surface)
 *   get()         uses GET    /control/v1/node/:node_id           (admin surface)
 *   register()    uses POST   /control/v1/node                    (infra scope)
 *   configure()   uses PUT    /control/v1/node/:node_id/config    (admin surface)
 *   drain()       uses PUT    /control/v1/node/:node_id/config    (via configure)
 *   cancelDrain() uses PUT    /control/v1/node/:node_id/config    (via configure)
 *   fill()        uses PUT    /control/v1/node/:node_id/config    (via configure)
 *   cancelFill()  uses PUT    /control/v1/node/:node_id/config    (via configure)
 *   delete()      uses PUT    /control/v1/node/:node_id/delete    (admin surface)
 *   cancelDelete()uses DELETE /control/v1/node/:node_id/delete    (infra scope)
 *
 * All endpoints live on the /control/v1/ administrative surface.
 * There are no node endpoints on the /v1/ Virtual Pageserver surface.
 */
export class NodeService {
    storageController;
    constructor(storageController) {
        this.storageController = storageController;
    }
    /**
     * Returns all pageserver nodes registered with the Storage Controller.
     *
     * Calls GET /control/v1/node and returns NodeDescribeResponse[], which
     * contains each node's availability state, scheduling policy, listen
     * addresses, and shard counts.
     *
     * Nodes in any availability state (Active, WarmingUp, Offline) are
     * included — callers should filter by `availability` if needed.
     */
    async list() {
        return this.storageController.listNodes();
    }
    /**
     * Returns the current status of a single pageserver node.
     *
     * Calls GET /control/v1/node/:node_id.
     *
     * Throws NotFoundError (HTTP 404) if no node with the given ID is registered.
     *
     * @param nodeId - The numeric pageserver node identifier.
     */
    async get(nodeId) {
        return this.storageController.getNode(nodeId);
    }
    /**
     * Registers a new pageserver node with the Storage Controller.
     *
     * Calls POST /control/v1/node (Infra scope).
     *
     * Typically called by the pageserver itself on startup to announce its
     * listen addresses. Re-registering an existing node (e.g. after a restart)
     * is safe — the controller updates the stored addresses in place.
     *
     * Returns void on success.
     *
     * @param request - Node registration parameters: ID, listen addresses, AZ.
     */
    async register(request) {
        return this.storageController.registerNode(request);
    }
    /**
     * Updates the availability state and/or scheduling policy of a node.
     *
     * Calls PUT /control/v1/node/:node_id/config (Admin scope).
     *
     * Both fields are optional — omit any field whose current value should
     * remain unchanged. The `node_id` in the request body is set automatically
     * from the `nodeId` argument.
     *
     * Returns void on success.
     *
     * @param nodeId  - The numeric pageserver node identifier.
     * @param request - Partial configuration update: availability and/or scheduling.
     */
    async configure(nodeId, request) {
        return this.storageController.configureNode(nodeId, request);
    }
    // ---------------------------------------------------------------------------
    // Scheduling convenience helpers
    //
    // Each method is a single-purpose wrapper around configure() that sets
    // exactly one scheduling field. No new HTTP endpoints are introduced —
    // every call goes through configureNode() → PUT /control/v1/node/:id/config.
    // ---------------------------------------------------------------------------
    /**
     * Starts draining a node — sets scheduling to "Draining".
     *
     * The Storage Controller stops placing new primary shards on this node and
     * begins migrating existing primaries to other nodes. Equivalent to:
     *   configure(nodeId, { node_id: nodeId, scheduling: "Draining" })
     *
     * @param nodeId - The numeric pageserver node identifier.
     */
    async drain(nodeId) {
        return this.configure(nodeId, { node_id: nodeId, scheduling: "Draining" });
    }
    /**
     * Cancels an in-progress drain — sets scheduling back to "Active".
     *
     * Restores normal shard placement on this node. Equivalent to:
     *   configure(nodeId, { node_id: nodeId, scheduling: "Active" })
     *
     * @param nodeId - The numeric pageserver node identifier.
     */
    async cancelDrain(nodeId) {
        return this.configure(nodeId, { node_id: nodeId, scheduling: "Active" });
    }
    /**
     * Starts filling a node — sets scheduling to "Filling".
     *
     * The Storage Controller actively migrates shards onto this node until it
     * reaches the target load. Equivalent to:
     *   configure(nodeId, { node_id: nodeId, scheduling: "Filling" })
     *
     * @param nodeId - The numeric pageserver node identifier.
     */
    async fill(nodeId) {
        return this.configure(nodeId, { node_id: nodeId, scheduling: "Filling" });
    }
    /**
     * Cancels an in-progress fill — sets scheduling back to "Active".
     *
     * Restores normal shard placement on this node. Equivalent to:
     *   configure(nodeId, { node_id: nodeId, scheduling: "Active" })
     *
     * @param nodeId - The numeric pageserver node identifier.
     */
    async cancelFill(nodeId) {
        return this.configure(nodeId, { node_id: nodeId, scheduling: "Active" });
    }
    // ---------------------------------------------------------------------------
    // Deletion
    // ---------------------------------------------------------------------------
    /**
     * Starts the asynchronous deletion of a pageserver node.
     *
     * Calls PUT /control/v1/node/:node_id/delete (Admin scope).
     *
     * The Storage Controller transitions the node's scheduling policy to
     * "Deleting", migrates all shard primaries away to other nodes, writes
     * a tombstone to the database, then removes the node from the in-memory
     * registry. The method returns as soon as the background task is accepted —
     * deletion continues after the call returns.
     *
     * ## Monitoring completion
     *
     * The SDK does NOT poll internally. Call sdk.nodes.get(nodeId) in a loop
     * until it throws NotFoundError to confirm the background task has finished:
     *
     *   await sdk.nodes.delete(nodeId);
     *   // ...or use waitForNodeDeletion() from playground/shared/node-helper.ts
     *
     * ## Preconditions (enforced by the Storage Controller)
     *
     *   • Node must exist — 404 NotFoundError if not registered
     *   • No other background operation may be running — 409 ApiError
     *   • At least one other schedulable node must exist — 412 ApiError
     *   • Node scheduling must be Active or Pause — 412 ApiError if Draining/Filling/Deleting
     *
     * ## force flag
     *
     * When `force: true` the controller skips waiting for live-migration
     * reconcilers to complete before writing the tombstone. Use this when the
     * node is unreachable and normal graceful drain cannot proceed.
     *
     * @param nodeId  - The numeric pageserver node identifier.
     * @param options - Optional: `{ force?: boolean }` (default: false).
     */
    async delete(nodeId, options) {
        return this.storageController.startNodeDelete(nodeId, options);
    }
    /**
     * Cancels an in-progress asynchronous node deletion.
     *
     * Calls DELETE /control/v1/node/:node_id/delete (Infra scope).
     *
     * Signals the background deletion task to stop. The Storage Controller
     * restores the node's scheduling policy to whatever it was before the
     * deletion started (Active or Pause).
     *
     * Throws ApiError (412 PreconditionFailed) if no deletion is currently
     * in progress for the given node.
     *
     * @param nodeId - The numeric pageserver node identifier.
     */
    async cancelDelete(nodeId) {
        return this.storageController.cancelNodeDelete(nodeId);
    }
}
//# sourceMappingURL=node.service.js.map