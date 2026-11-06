#!/bin/bash
# Clean funnel config: full reset, then re-add ONLY tcp 443 -> 127.0.0.1:65432
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
echo "=== reset ==="
sudo -n tailscale funnel reset 2>&1
echo "=== re-add tcp 443 ==="
sudo -n timeout 30 tailscale funnel --bg --yes --tcp=443 65432 2>&1
echo "rc=$?"
echo "=== status (must show ONLY tcp 443 -> 127.0.0.1:65432, no warnings) ==="
sudo -n tailscale funnel status 2>&1
echo "=== END ==="
