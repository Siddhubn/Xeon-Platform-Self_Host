#!/bin/bash
# Inspect Tailscale Funnel capability (read-only)
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== tailscale version ==="
tailscale version 2>&1 | head -2

echo "=== tailscale status (self) ==="
tailscale status --self 2>&1 | head -5

echo "=== funnel help ==="
echo "$PW" | sudo -S tailscale funnel --help 2>&1 | grep -v "password for" | sed -n '1,60p'

echo "=== funnel status ==="
echo "$PW" | sudo -S tailscale funnel status 2>&1 | grep -v "password for" | head -20
