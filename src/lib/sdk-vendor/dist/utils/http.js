import http from "node:http";
import https from "node:https";
import axios from "axios";
import axiosRetry, { exponentialDelay, isNetworkError, isRetryableError, } from "axios-retry";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TIMEOUT_MS = 5_000;
const MAX_RETRIES = 1;
// ---------------------------------------------------------------------------
// Keep-alive agents
// A single pair of agents is reused across all client instances so that the
// underlying socket pool is shared and not re-created per client.
// ---------------------------------------------------------------------------
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });
// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
/**
 * Creates a pre-configured Axios instance for the given `baseURL`.
 *
 * Built-in behaviour:
 * - Keep-alive connections via shared http/https agents
 * - 10 second request timeout
 * - Up to 3 retries on transient network/server failures
 * - Exponential backoff between retries (100 ms × 2^n)
 */
export function createHttpClient(baseURL) {
    const client = axios.create({
        baseURL,
        timeout: TIMEOUT_MS,
        httpAgent,
        httpsAgent,
    });
    axiosRetry(client, {
        retries: MAX_RETRIES,
        retryDelay: exponentialDelay,
        retryCondition: (error) => isNetworkError(error) || isRetryableError(error),
        // Respect any Retry-After header returned by the server
        shouldResetTimeout: true,
    });
    return client;
}
//# sourceMappingURL=http.js.map