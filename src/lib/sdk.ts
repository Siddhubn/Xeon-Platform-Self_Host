// Re-export the neon-platform-sdk from vendored copy.
// The SDK is copied here during build to avoid Turbopack resolution issues
// with symlinked file: dependencies.

export { NeonSDK } from "./sdk-vendor/index.js";
export { StorageControllerClient } from "./sdk-vendor/index.js";
export { createHttpClient } from "./sdk-vendor/index.js";
export { config } from "./sdk-vendor/index.js";
export { TenantService } from "./sdk-vendor/index.js";
export { TimelineService } from "./sdk-vendor/index.js";
export { ProjectService } from "./sdk-vendor/index.js";
export { NodeService } from "./sdk-vendor/index.js";
export { EndpointService } from "./sdk-vendor/index.js";
export { ComputeCtlClient } from "./sdk-vendor/index.js";

export type { EndpointConnection } from "./sdk-vendor/index.js";
export type { ProjectCreateResult, ProjectSummary, Project } from "./sdk-vendor/index.js";
