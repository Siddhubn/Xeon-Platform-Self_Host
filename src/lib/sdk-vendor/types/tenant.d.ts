/** 32-character hex string uniquely identifying a tenant, e.g. "abc123...". */
export type TenantId = string;
/**
 * A tenant shard identifier serialised as either a bare TenantId (for the
 * unsharded case) or "<tenant_id>-<shard_number><shard_count>" (e.g.
 * "abc123...-0104").
 */
export type TenantShardId = string;
/** 32-character hex string uniquely identifying a node (pageserver). */
export type NodeId = number;
export interface TenantStateAttaching {
    readonly slug: "Attaching";
}
export interface TenantStateActivating {
    readonly slug: "Activating";
    /** Always "Attaching" in current codebase. */
    readonly data: "Attaching";
}
export interface TenantStateActive {
    readonly slug: "Active";
}
export interface TenantStateStopping {
    readonly slug: "Stopping";
}
export interface TenantStateBroken {
    readonly slug: "Broken";
    readonly data: {
        readonly reason: string;
        readonly backtrace: string;
    };
}
export type TenantState = TenantStateAttaching | TenantStateActivating | TenantStateActive | TenantStateStopping | TenantStateBroken;
export interface TenantAttachmentStatusMaybe {
    readonly slug: "maybe";
}
export interface TenantAttachmentStatusAttached {
    readonly slug: "attached";
}
export interface TenantAttachmentStatusFailed {
    readonly slug: "failed";
    readonly data: {
        readonly reason: string;
    };
}
export type TenantAttachmentStatus = TenantAttachmentStatusMaybe | TenantAttachmentStatusAttached | TenantAttachmentStatusFailed;
export interface TenantConfig {
    readonly checkpoint_distance?: number;
    readonly checkpoint_timeout?: string;
    readonly compaction_target_size?: number;
    readonly compaction_period?: string;
    readonly compaction_threshold?: number;
    readonly compaction_upper_limit?: number;
    readonly compaction_algorithm?: CompactionAlgorithmSettings;
    readonly compaction_shard_ancestor?: boolean;
    readonly compaction_l0_first?: boolean;
    readonly compaction_l0_semaphore?: boolean;
    readonly l0_flush_delay_threshold?: number;
    readonly l0_flush_stall_threshold?: number;
    readonly gc_horizon?: number;
    readonly gc_period?: string;
    readonly image_creation_threshold?: number;
    readonly image_layer_force_creation_period?: string;
    readonly pitr_interval?: string;
    readonly walreceiver_connect_timeout?: string;
    readonly lagging_wal_timeout?: string;
    readonly max_lsn_wal_lag?: number;
    readonly eviction_policy?: EvictionPolicy;
    readonly min_resident_size_override?: number;
    readonly evictions_low_residence_duration_metric_threshold?: string;
    readonly heatmap_period?: string;
    readonly lazy_slru_download?: boolean;
    readonly timeline_get_throttle?: ThrottleConfig;
    readonly image_layer_creation_check_threshold?: number;
    readonly image_creation_preempt_threshold?: number;
    readonly lsn_lease_length?: string;
    readonly lsn_lease_length_for_ts?: string;
    readonly timeline_offloading?: boolean;
    readonly rel_size_v2_enabled?: boolean;
    readonly gc_compaction_enabled?: boolean;
    readonly gc_compaction_verification?: boolean;
    readonly gc_compaction_initial_threshold_kb?: number;
    readonly gc_compaction_ratio_percent?: number;
    readonly relsize_snapshot_cache_capacity?: number;
    readonly basebackup_cache_enabled?: boolean;
}
/** Serialised as `{ kind: "Legacy" | "Tiered" }`. */
export interface CompactionAlgorithmSettings {
    readonly kind: "Legacy" | "Tiered";
}
/**
 * Serialised with a `kind` discriminant tag.
 *   { kind: "NoEviction" }
 *   { kind: "LayerAccessThreshold", period: "...", threshold: "..." }
 *   { kind: "OnlyImitiate",         period: "...", threshold: "..." }
 */
export type EvictionPolicy = {
    readonly kind: "NoEviction";
} | {
    readonly kind: "LayerAccessThreshold";
    readonly period: string;
    readonly threshold: string;
} | {
    readonly kind: "OnlyImitiate";
    readonly period: string;
    readonly threshold: string;
};
export interface ThrottleConfig {
    /** Non-empty array means throttle is enabled; empty means disabled. */
    readonly task_kinds: readonly string[];
    readonly initial: number;
    readonly refill_interval: string;
    readonly refill_amount: number;
    readonly max: number;
}
export interface ShardParameters {
    readonly count: number;
    readonly stripe_size: number;
}
export type PlacementPolicy = "Detached" | "Secondary" | {
    readonly Attached: number;
};
export interface TenantInfo {
    /** Shard-aware tenant identifier. */
    readonly id: TenantShardId;
    readonly state: TenantState;
    /** Sum of all layer files; only present on the detail endpoint. */
    readonly current_physical_size?: number;
    readonly attachment_status: TenantAttachmentStatus;
    readonly generation: number;
    /** Human-readable explanation of why GC is blocked (detail endpoint only). */
    readonly gc_blocking?: string;
}
export interface TenantCreateRequest extends TenantConfig {
    readonly new_tenant_id: TenantShardId;
    readonly generation?: number;
    readonly shard_parameters?: ShardParameters;
    readonly placement_policy?: PlacementPolicy;
}
export interface TenantCreateResponseShard {
    readonly shard_id: TenantShardId;
    readonly node_id: NodeId;
    readonly generation: number;
}
export interface TenantCreateResponse {
    readonly shards: readonly TenantCreateResponseShard[];
}
export interface TenantDescribeResponseShard {
    readonly tenant_shard_id: TenantShardId;
    readonly node_attached: NodeId | null;
    readonly node_secondary: readonly NodeId[];
    readonly last_error: string;
    readonly is_reconciling: boolean;
    readonly is_pending_compute_notification: boolean;
    readonly is_splitting: boolean;
    readonly is_importing: boolean;
    readonly scheduling_policy: ShardSchedulingPolicy;
    readonly preferred_az_id: string | null;
}
export interface TenantDescribeResponse {
    readonly tenant_id: TenantId;
    readonly shards: readonly TenantDescribeResponseShard[];
    readonly stripe_size: number;
    readonly policy: PlacementPolicy;
    readonly config: TenantConfig;
}
export type ShardSchedulingPolicy = "Active" | "Essential" | "Pause" | "Stop";
//# sourceMappingURL=tenant.d.ts.map