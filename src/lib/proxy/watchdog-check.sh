#!/bin/bash
# Redeploy fixed ensure-funnel.sh and verify 2 clean watchdog cycles.
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== redeploy + restart watchdog ==="
sudo -n install -m 755 -o root -g root /tmp/neon-public-access/ensure-funnel.sh /opt/neon/proxy-config/bin/ensure-funnel.sh
sudo -n systemctl restart neon-public-tunnel.service
sleep 2
echo "state: $(systemctl is-active neon-public-tunnel.service)"

echo "=== waiting 70s for two cycles ==="
sleep 70
echo "=== watchdog journal (last 20 lines) ==="
sudo -n journalctl -u neon-public-tunnel --no-pager -n 20
echo "=== END ==="
