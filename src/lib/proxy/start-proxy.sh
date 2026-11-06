#!/bin/bash
# Neon Proxy Startup Script
# Starts the Neon proxy with control-plane authentication backend.
#
# This script is meant to be called by the systemd service.
# Do not run directly unless testing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/../proxy.env" 2>/dev/null || source "/opt/neon/proxy-config/proxy.env"

# Defaults
NEON_PROXY_BINARY="${NEON_PROXY_BINARY:-/opt/neon/target/release/proxy}"
NEON_PROXY_PORT="${NEON_PROXY_PORT:-65432}"
NEON_PROXY_BIND="${NEON_PROXY_BIND:-0.0.0.0}"
NEON_CPLANE_HOST="${NEON_CPLANE_HOST:-127.0.0.1}"
NEON_CPLANE_PORT="${NEON_CPLANE_PORT:-5433}"
NEON_TLS_KEY="${NEON_TLS_KEY:-/opt/neon/proxy-config/tls/server.key}"
NEON_TLS_CERT="${NEON_TLS_CERT:-/opt/neon/proxy-config/tls/server.crt}"
NEON_PROXY_LOG_DIR="${NEON_PROXY_LOG_DIR:-/opt/neon/proxy-config/logs}"
NEON_PROXY_CONFIG_DIR="${NEON_PROXY_CONFIG_DIR:-/opt/neon/proxy-config}"

mkdir -p "$NEON_PROXY_LOG_DIR"

echo "=== Neon Proxy Configuration ==="
echo "  Binary:     $NEON_PROXY_BINARY"
echo "  Proxy:      $NEON_PROXY_BIND:$NEON_PROXY_PORT"
echo "  Control:    http://$NEON_CPLANE_HOST:$NEON_CPLANE_PORT/"
echo "  TLS Key:    $NEON_TLS_KEY"
echo "  TLS Cert:   $NEON_TLS_CERT"
echo "  HTTP:       127.0.0.1:7001"
echo "  Mgmt:       127.0.0.1:7000"
echo "==============================="

# Verify prerequisites
if [ ! -f "$NEON_PROXY_BINARY" ]; then
    echo "ERROR: Proxy binary not found at $NEON_PROXY_BINARY"
    exit 1
fi

if [ ! -f "$NEON_TLS_KEY" ]; then
    echo "ERROR: TLS key not found at $NEON_TLS_KEY"
    echo "Run: /opt/neon/proxy-config/bin/generate-tls-certs.sh <domain>"
    exit 1
fi

if [ ! -f "$NEON_TLS_CERT" ]; then
    echo "ERROR: TLS certificate not found at $NEON_TLS_CERT"
    echo "Run: /opt/neon/proxy-config/bin/generate-tls-certs.sh <domain>"
    exit 1
fi

exec "$NEON_PROXY_BINARY" \
    --proxy "$NEON_PROXY_BIND:$NEON_PROXY_PORT" \
    --auth-backend control-plane \
    --auth-endpoint "http://$NEON_CPLANE_HOST:$NEON_CPLANE_PORT/" \
    --control-plane-token "" \
    --http "127.0.0.1:7001" \
    --mgmt "127.0.0.1:7000" \
    --tls-key "$NEON_TLS_KEY" \
    --tls-cert "$NEON_TLS_CERT" \
    --handshake-timeout "15s" \
    --scram-protocol-timeout "15s" \
    --scram-thread-pool-size 4 \
    --sql-over-http-pool-max-conns-per-endpoint 20 \
    --sql-over-http-pool-max-total-conns 200 \
    --sql-over-http-idle-timeout "5m" \
    --sql-over-http-pool-gc-epoch "10m" \
    --sql-over-http-pool-shards 16 \
    --connect-to-compute-retry "num_retries=3,base_retry_wait_duration=200ms,retry_wait_exponent_base=2" \
    --wake-compute-retry "num_retries=2,base_retry_wait_duration=500ms,retry_wait_exponent_base=2" \
    2>&1 | tee "$NEON_PROXY_LOG_DIR/proxy.log"
