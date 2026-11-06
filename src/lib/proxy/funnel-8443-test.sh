#!/bin/bash
# Test: add funnel tcp on 8443 and check if raw (non-TLS-first) postgres SSLRequest passes through
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== add funnel tcp 8443 -> 65432 ==="
sudo -n timeout 30 tailscale funnel --bg --yes --tcp=8443 65432 2>&1
echo "rc=$?"
echo
echo "=== funnel status ==="
sudo -n tailscale funnel status 2>&1
echo "(connectivity probes are run from the external client, not this server)"
echo "=== END ==="
