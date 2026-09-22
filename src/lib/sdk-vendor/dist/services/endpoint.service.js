import { ComputeCtlClient } from "../clients/compute-ctl.client.js";
import { createHttpClient } from "../utils/http.js";
// ---------------------------------------------------------------------------
// EndpointService
// ---------------------------------------------------------------------------
/**
 * Service layer for per-compute-instance operations.
 *
 * Responsibility: orchestration of compute_ctl HTTP calls for a specific
 * compute endpoint. No knowledge of HTTP transport, URLs, or tokens belongs
 * in this layer — everything is delegated to ComputeCtlClient.
 *
 * ## What is a Compute Endpoint?
 *
 * A Compute Endpoint is a running PostgreSQL instance managed by `compute_ctl`.
 * Each endpoint is attached to exactly one Neon Tenant + Timeline (Branch).
 * The lifecycle is:
 *
 *   Timeline (Branch)
 *     └── Compute Endpoint (compute_ctl process)
 *           └── PostgreSQL server
 *
 * In production, the Control Plane orchestrates endpoint creation by spawning
 * `compute_ctl` and passing it a `ConfigurationRequest`. In the local dev
 * environment, `neon_local` manages this.
 *
 * ## Architecture note
 *
 * There is NO cluster-level Compute Endpoint list/create/delete API on the
 * Storage Controller. The Storage Controller manages tenant and timeline
 * placement on pageservers; it does NOT manage compute endpoint lifecycle.
 * compute_ctl is a per-compute process, not a cluster service.
 *
 * This means:
 *   - `sdk.compute.getStatus(conn)` — per-instance status check
 *   - `sdk.compute.configure(conn, req)` — push a new spec to a running compute
 *   - `sdk.compute.terminate(conn, mode)` — terminate a specific compute
 *
 * The caller must supply the `computeUrl` for each operation.
 *
 * ## Method overview
 *
 *   getStatus(conn)         → ComputeStatusResponse
 *   configure(conn, req)    → ComputeStatusResponse  (synchronous; waits for Running)
 *   terminate(conn, mode?)  → TerminateResponse
 *
 * ## Endpoint mapping (compute_ctl HTTP API)
 *
 *   getStatus()   uses GET  /status
 *   configure()   uses POST /configure
 *   terminate()   uses POST /terminate[?mode=fast|immediate]
 */
export class EndpointService {
    /**
     * Builds a ComputeCtlClient for the given connection parameters.
     * Called on each method invocation — clients are stateless and cheap.
     */
    buildClient(conn) {
        const axiosInstance = createHttpClient(conn.computeUrl);
        // Attach Bearer token if provided
        if (conn.authToken !== undefined) {
            axiosInstance.defaults.headers.common["Authorization"] =
                `Bearer ${conn.authToken}`;
        }
        return new ComputeCtlClient(axiosInstance);
    }
    /**
     * Returns the current runtime status of a compute_ctl instance.
     *
     * Calls GET /status on the target compute.
     *
     * Use this to:
     *   - Poll until `status === "running"` after calling configure()
     *   - Check if a compute is alive before issuing requests
     *   - Read the attached tenant_id/timeline_id
     *
     * @param conn - Connection parameters for the target compute.
     */
    async getStatus(conn) {
        return this.buildClient(conn).getStatus();
    }
    /**
     * Applies a new ComputeSpec to a running compute instance.
     *
     * Calls POST /configure on the target compute.
     *
     * This call is synchronous — compute_ctl waits until PostgreSQL reaches
     * the Running state before returning. Expect 2–30 s response time.
     *
     * Common uses:
     *   - Attach a compute to a different tenant/timeline (branch switch)
     *   - Update pageserver/safekeeper routing after topology changes
     *   - Apply new postgresql.conf settings without a full restart
     *
     * Preconditions enforced by compute_ctl:
     *   - Compute must be in `empty` or `running` state (HTTP 409 otherwise)
     *
     * @param conn    - Connection parameters for the target compute.
     * @param request - The ConfigurationRequest containing the spec.
     */
    async configure(conn, request) {
        return this.buildClient(conn).configure(request);
    }
    /**
     * Terminates a compute_ctl instance.
     *
     * Calls POST /terminate[?mode=fast|immediate] on the target compute.
     *
     * Auth: a compute-scoped JWT token is sufficient.
     * Source: /terminate uses the same auth layer as /status and /configure.
     * No Admin scope is required. (Verified 2026-08-10)
     *
     * Modes:
     *   fast (default) — waits up to 30 s; flushes WAL and returns the LSN
     *   immediate      — returns immediately; LSN will be null
     *
     * HTTP responses:
     *   200 OK      — first termination (Running → Terminated)
     *   201 Created — idempotent: already Terminated (same LSN returned)
     *   409 Conflict — not in Empty or Running state
     *
     * @param conn - Connection parameters for the target compute.
     * @param mode - Termination mode (default: "fast").
     */
    async terminate(conn, mode) {
        return this.buildClient(conn).terminate(mode);
    }
}
//# sourceMappingURL=endpoint.service.js.map