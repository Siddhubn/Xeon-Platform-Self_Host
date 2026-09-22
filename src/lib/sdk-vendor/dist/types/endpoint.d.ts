/**
 * The runtime status of a compute_ctl instance.
 *
 * Source: `ComputeStatus` in responses.rs
 * Serde: `#[serde(rename_all = "snake_case")]`
 * Wire values: snake_case strings
 */
export type ComputeStatus = "empty" | "configuration_pending" | "init" | "running" | "configuration" | "failed" | "termination_pending_fast" | "termination_pending_immediate" | "terminated" | "refresh_configuration_pending" | "refresh_configuration";
/**
 * Termination mode for POST /terminate.
 * Source: `TerminateMode` in responses.rs
 * Serde: `#[serde(rename_all = "snake_case")]`
 */
export type TerminateMode = "fast" | "immediate";
/**
 * Response from GET /status on a compute_ctl instance.
 * Source: `ComputeStatusResponse` in responses.rs
 * Serde: `#[serde(rename_all = "snake_case")]`
 */
export interface ComputeStatusResponse {
    readonly start_time: string;
    readonly tenant: string | null;
    readonly timeline: string | null;
    readonly status: ComputeStatus;
    readonly last_active: string | null;
    readonly error: string | null;
}
/**
 * Response from POST /terminate on a compute_ctl instance.
 * Source: `TerminateResponse` in responses.rs
 */
export interface TerminateResponse {
    readonly lsn: string | null;
}
/**
 * Audit log level.
 * Source: `ComputeAudit` in spec.rs (no serde rename — variant names are wire values)
 */
export type ComputeAudit = "Disabled" | "Log" | "Base" | "Hipaa" | "Extended" | "Full";
/**
 * Compute operating mode.
 * Source: `ComputeMode` in spec.rs
 *
 * - `"Primary"` — read-write primary
 * - `"Replica"` — hot-standby read-only replica
 * - `{ "Static": "0/1234" }` — read-only, pinned at a specific LSN
 */
export type ComputeMode = "Primary" | "Replica" | {
    readonly Static: string;
};
/**
 * Feature flags for compute_ctl.
 * Source: `ComputeFeature` in spec.rs
 * Serde: `#[serde(rename_all = "snake_case")]`
 *
 * Note: `#[serde(other)]` on `UnknownFeature` is deserialization-only.
 * Any unknown string value deserializes to `UnknownFeature`, which then
 * serializes back as `"unknown_feature"`. Arbitrary strings are NOT preserved.
 */
export type ComputeFeature = "activity_monitor_experimental" | "tls_experimental" | "unknown_feature";
/**
 * A single postgresql option / GUC setting.
 * Source: `GenericOption` in spec.rs
 */
export interface ComputeGenericOption {
    readonly name: string;
    readonly value: string | null;
    readonly vartype: string;
}
/**
 * GenericOptions wire type: null, or an array of ComputeGenericOption.
 * Source: `pub type GenericOptions = Option<Vec<GenericOption>>` in spec.rs
 */
export type ComputeGenericOptions = readonly ComputeGenericOption[] | null;
/**
 * A PostgreSQL role.
 * Source: `Role` in spec.rs (deployed server, verified 2026-08-10)
 *
 * The deployed server's Role struct is: `{ name: PgIdent, options: GenericOptions }`.
 * `encrypted_password` is included as an optional field for forward compatibility
 * with server versions that expose it. Omit or pass null for this deployment.
 * `options` is GenericOptions (null or array of ComputeGenericOption).
 */
export interface ComputeRole {
    readonly name: string;
    readonly encrypted_password?: string | null;
    readonly options: ComputeGenericOptions;
}
/**
 * A PostgreSQL database.
 * Source: `Database` in spec.rs
 *
 * `restrict_conn` and `invalid` are NOT request fields (skip_deserializing).
 * `options` is GenericOptions (null or array of ComputeGenericOption).
 */
