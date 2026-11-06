#!/bin/bash
# funnel-recovery-test.sh — prove neon-public-tunnel watchdog self-heals:
# 1) wipe funnel config  2) confirm gone  3) wait <=70s  4) confirm re-applied
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== A. funnel config BEFORE reset ==="
sudo -n tailscale funnel status 2>&1

echo
echo "=== B. wipe funnel config (simulate config loss) ==="
sudo -n tailscale funnel reset 2>&1
sudo -n tailscale funnel status 2>&1 | head -5

echo
echo "=== C. wait 70s for watchdog cycle ==="
sleep 70
sudo -n journalctl -u neon-public-tunnel --since "1 min ago" --no-pager | tail -8

echo
echo "=== D. funnel config AFTER watchdog (must be back: tcp 443 -> 127.0.0.1:65432) ==="
sudo -n tailscale funnel status 2>&1
echo "=== END ==="
