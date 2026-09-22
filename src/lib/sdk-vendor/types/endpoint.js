// ---------------------------------------------------------------------------
// Compute Endpoint (compute_ctl) types
//
// Every field and type in this file has been verified directly against the
// Neon source code on the deployed server (2026-08-10):
//
//   /opt/neon/libs/compute_api/src/spec.rs
//   /opt/neon/libs/compute_api/src/requests.rs
//   /opt/neon/libs/compute_api/src/responses.rs
//   /opt/neon/libs/utils/src/id.rs
//   /opt/neon/libs/utils/src/shard.rs
//
// Golden fixture cross-checked:
//   tests/fixtures/sdk-compute-test-spec.json
//
// Architecture note
// ─────────────────
// Compute Endpoints are NOT managed through the Storage Controller.
// Each running compute_ctl instance has its own HTTP server.
// This file mirrors the JSON wire format of compute_ctl exactly.
//
// compute_ctl HTTP routes covered:
//   GET  /status     → ComputeStatusResponse
//   POST /configure  → ConfigurationRequest body → ComputeStatusResponse
//   POST /terminate  → ?mode=fast|immediate → TerminateResponse
// ---------------------------------------------------------------------------
export {};
//# sourceMappingURL=endpoint.js.map