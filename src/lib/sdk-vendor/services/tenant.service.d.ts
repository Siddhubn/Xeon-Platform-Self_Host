import type { StorageControllerClient } from "../clients/storage-controller.client.js";
import type { TenantId, TenantInfo, TenantCreateRequest, TenantCreateResponse, TenantDescribeResponse } from "../types/tenant.js";
/**
 * Service layer for tenant operations.
 *
 * Responsibility: orchestration, not transport.
 * This layer sits above StorageControllerClient and below NeonSDK. It expresses
 * tenant operations in domain terms without any knowledge of HTTP, Axios,
 * URLs, or environment variables.
 *
 * The StorageControllerClient is injected at construction time, keeping this
 * class transport-independent and straightforward to substitute in tests.
 *
 * Method overview:
 *   list()     → TenantDescribeResponse[]  administrative view (shards, policy, config)
 *   get()      → TenantInfo               live pageserver view (state, physical size)
 *   describe() → TenantDescribeResponse   administrative view for a single tenant
 *   create()   → TenantCreateResponse
 *   delete()   → void
 *
 * Endpoint mapping:
 *   list()     uses GET /control/v1/tenant          (Storage Controller admin surface)
 *   get()      uses GET /v1/tenant/:id              (Virtual Pageserver passthrough)
 *   describe() uses GET /control/v1/tenant/:id      (Storage Controller admin surface)
 *   create()   uses POST /v1/tenant
 *   delete()   uses DELETE /v1/tenant/:id
 */
export declare class TenantService {
    private readonly storageController;
    constructor(storageController: StorageControllerClient);
    /**
     * Returns all tenants known to the Storage Controller.
     *
     * Calls GET /control/v1/tenant and returns TenantDescribeResponse[], which
     * contains the full administrative view: shard placements, placement policy,
     * and tenant config.
     *
     * This endpoint lives on the /control/v1/ administrative surface because
     * the /v1/ Virtual Pageserver prefix does not expose a tenant listing —
     * it only handles per-tenant operations (create, get, delete).
     *
     * @param options.limit      - Maximum number of tenants to return.
     * @param options.startAfter - Return only tenants with ID strictly after
     *   this value (exclusive lower bound for cursor-based pagination).
     */
    list(options?: {
        limit?: number;
        startAfter?: TenantId;
    }): Promise<TenantDescribeResponse[]>;
    /**
     * Returns the live pageserver state for a single tenant.
     *
     * Uses GET /v1/tenant/:id (passthrough to shard-zero pageserver).
     * Returns TenantInfo with live attachment state, physical size, and
     * GC blocking status.
     *
     * @param id - The 32-character hex tenant identifier.
     */
    get(id: TenantId): Promise<TenantInfo>;
    /**
     * Returns the full administrative description of a single tenant.
     *
     * Uses GET /control/v1/tenant/:id (Storage Controller admin surface).
     * Returns TenantDescribeResponse with shard placements, placement policy,
     * and tenant config from the Storage Controller's in-memory state.
     *
     * Use this when you need shard-level detail beyond what get() provides.
     *
     * @param id - The 32-character hex tenant identifier.
     */
    describe(id: TenantId): Promise<TenantDescribeResponse>;
    /**
     * Creates a new tenant on the Storage Controller.
     *
     * @param request - Creation parameters: desired tenant ID, optional shard
     *   configuration, and optional placement policy.
     *
     * @returns The shard placement assignments returned by the controller.
     */
    create(request: TenantCreateRequest): Promise<TenantCreateResponse>;
    /**
     * Deletes a tenant and all its associated data. Irreversible.
     *
     * @param id - The 32-character hex tenant identifier.
     */
    delete(id: TenantId): Promise<void>;
}
//# sourceMappingURL=tenant.service.d.ts.map