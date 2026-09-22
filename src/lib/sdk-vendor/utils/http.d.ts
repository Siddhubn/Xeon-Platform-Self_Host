import { type AxiosInstance } from "axios";
/**
 * Creates a pre-configured Axios instance for the given `baseURL`.
 *
 * Built-in behaviour:
 * - Keep-alive connections via shared http/https agents
 * - 10 second request timeout
 * - Up to 3 retries on transient network/server failures
 * - Exponential backoff between retries (100 ms × 2^n)
 */
export declare function createHttpClient(baseURL: string): AxiosInstance;
//# sourceMappingURL=http.d.ts.map