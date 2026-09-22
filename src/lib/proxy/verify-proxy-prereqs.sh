#!/bin/bash
# Verify that all prerequisites for the Neon proxy are met.

set -euo pipefail

ERRORS=0

echo "=== Verifying Neon Proxy Prerequisites ==="

# Check proxy binary
if [ -x "/opt/neon/target/release/proxy" ]; then
    echo "✓ Proxy binary found"
else
    echo "✗ Proxy binary NOT found at /opt/neon/target/release/proxy"
    ERRORS=$((ERRORS + 1))
fi

# Check TLS key
if [ -f "/opt/neon/proxy-config/tls/server.key" ]; then
    echo "✓ TLS key found"
else
    echo "✗ TLS key NOT found at /opt/neon/proxy-config/tls/server.key"
    ERRORS=$((ERRORS + 1))
fi

# Check TLS cert
if [ -f "/opt/neon/proxy-config/tls/server.crt" ]; then
    echo "✓ TLS certificate found"
else
    echo "✗ TLS certificate NOT found at /opt/neon/proxy-config/tls/server.crt"
    ERRORS=$((ERRORS + 1))
fi

# Check control-plane adapter is reachable
if curl -sf "http://127.0.0.1:5433/wake_compute?endpointish=ep-main" > /dev/null 2>&1; then
    echo "✓ Control-plane adapter is reachable"
else
    echo "✗ Control-plane adapter NOT reachable at http://127.0.0.1:5433"
    ERRORS=$((ERRORS + 1))
fi

# Check PostgreSQL is running
if pg_isready -h 127.0.0.1 -p 55432 -U cloud_admin > /dev/null 2>&1; then
    echo "✓ PostgreSQL is reachable on 127.0.0.1:55432"
else
    echo "✗ PostgreSQL NOT reachable on 127.0.0.1:55432"
    ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "$ERRORS" -gt 0 ]; then
    echo "FAILED: $ERRORS prerequisite(s) not met."
    exit 1
else
    echo "All prerequisites met."
    exit 0
fi
