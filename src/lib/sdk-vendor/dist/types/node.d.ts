import type { NodeId } from "./tenant.js";
export type { NodeId } from "./tenant.js";
export type NodeAvailabilityWrapper = "Active" | "WarmingUp" | "Offline";
/**
 * @deprecated Use NodeAvailabilityWrapper.
 * Kept for backwards compatibility — the original type alias used a different
 * variant set ("Decomissioned") and did not include "WarmingUp".
 * New code should import NodeAvailabilityWrapper.
 */
export type NodeAvailability = NodeAvailabilityWrapper | "Decomissioned";
export type NodeSchedulingPolicy = "Active" | "Filling" | "Pause" | "Draining" | "Deleting";
/**
 * Request body for POST /control/v1/node.
 *
 * Registers a new pageserver node with the Storage Controller, or
 * re-registers an existing node (e.g. after a restart) to update its
 * listen addresses.
 */
export interface NodeRegisterRequest {
    /** Numeric pageserver node identifier. */
    readonly node_id: NodeId;
    /** Hostname or IP address for the PostgreSQL protocol port. */
    readonly listen_pg_addr: string;
    /** Port for the PostgreSQL protocol. */
    readonly listen_pg_port: number;
    /** Hostname or IP address for the gRPC port. Optional. */
    readonly listen_grpc_addr?: string;
    /** Port for the gRPC protocol. Optional. */
    readonly listen_grpc_port?: number;
    /** Hostname or IP address for the pageserver HTTP API. */
    readonly listen_http_addr: string;
    /** Port for the pageserver HTTP API. */
    readonly listen_http_port: number;
    /** Port for the HTTPS variant of the HTTP API. Optional. */
    readonly listen_https_port?: number;
    /**
     * Availability Zone identifier.
     * Serialised as a plain string from the Rust `AvailabilityZone(pub String)` newtype.
     * Use an empty string when AZ-awareness is not required.
     */
    readonly availability_zone_id: string;
    /**
     * Reachable IP address of the node, if known.
     * Used by the Hadron Cluster Coordinator to update the node's DNS record.
     * Serialised as a dotted-decimal IPv4 or colon-hex IPv6 string.
     * Optional — omit when not applicable.
     */
    readonly node_ip_addr?: string;
}
/**
 * Request body for PUT /control/v1/node/:node_id/config.
 *
 * Updates the availability state and/or scheduling policy of a node.
 * All fields except `node_id` are optional — omit any field whose current
 * value should be preserved.
 *
 * Note: the path `:node_id` and `node_id` in the body must match;
 * the Storage Controller returns HTTP 400 if they differ.
 */
export interface NodeConfigureRequest {
    /**
     * The node to configure.
     * Must equal the `:node_id` path parameter.
     */
    readonly node_id: NodeId;
    /**
     * New availability state, or omit to leave unchanged.
     * Uses NodeAvailabilityWrapper (the wire-format type), not NodeAvailability.
     */
    readonly availability?: NodeAvailabilityWrapper;
    /**
     * New scheduling policy, or omit to leave unchanged.
     */
    readonly scheduling?: NodeSchedulingPolicy;
}
/**
 * A single pageserver node as described by the Storage Controller.
 *
 * Returned by:
 *   GET /control/v1/node           → NodeDescribeResponse[]
 *   GET /control/v1/node/:node_id  → NodeDescribeResponse
 */
export interface NodeDescribeResponse {
    /** Numeric pageserver node identifier. */
    readonly id: NodeId;
    /**
     * Reachability state of the node.
     * The scheduler transitions this automatically via heartbeat.
     * Serialised as NodeAvailabilityWrapper on the wire.
     */
    readonly availability: NodeAvailabilityWrapper;
    /**
     * Administrative scheduling policy.
     * Changed via PUT /control/v1/node/:node_id/config.
     */
    readonly scheduling: NodeSchedulingPolicy;
    /** Hostname or IP address used to reach this node's HTTP API. */
    readonly listen_http_addr: string;
    /** Port used for the pageserver HTTP API on this node. */
    readonly listen_http_port: number;
    /** Hostname or IP address used for the pageserver PostgreSQL protocol port. */
    readonly listen_pg_addr: string;
    /** Port used for the PostgreSQL protocol on this node. */
    readonly listen_pg_port: number;
    /** Hostname or IP address used for the pageserver gRPC port. */
    readonly listen_grpc_addr: string;
    /** Port used for the gRPC protocol on this node. */
    readonly listen_grpc_port: number;
    /**
     * Number of primary (attached) shards currently placed on this node.
     * Reported by the Storage Controller from its in-memory scheduling state.
     */
    readonly primary_shard_count: number;
    /**
     * Number of secondary (warming) shards currently assigned to this node.
     */
    readonly secondary_shard_count: number;
    /**
     * Availability Zone identifier for this node.
     * Empty string when AZ-awareness is not configured.
     */
    readonly availability_zone_id: string;
}
//# sourceMappingURL=node.d.ts.map