export interface ComputeDatabase {
    readonly name: string;
    readonly owner: string;
    readonly options: ComputeGenericOptions;
}
/**
 * A cluster state change operation (DROP DATABASE, DROP ROLE, RENAME, etc.)
 * Source: `DeltaOp` in spec.rs
 */
export interface ComputeDeltaOperation {
    readonly action: string;
    readonly name: string;
    readonly new_name: string | null;
}
/**
 * Expected cluster state for a compute.
 * Source: `Cluster` in spec.rs
 *
 * `roles` and `databases` are required arrays (Vec<T> in Rust — never omitted).
 * `settings` is GenericOptions (null or array of ComputeGenericOption).
 */
export interface ComputeCluster {
    readonly cluster_id: string | null;
    readonly name: string | null;
    readonly state: string | null;
    readonly roles: readonly ComputeRole[];
    readonly databases: readonly ComputeDatabase[];
    readonly postgresql_conf: string | null;
    readonly settings: ComputeGenericOptions;
}
/** Source: `PageserverProtocol` in spec.rs */
export type PageserverProtocol = "libpq" | "grpc";
/**
 * Connection info for a single pageserver within a shard.
 * Source: `PageserverShardConnectionInfo` in spec.rs
 *
 * `id` is Option<NodeId>. NodeId is #[serde(transparent)] over u64 → number | null.
 */
export interface PageserverShardConnectionInfo {
    readonly id: number | null;
    readonly libpq_url: string | null;
    readonly grpc_url: string | null;
}
/** Source: `PageserverShardInfo` in spec.rs */
export interface PageserverShardInfo {
    readonly pageservers: readonly PageserverShardConnectionInfo[];
}
/**
 * Pageserver connection info for all shards.
 * Source: `PageserverConnectionInfo` in spec.rs
 *
 * `shard_count`: ShardCount(u8) → plain number. 0 = unsharded.
 * `stripe_size`: ShardStripeSize(u32) → plain number, or null.
 * `shards` keys: ShardIndex → 4-char lowercase hex string
 *   format: "{:02x}{:02x}" % (shard_number, shard_count)
 *   e.g. "0000" = unsharded, "0104" = shard 1 of 4
 * `prefer_protocol`: #[serde(default)] → "libpq" if absent
 */
export interface PageserverConnectionInfo {
    readonly shard_count: number;
    readonly stripe_size: number | null;
    readonly shards: Record<string, PageserverShardInfo>;
    readonly prefer_protocol: PageserverProtocol;
}
/** Source: `ExtensionData` in spec.rs */
export interface ComputeExtensionData {
    readonly control_data: Record<string, string>;
    readonly archive_path: string;
}
/** Source: `RemoteExtSpec` in spec.rs */
export interface ComputeRemoteExtSpec {
    readonly public_extensions: readonly string[] | null;
    readonly custom_extensions: readonly string[] | null;
    readonly library_index: Record<string, string>;
    readonly extension_data: Record<string, ComputeExtensionData>;
}
/**
 * TLS configuration.
 * Source: `TlsConfig` in responses.rs
 */
export interface ComputeTlsConfig {
    readonly key_path: string;
    readonly cert_path: string;
}
/** Source: `JwksSettings` in spec.rs */
export interface ComputeJwksSettings {
    readonly id: string;
    readonly role_names: readonly string[];
    readonly jwks_url: string;
    readonly provider_name: string;
    readonly jwt_audience: string | null;
}
/**
 * Local proxy JWT and TLS configuration.
 * Source: `LocalProxySpec` in spec.rs
 *
 * Both fields use #[serde(skip_serializing_if = "Option::is_none")]:
 * they are absent from JSON (not null) when not set.
 */
