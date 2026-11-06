#!/bin/bash
# install-public-access.sh — deploy the public-tunnel watchdog and the
# boot-time compute endpoint auto-start service. Idempotent.
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

SRC=/tmp/neon-public-access
BIN=/opt/neon/proxy-config/bin
UNIT=/etc/systemd/system

echo "=== 1. install scripts ==="
sudo -n install -m 755 -o root -g root "$SRC/ensure-funnel.sh"   "$BIN/ensure-funnel.sh"
sudo -n install -m 755 -o root -g root "$SRC/start-endpoints.sh" "$BIN/start-endpoints.sh"
echo "installed: $BIN/ensure-funnel.sh $BIN/start-endpoints.sh"

echo "=== 2. install systemd units ==="
sudo -n install -m 644 -o root -g root "$SRC/neon-public-tunnel.service" "$UNIT/neon-public-tunnel.service"
sudo -n install -m 644 -o root -g root "$SRC/neon-endpoints.service"     "$UNIT/neon-endpoints.service"
sudo -n systemctl daemon-reload
echo "units installed"

echo "=== 3. enable + start neon-public-tunnel (watchdog) ==="
sudo -n systemctl enable neon-public-tunnel.service 2>&1
sudo -n systemctl restart neon-public-tunnel.service 2>&1
sleep 3
systemctl is-active neon-public-tunnel.service

echo "=== 4. enable + run neon-endpoints (idempotent; all up -> quick exit 0) ==="
sudo -n systemctl enable neon-endpoints.service 2>&1
sudo -n systemctl start neon-endpoints.service 2>&1
sleep 2
systemctl is-active neon-endpoints.service || true
systemctl show neon-endpoints.service -p Result -p ExecMainStatus 2>/dev/null

echo "=== 5. watchdog journal (first entries) ==="
sudo -n journalctl -u neon-public-tunnel --no-pager -n 10 2>/dev/null || true

echo "=== 6. enabled-at-boot check ==="
for u in neon-public-tunnel neon-endpoints neon-proxy neon-cplane-adapter neon tailscaled; do
  printf "%-24s %-10s %s\n" "$u" "$(systemctl is-enabled $u 2>&1)" "$(systemctl is-active $u 2>&1)"
done
echo "=== END ==="
