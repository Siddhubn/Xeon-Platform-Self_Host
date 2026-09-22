// ---------------------------------------------------------------------------
// Connection Service — orchestrates connection details resolution
// ---------------------------------------------------------------------------

import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type {
  ConnectionStringInput,
  ConnectionStringOutput,
  ConnectionTestResult,
  TailscaleStatus,
  ConnectionNetworkMode,
  SslMode,
} from "./types";
import { resolveHost, resolveSslMode } from "./connection-host-resolver";
import { resolveTailscaleStatus } from "./tailscale-resolver";
import { generateConnectionStrings } from "./connection-string-generator";
import { testConnection as testPgConnection } from "./connection-validator";

export class ConnectionService {
  private db = getDb();

  /**
   * Get full connection details for a project/branch combination.
   */
  async getConnectionDetails(params: {
    projectId: string;
    branchId: string;
    databaseName?: string;
    roleName?: string;
    password?: string;
    networkMode?: ConnectionNetworkMode;
    connectionType?: "direct" | "pooled";
    sslMode?: SslMode;
    customHost?: string;
  }): Promise<ConnectionStringOutput> {
    const {
      projectId,
      branchId,
      networkMode = "auto",
      connectionType = "direct",
      sslMode,
      customHost,
    } = params;

    // Resolve compute for this branch
    const compute = this.db
      .select()
      .from(schema.computes)
      .where(
        and(
          eq(schema.computes.projectId, projectId),
          eq(schema.computes.branchId, branchId),
          isNull(schema.computes.deletedAt)
        )
      )
      .get();

    const computeHost = compute?.host || process.env.POSTGRES_HOST || "localhost";
    const computePort = compute?.port || parseInt(process.env.POSTGRES_PORT || "5432");

    // Derive endpoint ID from compute name (the compute name IS the endpoint ID)
    const endpointId = compute?.name || undefined;

    // Resolve the host based on network mode
    const resolvedHost = resolveHost(
      networkMode,
      computeHost,
      computePort,
      customHost,
      endpointId
    );

    // Resolve database and role
    const databaseName = params.databaseName || compute?.database || "neondb";
    const roleName = params.roleName || compute?.role || process.env.POSTGRES_USER || "cloud_admin";

    // Resolve SSL
    const resolvedSsl = resolveSslMode(networkMode, sslMode);

    // Resolve pooler (if configured)
    const poolerHost = process.env.NEON_POOLER_HOST || "";
    const poolerPort = process.env.NEON_POOLER_PORT
      ? parseInt(process.env.NEON_POOLER_PORT)
      : undefined;

    // Generate all connection formats
    const input: ConnectionStringInput = {
      projectId,
      branchId,
      databaseName,
      roleName,
      password: params.password,
      networkMode,
      connectionType,
      sslMode: resolvedSsl,
      customHost,
      poolerHost: poolerHost || undefined,
      poolerPort,
      endpointId,
    };

    return generateConnectionStrings(input, {
      host: resolvedHost.host,
      port: resolvedHost.port,
      source: resolvedHost.source,
      tailscaleInfo: resolvedHost.tailscaleInfo,
    });
  }

  /**
   * Test a real connection to the PostgreSQL database.
   */
  async testConnection(params: {
    projectId: string;
    branchId: string;
    databaseName?: string;
    roleName?: string;
    password: string;
    networkMode?: ConnectionNetworkMode;
    sslMode?: SslMode;
    customHost?: string;
  }): Promise<ConnectionTestResult> {
    const {
      projectId,
      branchId,
      networkMode = "auto",
      sslMode,
      customHost,
    } = params;

    // Resolve compute
    const compute = this.db
      .select()
      .from(schema.computes)
      .where(
        and(
          eq(schema.computes.projectId, projectId),
          eq(schema.computes.branchId, branchId),
          isNull(schema.computes.deletedAt)
        )
      )
      .get();

    const computeHost = compute?.host || process.env.POSTGRES_HOST || "localhost";
    const computePort = compute?.port || parseInt(process.env.POSTGRES_PORT || "5432");

    // Derive endpoint ID from compute name
    const endpointId = compute?.name || undefined;

    // Resolve host
    const resolvedHost = resolveHost(
      networkMode,
      computeHost,
      computePort,
      customHost,
      endpointId
    );

    const databaseName = params.databaseName || compute?.database || "neondb";
    const roleName = params.roleName || compute?.role || process.env.POSTGRES_USER || "cloud_admin";
    const resolvedSsl = resolveSslMode(networkMode, sslMode);

    // For "local" connections without a password, use the env password
    const password = params.password || process.env.POSTGRES_PASSWORD || "";

    return testPgConnection({
      host: resolvedHost.host,
      port: resolvedHost.port,
      database: databaseName,
      user: roleName,
      password,
      sslMode: resolvedSsl,
    });
  }

  /**
   * Get Tailscale status for diagnostics.
   */
  getTailscaleStatus(): TailscaleStatus {
    return resolveTailscaleStatus();
  }

  /**
   * List databases for a project/branch.
   */
  listDatabases(projectId: string, branchId: string): Array<{ name: string; ownerName: string }> {
    const rows = this.db
      .select()
      .from(schema.databases)
      .where(
        and(
          eq(schema.databases.projectId, projectId),
          eq(schema.databases.branchId, branchId),
          isNull(schema.databases.deletedAt)
        )
      )
      .all();

    if (rows.length === 0) {
      // Return default database
      return [{ name: "neondb", ownerName: "cloud_admin" }];
    }

    return rows.map((r) => ({ name: r.name, ownerName: r.ownerName }));
  }

  /**
   * List roles for a project/branch.
   */
  listRoles(projectId: string, branchId: string): Array<{ name: string; isDefault: boolean }> {
    const rows = this.db
      .select()
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.projectId, projectId),
          eq(schema.roles.branchId, branchId),
          isNull(schema.roles.deletedAt)
        )
      )
      .all();

    if (rows.length === 0) {
      // Return default role
      return [{ name: process.env.POSTGRES_USER || "cloud_admin", isDefault: true }];
    }

    return rows.map((r) => ({ name: r.name, isDefault: r.isDefault }));
  }
}

// Singleton
let _service: ConnectionService | null = null;

export function getConnectionService(): ConnectionService {
  if (!_service) {
    _service = new ConnectionService();
  }
  return _service;
}
