// ---------------------------------------------------------------------------
// Connection Validator — tests actual PostgreSQL connectivity
// ---------------------------------------------------------------------------

import pg from "pg";
import type { ConnectionTestResult, SslMode } from "./types";

/**
 * Tests a real connection to the PostgreSQL database.
 * Returns a structured result with success/failure details.
 */
export async function testConnection(params: {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslMode: SslMode;
  /** Neon proxy routing option, e.g. `endpoint=ep-main` (required on the proxy). */
  options?: string;
  /** `direct` starts TLS immediately (needed through the Tailscale Funnel edge,
   *  which drops connections that begin with the classic SSLRequest preface). */
  sslnegotiation?: "postgres" | "direct";
  timeoutMs?: number;
}): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const timeout = params.timeoutMs || 10000;

  const client = new pg.Client({
    host: params.host,
    port: params.port,
    database: params.database,
    user: params.user,
    password: params.password,
    connectionTimeoutMillis: timeout,
    query_timeout: timeout,
    ssl: params.sslMode !== "disable" ? { rejectUnauthorized: false } : false,
    ...(params.options ? { options: params.options } : {}),
    ...(params.sslnegotiation ? { sslnegotiation: params.sslnegotiation } : {}),
  });

  try {
    await client.connect();

    // Run a safe test query
    const result = await client.query("SELECT version() AS version, NOW() AS connected_at");
    const version = result.rows[0]?.version || "unknown";
    const responseTimeMs = Date.now() - startTime;

    // Check SSL
    const sslResult = await client.query(
      "SHOW ssl"
    );
    const sslSupported = sslResult.rows[0]?.ssl === "on";

    await client.end();

    return {
      success: true,
      message: `Connection successful`,
      details: {
        host: params.host,
        port: params.port,
        reachable: true,
        postgresVersion: version,
        sslSupported,
        responseTimeMs,
      },
    };
  } catch (err: any) {
    const responseTimeMs = Date.now() - startTime;
    const msg = err.message || "Unknown error";

    // Classify the error
    let message = "Connection failed";
    if (msg.includes("ECONNREFUSED")) {
      message = `Unable to reach the database at ${params.host}:${params.port}. The port may not be listening.`;
    } else if (msg.includes("ENOTFOUND")) {
      message = `Hostname "${params.host}" could not be resolved. Check the connection address.`;
    } else if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
      message = `Connection timed out after ${timeout}ms. The host may be unreachable or firewall rules may be blocking the connection.`;
    } else if (msg.includes("password authentication failed") || msg.includes("Authentication failed")) {
      message = `PostgreSQL authentication failed for user "${params.user}". Check the username and password.`;
    } else if (msg.includes("ECONNRESET")) {
      message = `Connection was reset by the server at ${params.host}:${params.port}. The database may not be running or SSL may be required.`;
    } else if (msg.includes("does not exist")) {
      message = `Database "${params.database}" does not exist on the server.`;
    } else if (msg.includes("SSL")) {
      message = `SSL negotiation failed. The server may not support the requested SSL mode "${params.sslMode}".`;
    } else {
      message = `Connection failed: ${msg}`;
    }

    return {
      success: false,
      message,
      details: {
        host: params.host,
        port: params.port,
        reachable: false,
        sslSupported: false,
        responseTimeMs,
      },
      error: msg,
    };
  }
}
