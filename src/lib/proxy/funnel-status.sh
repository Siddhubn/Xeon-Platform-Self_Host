#!/bin/bash
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== any funnel/tailscale cli procs ==="
pgrep -af "tailscale funnel" || echo none

echo "=== funnel status ==="
timeout 15 bash -c "echo '$PW' | sudo -S tailscale funnel status 2>&1" | grep -v "password for"

echo "=== listeners ==="
ss -tlnp | grep -E ':(443|65432)\s' || echo "none"
