import { isAxiosError } from "axios";
import { ApiError, NotFoundError, UnauthorizedError, } from "../errors/index.js";
/**
 * HTTP client for the compute_ctl per-instance API.
 *
 * Responsibility: transport only.
 * This class is the boundary between the SDK and a single running compute_ctl
 * process. Each compute_ctl instance runs its own HTTP server (typically on
 * port 3080 or a dynamically assigned port). This client is configured with
 * the base URL of a specific instance.
 *
 * This client is NOT for the Storage Controller. It connects directly to a
 * running compute_ctl HTTP server.
 *
 * ## Architecture
 *
 * Unlike the Storage Controller, compute_ctl is a per-compute daemon. There is
 * no cluster-level list endpoint. Each running compute instance is addressed
 * individually by its HTTP base URL.
 *
 * ## Auth
 *
 * compute_ctl validates Bearer JWT tokens on all routes except `/metrics` and
 * `/autoscaling_metrics`. The AxiosInstance injected here is expected to carry
 * an `Authorization: Bearer <token>` header or have it set per-request.
 *
 * In the local dev environment (neon_local), tokens are generated with Ed25519
 * keys. In production the control plane issues them.
 *
 * For the SDK's read-only operations (`getStatus`), most deployments allow a
 * compute-scoped token (claim: `{ aud: ["compute"] }`).
 * For `terminate`, a compute-scoped token is also sufficient — the same
 * `AsyncRequireAuthorizationLayer` protects all three routes (/status,
 * /configure, /terminate). No Admin scope is required.
 * Source: authorize.rs + server.rs (verified 2026-08-10)
 *
 * ## Endpoint surface
 *
 *   GET  /status     — poll compute runtime state
 *   POST /configure  — push a new ComputeSpec; synchronous (waits for Running)
 *   POST /terminate  — terminate Postgres; ?mode=fast (default) | immediate
 */
export class ComputeCtlClient {
    client;
    constructor(client) {
        this.client = client;
    }
    // ---------------------------------------------------------------------------
    // Private transport helpers
    // ---------------------------------------------------------------------------
    async fetch(path) {
        try {
            const response = await this.client.get(path);
            return response.data;
        }
        catch (err) {
            throw ComputeCtlClient.wrapError(err, path);
        }
    }
    async post(path, body) {
        try {
            const response = await this.client.post(path, body);
            return response.data;
        }
        catch (err) {
            throw ComputeCtlClient.wrapError(err, path);
        }
    }
    static wrapError(err, path) {
        if (!isAxiosError(err)) {
            return err;
        }
        const status = err.response?.status;
        const serverMessage = err.response?.data
            ?.error ??
            err.response?.data
                ?.msg ??
            err.message;
        const cause = { cause: err };
        if (status === 404)
            return new NotFoundError("resource", path, cause);
        if (status === 401 || status === 403)
            return new UnauthorizedError(serverMessage, cause);
        return new ApiError(serverMessage, status, cause);
    }
    // ---------------------------------------------------------------------------
    // compute_ctl API
    // ---------------------------------------------------------------------------
    /**
     * Returns the current runtime status of this compute instance.
     *
     * Calls: GET /status
     *
     * Returns ComputeStatusResponse with the current ComputeStatus, attached
     * tenant/timeline IDs, last-active timestamp, and any error message.
     *
     * This is the primary health-check and lifecycle-polling method.
     * Poll this until `status === "running"` after calling configure().
     */
    async getStatus() {
        return this.fetch("/status");
    }
    /**
     * Applies a new ComputeSpec to this compute instance.
     *
     * Calls: POST /configure
     *
     * This call is SYNCHRONOUS from the perspective of the compute_ctl HTTP
     * server — it blocks until Postgres reaches the `Running` state (or fails)
     * before returning. Typical response time is 2–30 seconds depending on
     * basebackup size.
     *
     * Precondition: compute must be in `Empty` or `Running` state.
     * Returns HTTP 409 (ApiError) if the compute is in any other state.
     *
     * On success returns ComputeStatusResponse with status="running".
     * On failure returns HTTP 500 (ApiError) with the error detail.
     *
     * @param request - ConfigurationRequest containing the spec and
     *   compute_ctl_config. For re-configuring a running compute, pass an
     *   empty object for compute_ctl_config: `{ spec: ..., compute_ctl_config: {} }`.
     */
    async configure(request) {
        return this.post("/configure", request);
    }
    /**
     * Terminates this compute instance.
     *
     * Calls: POST /terminate[?mode=fast|immediate]
     *
     * Auth: a compute-scoped JWT token is sufficient.
     * Source: /terminate is on the same authenticated_router as /status and
     * /configure — no Admin scope is required.
     * (Verified from authorize.rs + server.rs, 2026-08-10)
     *
     * Modes:
     *   fast (default) — waits up to 30 s; allows WAL flush and LSN collection
     *   immediate      — returns immediately after all components are terminated
     *
     * HTTP responses:
     *   200 OK      — first termination (Running → Terminated)
     *   201 Created — idempotent: compute already Terminated (same LSN returned)
     *   409 Conflict — compute is not in Empty or Running state
     *
     * The response includes the WAL flush LSN (null for immediate mode).
     *
     * @param mode - Termination mode (default: "fast").
     */
    async terminate(mode) {
        const query = mode !== undefined ? `?mode=${mode}` : "";
        return this.post(`/terminate${query}`);
    }
}
//# sourceMappingURL=compute-ctl.client.js.map