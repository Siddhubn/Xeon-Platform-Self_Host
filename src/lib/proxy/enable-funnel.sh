#!/bin/bash
# Enable Tailscale Funnel raw-TCP -> Neon proxy (127.0.0.1:65432)
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== proxy still listening on 65432? ==="
ss -tlnp 2>/dev/null | grep -w 65432 || echo "NOT LISTENING"

echo "=== enable funnel: public tcp -> local 65432 (try 443) ==="
echo "$PW" | sudo -S tailscale funnel --bg --yes --tcp=443 65432 2>&1 | grep -v "password for"

sleep 3
echo "=== funnel status ==="
echo "$PW" | sudo -S tailscale funnel status 2>&1 | grep -v "password for"

echo "=== public DNS check ==="
TN=$(tailscale status --json 2>/dev/null | grep -o '"DNSName":"[^"]*"' | head -1 | sed 's/"DNSName":"//;s/"//')
echo "self DNSName: $TN"
