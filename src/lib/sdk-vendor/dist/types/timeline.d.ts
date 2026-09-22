import type { TenantId, TenantShardId } from "./tenant.js";
/** 32-character hex string uniquely identifying a timeline. */
export type TimelineId = string;
/**
 * Log Sequence Number.  Serialised as a hex string by Neon's Rust code
 * (e.g. "0/1579D58").
 */
export type Lsn = string;
export type TimelineState = "Loading" | "Active" | "Stopping" | TimelineStateBroken;
export interface TimelineStateBroken {
    readonly Broken: {
        readonly reason: string;
        readonly backtrace: string;
    };
}
export type TimelineArchivalState = "Archived" | "Unarchived";
export type RelSizeMigration = "Legacy" | "Migrating" | "Migrated";
export interface TimelineInfo {
    readonly tenant_id: TenantShardId;
    readonly timeline_id: TimelineId;
    readonly ancestor_timeline_id: TimelineId | null;
    /** LSN of the branch point from the ancestor timeline. */
    readonly ancestor_lsn: Lsn | null;
    /** The last WAL record LSN ingested by this timeline. */
    readonly last_record_lsn: Lsn;
    readonly prev_record_lsn: Lsn | null;
    /** LSN up to which GC has run. Data older than this may be gone. */
    readonly applied_gc_cutoff_lsn: Lsn;
    /**
     * The oldest LSN at which new branches or endpoints may legally be created.
     * Data before this LSN may be GC'd at any time.
     */
    readonly min_readable_lsn: Lsn;
    readonly disk_consistent_lsn: Lsn;
    /** LSN successfully uploaded to remote storage. */
    readonly remote_consistent_lsn: Lsn;
    /** LSN being advertised to safekeepers. */
    readonly remote_consistent_lsn_visible: Lsn;
    /** LSN from the start of the root timeline (never changes). */
    readonly initdb_lsn: Lsn;
    readonly current_logical_size: number;
    readonly current_logical_size_is_accurate: boolean;
    readonly directory_entries_counts: readonly number[];
    /** Sum of layer file sizes; absent when the timeline is unloaded. */
    readonly current_physical_size: number | null;
    readonly current_logical_size_non_incremental: number | null;
    /** Bytes of WAL within this branch's pitr_interval. */
    readonly pitr_history_size: number;
    /**
     * True if this branch's branch point falls within its ancestor's PITR
     * interval (meaning the ancestor would retain those layers anyway).
     */
    readonly within_ancestor_pitr: boolean;
    readonly timeline_dir_layer_file_size_sum: number | null;
    readonly wal_source_connstr: string | null;
    readonly last_received_msg_lsn: Lsn | null;
    /** Microsecond timestamp of the last received WAL message. */
    readonly last_received_msg_ts: number | null;
    /** Major Postgres version, e.g. 16. */
    readonly pg_version: number;
    readonly state: TimelineState;
    readonly walreceiver_status: string;
    /** Whether the timeline is archived. Added in a later schema revision. */
    readonly is_archived: boolean | null;
    readonly rel_size_migration: RelSizeMigration | null;
    readonly rel_size_migrated_at: Lsn | null;
    /** Whether the timeline is excluded from synthetic size calculations. */
    readonly is_invisible: boolean | null;
    /**
     * Largest LSN below which all page updates are covered by image layers.
     * Optional – only present in HADRON builds.
     */
    readonly image_consistent_lsn?: Lsn;
}
export interface OffloadedTimelineInfo {
    readonly tenant_id: TenantShardId;
    readonly timeline_id: TimelineId;
    readonly ancestor_timeline_id: TimelineId | null;
    readonly ancestor_retain_lsn: Lsn | null;
    /** ISO-8601 timestamp of when the timeline was archived. */
    readonly archived_at: string;
}
export interface TimelinesInfoAndOffloaded {
    readonly timelines: readonly TimelineInfo[];
    readonly offloaded: readonly OffloadedTimelineInfo[];
}
/** Branch an existing timeline at an optional ancestor LSN. */
export interface TimelineCreateRequestBranch {
    readonly new_timeline_id: TimelineId;
    readonly ancestor_timeline_id: TimelineId;
    readonly ancestor_start_lsn?: Lsn;
    readonly pg_version?: number;
    readonly read_only?: boolean;
}
/** Bootstrap a brand-new root timeline (empty database). */
export interface TimelineCreateRequestBootstrap {
    readonly new_timeline_id: TimelineId;
    readonly existing_initdb_timeline_id?: TimelineId;
    readonly pg_version?: number;
}
/** Import Postgres data from an S3 object. */
export interface TimelineCreateRequestImport {
    readonly new_timeline_id: TimelineId;
    readonly import_pgdata: {
        readonly location: ImportPgdataLocationAwsS3;
        readonly idempotency_key: string;
    };
}
export interface ImportPgdataLocationAwsS3 {
    readonly AwsS3: {
        readonly region: string;
        readonly bucket: string;
        /** Object key prefix within the bucket. */
        readonly key: string;
    };
}
export type TimelineCreateRequest = TimelineCreateRequestBranch | TimelineCreateRequestBootstrap | TimelineCreateRequestImport;
export interface SafekeeperInfo {
    readonly id: number;
    readonly hostname: string;
}
export interface SafekeepersInfo {
    readonly tenant_id: TenantId;
    readonly timeline_id: TimelineId;
    readonly generation: number;
    readonly safekeepers: readonly SafekeeperInfo[];
}
export interface TimelineCreateResponseStorcon {
    /** Flattened TimelineInfo fields. */
    readonly tenant_id: TenantShardId;
    readonly timeline_id: TimelineId;
    readonly ancestor_timeline_id: TimelineId | null;
    readonly ancestor_lsn: Lsn | null;
    readonly last_record_lsn: Lsn;
    readonly prev_record_lsn: Lsn | null;
    readonly applied_gc_cutoff_lsn: Lsn;
    readonly min_readable_lsn: Lsn;
    readonly disk_consistent_lsn: Lsn;
    readonly remote_consistent_lsn: Lsn;
    readonly remote_consistent_lsn_visible: Lsn;
    readonly initdb_lsn: Lsn;
    readonly current_logical_size: number;
    readonly current_logical_size_is_accurate: boolean;
    readonly directory_entries_counts: readonly number[];
    readonly current_physical_size: number | null;
    readonly current_logical_size_non_incremental: number | null;
    readonly pitr_history_size: number;
    readonly within_ancestor_pitr: boolean;
    readonly timeline_dir_layer_file_size_sum: number | null;
    readonly wal_source_connstr: string | null;
    readonly last_received_msg_lsn: Lsn | null;
    readonly last_received_msg_ts: number | null;
    readonly pg_version: number;
    readonly state: TimelineState;
    readonly walreceiver_status: string;
    readonly is_archived: boolean | null;
    readonly rel_size_migration: RelSizeMigration | null;
    readonly rel_size_migrated_at: Lsn | null;
    readonly is_invisible: boolean | null;
    readonly image_consistent_lsn?: Lsn;
    /** Safekeeper assignment; only present in storcon responses. */
    readonly safekeepers: SafekeepersInfo | null;
}
export interface TenantTimelineDescribeResponse {
    readonly shards: readonly TimelineInfo[];
    readonly image_consistent_lsn?: Lsn;
}
export type { TenantId } from "./tenant.js";
//# sourceMappingURL=timeline.d.ts.map