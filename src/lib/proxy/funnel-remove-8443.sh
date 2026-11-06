#!/bin/bash
# Remove the experimental 8443 funnel entry (keep ONLY the intended public TCP 443)
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
echo "=== remove 8443 ==="
sudo -n tailscale funnel --tcp=8443 off 2>&1
echo
echo "=== funnel status (must show only 443 -> 127.0.0.1:65432) ==="
sudo -n tailscale funnel status 2>&1
echo "=== END ==="