export interface ComputeLocalProxySpec {
    readonly jwks?: readonly ComputeJwksSettings[];
    readonly tls?: ComputeTlsConfig;
}
/** Source: `PgComputeTlsSettings` in spec.rs */
export interface ComputePgTlsSettings {
    readonly cert_file: string;
    readonly key_file: string;
    readonly ca_file: string;
}
/** Source: `DatabricksSettings` in spec.rs */
export interface ComputeDatabricksSettings {
    readonly pg_compute_tls_settings: ComputePgTlsSettings;
    readonly databricks_pg_hba: string;
    readonly databricks_pg_ident: string;
    readonly databricks_workspace_host: string;
}
/**
 * compute_ctl operational configuration.
 * Source: `ComputeCtlConfig` in responses.rs
 *
 * `jwks` is required (JwkSet, not Option). Its JSON form is `{ "keys": [...] }`.
 * Pass `{ keys: [] }` when re-configuring a running compute to preserve JWKS.
 * `tls` is Option<TlsConfig> → null when not configured.
 */
export interface ComputeCtlConfig {
    readonly jwks: {
        readonly keys: readonly unknown[];
    };
    readonly tls: ComputeTlsConfig | null;
}
/**
 * The complete ComputeSpec wire type.
 * Source: `ComputeSpec` in spec.rs
 *
 * ALL fields have been verified from the Neon source.
 * Do NOT send a partial spec — compute_ctl will reject missing required fields.
 * Use the golden fixture (tests/fixtures/sdk-compute-test-spec.json) as a
 * template or load from .neon/endpoints/<id>/config.json.
 */
export interface ComputeSpec {
    readonly format_version: number;
    readonly operation_uuid: string | null;
    readonly features: readonly ComputeFeature[];
    readonly swap_size_bytes: number | null;
    readonly disk_quota_bytes: number | null;
    readonly disable_lfc_resizing: boolean | null;
    readonly cluster: ComputeCluster;
    readonly delta_operations: readonly ComputeDeltaOperation[] | null;
    readonly skip_pg_catalog_updates: boolean;
    readonly tenant_id: string | null;
    readonly timeline_id: string | null;
    readonly pageserver_connection_info: PageserverConnectionInfo | null;
    readonly pageserver_connstring: string | null;
    readonly shard_stripe_size: number | null;
    readonly project_id: string | null;
    readonly branch_id: string | null;
    readonly endpoint_id: string | null;
    readonly safekeepers_generation: number | null;
    readonly safekeeper_connstrings: readonly string[];
    readonly mode: ComputeMode;
    readonly storage_auth_token: string | null;
    readonly remote_extensions: ComputeRemoteExtSpec | null;
    readonly pgbouncer_settings: Record<string, string> | null;
    readonly local_proxy_config: ComputeLocalProxySpec | null;
    readonly reconfigure_concurrency: number;
    readonly drop_subscriptions_before_start: boolean;
    readonly audit_log_level: ComputeAudit;
    readonly logs_export_host: string | null;
    readonly endpoint_storage_addr: string | null;
    readonly endpoint_storage_token: string | null;
    readonly autoprewarm: boolean;
    readonly offload_lfc_interval_seconds: number | null;
    /**
     * Required — no #[serde(default)], not Option<T>.
     * Confirmed by golden fixture: -1 (never suspend).
     */
    readonly suspend_timeout_seconds: number;
    readonly databricks_settings: ComputeDatabricksSettings | null;
}
/**
 * Request body for POST /configure on a compute_ctl instance.
 * Source: `ConfigurationRequest` in requests.rs
 *
 * Both fields are required. `spec` must be a complete valid ComputeSpec.
 * `compute_ctl_config.jwks` must be present; pass `{ keys: [] }` to preserve
 * the existing JWKS when re-configuring a running compute.
 */
export interface ComputeConfigurationRequest {
    readonly spec: ComputeSpec;
    readonly compute_ctl_config: ComputeCtlConfig;
}
//# sourceMappingURL=endpoint.d.ts.map