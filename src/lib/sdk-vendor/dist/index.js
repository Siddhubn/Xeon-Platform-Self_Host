import { config } from "./config.js";
import { StorageControllerClient } from "./clients/storage-controller.client.js";
import { TenantService } from "./services/tenant.service.js";
import { TimelineService } from "./services/timeline.service.js";
import { ProjectService } from "./services/project.service.js";
import { NodeService } from "./services/node.service.js";
import { EndpointService } from "./services/endpoint.service.js";
import { createHttpClient } from "./utils/http.js";
// ---------------------------------------------------------------------------
// Internal client builders
// One function per future client keeps the NeonSDK constructor a flat list of
// property assignments. When PageserverClient, MinioClient, or
// EndpointStorageClient are added, they each get their own builder here.
// ---------------------------------------------------------------------------
/** @internal */
function buildStorageControllerClient() {
    return new StorageControllerClient(createHttpClient(config.storage.controllerUrl));
}
// ---------------------------------------------------------------------------
// NeonSDK
// ---------------------------------------------------------------------------
/**
 * NeonSDK is the single public entry point for the self-hosted Neon Platform SDK.
 *
 * Constructing it wires the full dependency graph:
 *
 *   config
 *     └─ createHttpClient(controllerUrl)
 *           └─ StorageControllerClient
 *                 ├─ TenantService   →  sdk.tenants
 *                 └─ TimelineService →  sdk.timelines
 *
 * Usage:
 *   const sdk = new NeonSDK();
 *
 *   // Tenants (admin list — GET /control/v1/tenant)
 *   const tenants = await sdk.tenants.list();
 *   const page    = await sdk.tenants.list({ limit: 10, startAfter: "abc..." });
 *
 *   // Tenants (live pageserver state — GET /v1/tenant/:id)
 *   const tenant  = await sdk.tenants.get("abc123...");
 *
 *   // Tenants (admin describe — GET /control/v1/tenant/:id)
 *   const detail  = await sdk.tenants.describe("abc123...");
 *
 *   // Tenants (create / delete — POST|DELETE /v1/tenant)
 *   const result  = await sdk.tenants.create({ new_tenant_id: "abc123..." });
 *   await sdk.tenants.delete("abc123...");
 *
 *   // Timelines (pageserver passthrough — GET /v1/tenant/:id/timeline)
 *   const timelines = await sdk.timelines.list("abc123...");
 *
 *   // Timelines (cross-shard describe — GET /control/v1/tenant/:id/timeline/:id)
 *   const timeline  = await sdk.timelines.get("abc123...", "def456...");
 *
 *   // Timelines (create — POST /v1/tenant/:id/timeline)
 *   const created = await sdk.timelines.create("abc123...", {
 *     new_timeline_id: "def456...",
 *     pg_version: 16,
 *   });
 *
 *   // Timelines (delete — DELETE /v1/tenant/:id/timeline/:id)
 *   await sdk.timelines.delete("abc123...", "def456...");
 *
 *   // Projects (Tenant + Bootstrap Timeline in one call)
 *   const project = await sdk.projects.create();
 *   // project.tenantId, project.tenant, project.timelineId, project.timeline
 *
 *   // Projects (list all as ProjectSummary[])
 *   const projects = await sdk.projects.list();
 *
 *   // Projects (get full details — returns Project)
 *   const detail = await sdk.projects.get("abc123...");
 *
 *   // Projects (delete — removes all timelines then the tenant)
 *   await sdk.projects.delete("abc123...");
 *   // project.tenantId, project.tenant, project.timelineId, project.timeline
 *
 *   // Branches (create a branch timeline from an existing timeline)
 *   const branch = await sdk.projects.createBranch({
 *     projectId: "abc123...",
 *     ancestorTimelineId: "def456...",
 *     name: "feature/my-branch",   // optional
 *   });
 *   // branch.branchTimelineId, branch.ancestorTimelineId, branch.pgVersion
 *
 *   // Branches (list only branch timelines — root Bootstrap Timeline excluded)
 *   const branches = await sdk.projects.listBranches("abc123...");
 *
 *   // Branches (get full branch details including cross-shard describe)
 *   const detail = await sdk.projects.getBranch("abc123...", "ghi789...");
 *
 *   // Branches (delete a single branch — never deletes root or unrelated timelines)
 *   await sdk.projects.deleteBranch("abc123...", "ghi789...");
 *
 *   // Nodes (list all pageserver nodes — GET /control/v1/node)
 *   const nodes = await sdk.nodes.list();
 *
 *   // Nodes (single node status — GET /control/v1/node/:node_id)
 *   const node = await sdk.nodes.get(1);
 *
 *   // Nodes (register a new pageserver — POST /control/v1/node)
 *   await sdk.nodes.register({
 *     node_id: 1,
 *     listen_http_addr: "pageserver-1", listen_http_port: 9898,
 *     listen_pg_addr:   "pageserver-1", listen_pg_port:   64000,
 *     availability_zone_id: "us-east-1a",
 *   });
 *
 *   // Nodes (configure availability / scheduling — PUT /control/v1/node/:id/config)
 *   await sdk.nodes.configure(1, { node_id: 1, scheduling: "Pause" });
 *
 *   // Nodes (scheduling convenience helpers — all via configure(), no new endpoints)
 *   await sdk.nodes.drain(1);        // scheduling → "Draining"
 *   await sdk.nodes.cancelDrain(1);  // scheduling → "Active"
 *   await sdk.nodes.fill(1);         // scheduling → "Filling"
 *   await sdk.nodes.cancelFill(1);   // scheduling → "Active"
 *
 *   // Nodes (async deletion — PUT /control/v1/node/:id/delete)
 *   await sdk.nodes.delete(1);               // start deletion; returns immediately
 *   await sdk.nodes.delete(1, {force:true}); // skip waiting for observed locations
 *
 *   // Nodes (cancel an in-progress deletion — DELETE /control/v1/node/:id/delete)
 *   await sdk.nodes.cancelDelete(1);
 *
 *   // Compute Endpoints (status of a specific running compute_ctl instance)
 *   const conn = { computeUrl: "http://localhost:3080", authToken: "..." };
 *   const status = await sdk.compute.getStatus(conn);
 *   // status.status, status.tenant, status.timeline, status.last_active
 *
 *   // Compute Endpoints (apply a new spec to a running compute)
 *   await sdk.compute.configure(conn, { spec: { ... }, compute_ctl_config: {} });
 *
 *   // Compute Endpoints (terminate a compute — Admin JWT required)
 *   const result = await sdk.compute.terminate(conn);          // fast (default)
 *   const result = await sdk.compute.terminate(conn, "immediate");
 *   // result.lsn — WAL flush LSN at termination time
 *
 * Extension point: adding a new Neon component follows three steps:
 *   1. Create `src/clients/<name>.client.ts` + a `build<Name>Client()` builder.
 *   2. Create `src/services/<name>.service.ts`.
 *   3. Add `readonly <name>: <NameService>` here and assign it in the constructor.
 */
