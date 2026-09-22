/**
 * SDK error hierarchy.
 *
 * All errors thrown by the SDK extend `SdkError`, giving callers a single
 * catch target. Concrete subclasses narrow the failure category so consumers
 * can handle them selectively without inspecting raw HTTP status codes.
 *
 * Extension point: if a reporting mechanism (Sentry, OpenTelemetry) is added
 * later, errors can be enriched here — services and clients remain unchanged.
 *
 * @example
 * ```ts
 * import { NeonSDK, ApiError, NotFoundError } from "neon-platform-sdk";
 *
 * try {
 *   await sdk.tenants.get(id);
 * } catch (err) {
 *   if (err instanceof NotFoundError) { ... }
 *   if (err instanceof ApiError)      { console.error(err.statusCode); }
 *   throw err;
 * }
 * ```
 */
/**
 * Base class for all errors thrown by the Neon Platform SDK.
 * Preserves the original cause via `Error.cause` (Node ≥ 16.9 / ES2022).
 */
export declare class SdkError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
/**
 * Thrown when a required environment variable is missing or invalid.
 * Raised during SDK initialisation, before any network request is made.
 */
export declare class ConfigurationError extends SdkError {
    constructor(message: string, options?: ErrorOptions);
}
/**
 * Thrown when the Storage Controller or Pageserver returns an HTTP error
 * that the SDK cannot recover from (after exhausting retries).
 *
 * `statusCode` is the HTTP status, or `undefined` if the request never
 * reached the server (e.g. connection refused or ECONNREFUSED).
 */
export declare class ApiError extends SdkError {
    readonly statusCode: number | undefined;
    constructor(message: string, statusCode: number | undefined, options?: ErrorOptions);
}
/**
 * Thrown when the requested resource (tenant, timeline, etc.) does not exist.
 * Maps to HTTP 404.
 */
export declare class NotFoundError extends ApiError {
    constructor(resource: string, id: string, options?: ErrorOptions);
}
/**
 * Thrown when the SDK request is rejected due to insufficient permissions.
 * Maps to HTTP 401 / 403.
 */
export declare class UnauthorizedError extends ApiError {
    constructor(message?: string, options?: ErrorOptions);
}
//# sourceMappingURL=index.d.ts.map