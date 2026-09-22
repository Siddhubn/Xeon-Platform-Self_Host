// ---------------------------------------------------------------------------
// Connection Host Resolver — resolves the correct host for each network mode
// ---------------------------------------------------------------------------

import type {
  ConnectionNetworkMode,
  ResolvedHost,
  SslMode,
} from "./types";
import { resolveTailscaleStatus, resolveTailscaleHost } from "./tailscale-resolver";

/**
 * Resolves the PostgreSQL connection host based on the selected network mode
 * and the compute endpoint configuration.
 *
 * Priority for "auto" mode:
 * 1. Explicitly configured custom host (env)
 * 2. Tailscale MagicDNS hostname
 * 3. Tailscale IPv4 address
 * 4. Private/network address from compute record
 * 5. localhost (fallback)
 */
export function resolveHost(
  mode: ConnectionNetworkMode,
  computeHost: string,
  computePort: number,
  customHost?: string,
  endpointId?: string
): ResolvedHost {
  // Priority 1: explicit custom host
  if (customHost) {
    return {
      host: customHost,
      port: computePort,
      source: "custom",
    };
  }

  // Priority 2: env-configured connection host
  const envHost = process.env.NEON_CONNECTION_HOST;
  if (envHost) {
    return {
      host: envHost,
      port: parseInt(process.env.NEON_POSTGRES_PORT || String(computePort)),
      source: "env",
    };
  }

  // Handle each mode
  switch (mode) {
    case "tailscale": {
      const tsHost = resolveTailscaleHost();
      const tsStatus = resolveTailscaleStatus();

      if (tsHost) {
        return {
          host: tsHost,
          port: computePort,
          source: tsStatus.magicDnsName === tsHost
            ? "tailscale-dns"
            : "tailscale-ipv4",
          tailscaleInfo: {
            ipv4: tsStatus.ipv4,
            ipv6: tsStatus.ipv6,
            dnsName: tsStatus.dnsName,
            magicDnsName: tsStatus.magicDnsName,
            status: tsStatus.connected ? "connected" : "disconnected",
          },
        };
      }

      // Tailscale not available — fall back to compute host
      return {
        host: computeHost || "localhost",
        port: computePort,
        source: "local",
      };
    }

    case "local": {
      return {
        host: "localhost",
        port: computePort,
        source: "local",
      };
    }

    case "private": {
      // Use the compute host from DB, which is the private network address
      return {
        host: computeHost || "localhost",
        port: computePort,
        source: "private",
      };
    }

    case "public": {
      // Public address — use the Neon Proxy for remote access.
      // The proxy listens on NEON_PROXY_PORT (default 5432) and routes
      // connections to the internal compute via endpoint ID.
      //
      // For SNI-based routing, the hostname encodes the endpoint ID:
      //   ep-main.db.example.com -> endpoint = ep-main
      //
      // If NEON_PUBLIC_DOMAIN is not set, public mode is unavailable.
      const publicDomain = process.env.NEON_PUBLIC_DOMAIN;
      if (!publicDomain) {
        // No public domain configured — cannot resolve public endpoint
        return {
          host: "",
          port: 0,
          source: "public",
        };
      }

      const proxyPort = parseInt(
        process.env.NEON_PROXY_PORT || "5432"
      );

      // Endpoint ID is passed through the resolveHost call as computeHost
      // when called from the connection service for public mode.
      // The public hostname is: <endpoint-id>.<domain>
      const epId = endpointId || computeHost || "ep-main";
      const publicHost = `${epId}.${publicDomain}`;

      return {
        host: publicHost,
        port: proxyPort,
        source: "public",
      };
    }

    case "auto":
    default: {
      // Auto: try Tailscale first, then compute host, then localhost
      const tsHost = resolveTailscaleHost();
      if (tsHost) {
        const tsStatus = resolveTailscaleStatus();
        return {
          host: tsHost,
          port: computePort,
          source: tsStatus.magicDnsName === tsHost
            ? "tailscale-dns"
            : "tailscale-ipv4",
          tailscaleInfo: {
            ipv4: tsStatus.ipv4,
            ipv6: tsStatus.ipv6,
            dnsName: tsStatus.dnsName,
            magicDnsName: tsStatus.magicDnsName,
            status: tsStatus.connected ? "connected" : "disconnected",
          },
        };
      }

      // No Tailscale — use compute host
      return {
        host: computeHost || "localhost",
        port: computePort,
        source: computeHost && computeHost !== "localhost" ? "private" : "local",
      };
    }
  }
}

/**
 * Determines the SSL mode based on network mode and configuration.
 */
export function resolveSslMode(
  networkMode: ConnectionNetworkMode,
  requestedSsl?: SslMode
): SslMode {
  if (requestedSsl) return requestedSsl;

  // For local connections, SSL is typically not required
  if (networkMode === "local") return "disable";

  // For Tailscale and other remote connections, prefer require
  if (networkMode === "tailscale" || networkMode === "private" || networkMode === "public") {
    return "require";
  }

  // Auto: disable for local, require for remote
  return "disable";
}