export class NeonSDK {
    /** Tenant operations: list(), get(id), describe(id), create(r), delete(id) */
    tenants;
    /** Timeline operations: list(tenantId), get(tenantId, timelineId), create(), delete() */
    timelines;
    /** Project operations: create(), list(), get(id), delete(id), createBranch(), listBranches(id), getBranch(id, tlId), deleteBranch(id, tlId) */
    projects;
    /** Node operations: list(), get(nodeId), register(r), configure(nodeId,r), drain(nodeId), cancelDrain(nodeId), fill(nodeId), cancelFill(nodeId), delete(nodeId,opts), cancelDelete(nodeId) */
    nodes;
    /**
     * Compute Endpoint operations: getStatus(conn), configure(conn,req), terminate(conn,mode?)
     *
     * NOTE: These operations connect directly to a specific running compute_ctl instance
     * (not the Storage Controller). Supply the compute's HTTP address in `conn.computeUrl`.
     * There is no cluster-level endpoint list — each compute is addressed individually.
     */
    compute;
    constructor() {
        const storageController = buildStorageControllerClient();
        this.tenants = new TenantService(storageController);
        this.timelines = new TimelineService(storageController);
        this.projects = new ProjectService(this.tenants, this.timelines);
        this.nodes = new NodeService(storageController);
        this.compute = new EndpointService();
    }
}
// ---------------------------------------------------------------------------
// Named re-exports
// Consumers can import types and building blocks directly from the package
// root without knowing the internal folder structure. Useful for advanced
// use cases such as creating a custom service with a pre-configured client.
// ---------------------------------------------------------------------------
// Config
export { config } from "./config.js";
// HTTP utility
export { createHttpClient } from "./utils/http.js";
// Clients
export { StorageControllerClient } from "./clients/storage-controller.client.js";
export { ComputeCtlClient } from "./clients/compute-ctl.client.js";
// Services
export { TenantService } from "./services/tenant.service.js";
export { TimelineService } from "./services/timeline.service.js";
export { ProjectService } from "./services/project.service.js";
export { NodeService } from "./services/node.service.js";
export { EndpointService } from "./services/endpoint.service.js";
// Errors
export { SdkError, ConfigurationError, ApiError, NotFoundError, UnauthorizedError, } from "./errors/index.js";
//# sourceMappingURL=index.js.map