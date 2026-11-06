#!/bin/bash
# Inspect compute endpoint management (read-only) for reboot auto-start design
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== neon_local endpoint list ==="
sudo -n neon_local endpoint list 2>&1

echo
echo "=== compute_ctl / postgres processes (with parents) ==="
ps -eo pid,ppid,user,cmd | grep -E "compute_ctl|postgres -D|control-plane-adapter|release/proxy" | grep -v grep

echo
echo "=== endpoint registry on server ==="
cat /opt/neon/proxy-config/endpoints.json 2>/dev/null || echo "(not found)"

echo
echo "=== neon-related systemd units ==="
systemctl list-units --all --type=service 2>/dev/null | grep -iE "neon|compute|endpoint|funnel|tunnel" || true

echo
echo "=== enabled units (boot order) ==="
systemctl list-unit-files --type=service 2>/dev/null | grep -E "neon|tailscale" || true

echo "=== END ==="
