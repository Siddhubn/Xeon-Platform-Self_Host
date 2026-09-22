// ---------------------------------------------------------------------------
// Connection Types — shared between frontend and backend
// ---------------------------------------------------------------------------

export type ConnectionNetworkMode =
  | "auto"
  | "tailscale"
  | "local"
  | "private"
  | "public";

export type ConnectionType = "direct" | "pooled";

export type SslMode =
  | "disable"
  | "allow"
  | "prefer"
  | "require"
  | "verify-ca"
  | "verify-full";

export interface ConnectionStringInput {
  projectId: string;
  branchId: string;
  databaseName: string;
  roleName: string;
  password?: string;
  networkMode: ConnectionNetworkMode;
  connectionType: ConnectionType;
  sslMode?: SslMode;
  customHost?: string;
  poolerHost?: string;
  poolerPort?: number;
  /** Neon endpoint ID (e.g. "ep-main"). Required for public/remote mode. */
  endpointId?: string;
}

export interface ResolvedHost {
  host: string;
  port: number;
  source:
    | "tailscale-dns"
    | "tailscale-ipv4"
    | "tailscale-ipv6"
    | "custom"
    | "env"
    | "local"
    | "private"
    | "public";
  tailscaleInfo?: {
    ipv4: string;
    ipv6: string;
    dnsName: string;
    magicDnsName: string;
    status: "connected" | "disconnected" | "unavailable";
  };
}

export interface ConnectionStringOutput {
  // Metadata
  host: string;
  port: number;
  database: string;
  user: string;
  sslMode: SslMode;
  networkMode: ConnectionNetworkMode;
  connectionType: ConnectionType;

  // Resolved host details
  resolvedHost: ResolvedHost;

  // Connection availability
  poolerAvailable: boolean;
  poolerHost?: string;
  poolerPort?: number;

  // Formats
  formats: {
    postgresqlUri: string;
    postgresqlUriSsl: string;
    psqlCommand: string;
    individualParams: Record<string, string>;
    environmentVariable: string;
    libpqKeyValue: string;
    jdbcString: string;
    nodeJs: string;
    pythonPsycopg: string;
    pythonAsyncpg: string;
    pythonSqlAlchemy: string;
    goPgx: string;
    goDatabaseSql: string;
    javaJdbc: string;
    dotnetNpgsql: string;
    prismaEnv: string;
    drizzleEnv: string;
    neonServerless: string;
    /** Public/remote connection string (Neon proxy). null if not in public mode. */
    publicConnectionString: string | null;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    host: string;
    port: number;
    reachable: boolean;
    postgresVersion?: string;
    sslSupported: boolean;
    responseTimeMs: number;
  };
  error?: string;
}

export interface TailscaleStatus {
  installed: boolean;
  running: boolean;
  connected: boolean;
  ipv4: string;
  ipv6: string;
  dnsName: string;
  magicDnsName: string;
  tailscaleIp: string;
  interfaceName?: string;
}
