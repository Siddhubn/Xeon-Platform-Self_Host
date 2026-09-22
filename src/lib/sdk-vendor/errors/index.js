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
// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------
/**
 * Base class for all errors thrown by the Neon Platform SDK.
 * Preserves the original cause via `Error.cause` (Node ≥ 16.9 / ES2022).
 */
export class SdkError extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "SdkError";
        // Restore the prototype chain when compiled to CommonJS or older targets.
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
/**
 * Thrown when a required environment variable is missing or invalid.
 * Raised during SDK initialisation, before any network request is made.
 */
export class ConfigurationError extends SdkError {
    constructor(message, options) {
        super(message, options);
        this.name = "ConfigurationError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
// ---------------------------------------------------------------------------
// API / transport
// ---------------------------------------------------------------------------
/**
 * Thrown when the Storage Controller or Pageserver returns an HTTP error
 * that the SDK cannot recover from (after exhausting retries).
 *
 * `statusCode` is the HTTP status, or `undefined` if the request never
 * reached the server (e.g. connection refused or ECONNREFUSED).
 */
export class ApiError extends SdkError {
    statusCode;
    constructor(message, statusCode, options) {
        super(message, options);
        this.statusCode = statusCode;
        this.name = "ApiError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
/**
 * Thrown when the requested resource (tenant, timeline, etc.) does not exist.
 * Maps to HTTP 404.
 */
export class NotFoundError extends ApiError {
    constructor(resource, id, options) {
        super(`${resource} not found: ${id}`, 404, options);
        this.name = "NotFoundError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
/**
 * Thrown when the SDK request is rejected due to insufficient permissions.
 * Maps to HTTP 401 / 403.
 */
export class UnauthorizedError extends ApiError {
    constructor(message = "Unauthorized", options) {
        super(message, 401, options);
        this.name = "UnauthorizedError";
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
//# sourceMappingURL=index.js.map