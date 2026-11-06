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

  // Port for Tailscale-hosted connections. When the host is env-configured
  // (pointing at the server), NEON_TAILSCALE_PORT selects the port — the
  // server only exposes the Neon proxy (65432) over the tailnet; compute
  // ports are loopback-only.
  const tsPort = parseInt(
    process.env.NEON_TAILSCALE_PORT || String(computePort),
    10
  );

  // Handle each mode
  switch (mode) {
    case "tailscale": {
      const tsHost = resolveTailscaleHost();
      const tsStatus = resolveTailscaleStatus();

      if (tsHost) {
        return {
          host: tsHost,
          port: tsPort,
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
      // Preferred entry point: the Tailscale Funnel (outbound-initiated raw
      // TCP tunnel) — the only path that works while the server is behind
      // double NAT. The Funnel hostname is fixed, so the endpoint is selected
      // via the `options=endpoint=<id>` connection parameter instead of SNI.
      // Requires clients that support direct TLS negotiation
      // (sslmode=require&sslnegotiation=direct), because the Funnel edge
      // only forwards connections that start with a TLS ClientHello.
      const funnelHost = process.env.NEON_FUNNEL_HOST;
      if (funnelHost) {
        return {
          host: funnelHost,
          port: parseInt(process.env.NEON_FUNNEL_PORT || "443"),
          source: "public",
        };
      }

      // Fallback: direct path via public domain (needs a port-forward at the
      // institutional gateway; currently blocked by double NAT).
      //   ep-main.db.example.com -> endpoint = ep-main (via SNI)
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
          port: tsPort,
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
  requestedSsl?: SslMode,
  hostSource?: ResolvedHost["source"]
): SslMode {
  if (requestedSsl) return requestedSsl;

  // For local connections, SSL is typically not required
  if (networkMode === "local") return "disable";

  // For Tailscale and other remote connections, prefer require
  if (networkMode === "tailscale" || networkMode === "private" || networkMode === "public") {
    return "require";
  }

  // Auto: once the host resolves to a remote entry point (Tailscale server,
  // Funnel, proxy or an env-configured host), TLS is mandatory — only a
  // local/private compute host can skip it.
  if (
    hostSource === "tailscale-dns" ||
    hostSource === "tailscale-ipv4" ||
    hostSource === "public" ||
    hostSource === "env" ||
    hostSource === "custom"
  ) {
    return "require";
  }

  // Auto: local/private compute host
  return "disable";
}
