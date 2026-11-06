#!/bin/bash
# ensure-funnel.sh — watchdog for the Neon public access tunnel.
# Keeps Tailscale Funnel (public tcp 443 -> 127.0.0.1:65432) configured and
# verifies the Neon proxy listener. Run by neon-public-tunnel.service.
set -u
TAG="neon-public-tunnel"
TARGET_OK='--> tcp://127.0.0.1:65432'

log() { echo "$TAG: $*"; }

while true; do
  # 1) tailscaled must answer
  if ! tailscale status >/dev/null 2>&1; then
    log "WARN: tailscaled not reachable — retrying in 15s"
    sleep 15
    continue
  fi

  # 2) funnel config present and pointing at the Neon proxy?
  st=$(tailscale funnel status 2>&1 || true)
  if ! grep -qF -- "(Funnel on)" <<<"$st" || ! grep -qF -- "$TARGET_OK" <<<"$st"; then
    log "WARN: funnel config missing or not pointing to 127.0.0.1:65432 — reapplying"
    out=$(tailscale funnel --bg --yes --tcp=443 65432 2>&1) || log "ERROR: funnel reapply failed: $out"
    log "reapply result: ${out:-ok}"
  fi

  # 3) the Neon proxy listener must exist (public path target)
  if ! ss -lnt | grep -qE "[:.]65432[[:space:]]"; then
    log "ERROR: Neon proxy is NOT listening on 65432 — public path down"
  fi

  sleep 60
done
