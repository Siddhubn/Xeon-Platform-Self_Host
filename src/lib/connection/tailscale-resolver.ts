// ---------------------------------------------------------------------------
// Tailscale Resolver — detects Tailscale networking on the server
// ---------------------------------------------------------------------------

import { execSync } from "child_process";
import type { TailscaleStatus } from "./types";

/**
 * Attempts to detect the server's Tailscale networking information by
 * running approved server-side commands.
 *
 * This resolver:
 * 1. Checks if Tailscale CLI is installed
 * 2. Queries `tailscale status` for IP and DNS info
 * 3. Reads env overrides (NEON_TAILSCALE_HOST, etc.)
 * 4. Returns structured TailscaleStatus
 */
export function resolveTailscaleStatus(): TailscaleStatus {
  const defaults: TailscaleStatus = {
    installed: false,
    running: false,
    connected: false,
    ipv4: "",
    ipv6: "",
    dnsName: "",
    magicDnsName: "",
    tailscaleIp: "",
  };

  // Priority 1: env overrides
  const envHost = process.env.NEON_TAILSCALE_HOST || "";
  const envIp = process.env.NEON_TAILSCALE_IP || "";
  const envDns = process.env.NEON_TAILSCALE_DNS_NAME || "";

  if (envIp || envDns || envHost) {
    return {
      ...defaults,
      installed: true,
      running: true,
      connected: true,
      ipv4: envIp,
      ipv6: "",
      dnsName: envDns,
      // Prefer the DNS name for display when configured — NEON_TAILSCALE_HOST
      // may be a bare IP.
      magicDnsName: envDns || envHost,
      tailscaleIp: envIp,
    };
  }

  // Priority 2: Detect via CLI
  try {
    // Check if tailscale CLI is available
    execSync("which tailscale", { stdio: "ignore", timeout: 3000 });
    defaults.installed = true;
  } catch {
    return defaults;
  }

  try {
    // Get tailscale status as JSON
    const output = execSync("tailscale status --json 2>/dev/null", {
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 5000,
      encoding: "utf-8",
    });

    const status = JSON.parse(output);

    if (status.Self) {
      defaults.running = true;
      // Connected if we have Tailscale IPs, even with health warnings
      defaults.connected = !!(status.Self?.TailscaleIPs?.length);
      defaults.ipv4 = status.Self.TailscaleIPs?.[0] || "";
      defaults.ipv6 = status.Self.TailscaleIPs?.[1] || "";
      defaults.dnsName = status.Self.DNSName || "";
      // MagicDNS name is the full DNS name from tailscale (e.g., machine.tailnet.ts.net)
      defaults.magicDnsName = status.Self.DNSName || "";
      defaults.tailscaleIp = defaults.ipv4;
      defaults.interfaceName = "tailscale0";
    }
  } catch {
    // tailscale status failed — try simpler command
    try {
      const ipOutput = execSync(
        "tailscale ip -4 2>/dev/null || tailscale-addr -4 2>/dev/null",
        {
          stdio: ["pipe", "pipe", "ignore"],
          timeout: 3000,
          encoding: "utf-8",
        }
      ).trim();

      if (ipOutput) {
        defaults.installed = true;
        defaults.running = true;
        defaults.connected = true;
        defaults.ipv4 = ipOutput;
        defaults.tailscaleIp = ipOutput;
      }
    } catch {
      // Could not get Tailscale IP
    }
  }

  return defaults;
}

/**
 * Resolves the best Tailscale host for connections.
 * Priority: MagicDNS > IPv4 > IPv6
 */
export function resolveTailscaleHost(): string | null {
  const envHost =
    process.env.NEON_TAILSCALE_HOST || process.env.NEON_TAILSCALE_DNS_NAME;
  if (envHost) return envHost;

  const status = resolveTailscaleStatus();
  if (!status.connected) return null;

  // Prefer MagicDNS hostname if available
  if (status.magicDnsName) return status.magicDnsName;
  // Fall back to IPv4
  if (status.ipv4) return status.ipv4;
  // Fall back to IPv6
  if (status.ipv6) return status.ipv6;

  return null;
}
