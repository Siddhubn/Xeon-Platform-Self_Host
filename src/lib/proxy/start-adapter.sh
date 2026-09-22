#!/bin/bash
# Neon Control Plane Adapter Startup Script
# Starts the HTTP adapter that the proxy uses for endpoint routing and auth.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/../proxy.env" 2>/dev/null || source "/opt/neon/proxy-config/proxy.env"

NEON_PROXY_LOG_DIR="${NEON_PROXY_LOG_DIR:-/opt/neon/proxy-config/logs}"
ADAPTER_SCRIPT="/opt/neon/proxy-config/bin/control-plane-adapter.py"

mkdir -p "$NEON_PROXY_LOG_DIR"

echo "=== Control Plane Adapter Configuration ==="
echo "  Script:  $ADAPTER_SCRIPT"
echo "  Listen:  ${NEON_CPLANE_LISTEN_HOST:-127.0.0.1}:${NEON_CPLANE_LISTEN_PORT:-5433}"
echo "  PG:      ${NEON_CPLANE_PG_HOST:-127.0.0.1}:${NEON_CPLANE_PG_PORT:-55432}"
echo "  Compute: ${NEON_CPLANE_DEFAULT_COMPUTE_HOST:-127.0.0.1}:${NEON_CPLANE_DEFAULT_COMPUTE_PORT:-55432}"
echo "=========================================="

exec python3 "$ADAPTER_SCRIPT" 2>&1 | tee "$NEON_PROXY_LOG_DIR/adapter.log"
