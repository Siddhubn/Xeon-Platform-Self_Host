#!/bin/bash
# post-reboot-verify.sh — verify full stack recovery after reboot (read-only)
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
export PGPASSWORD=tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D

echo "=== uptime ==="
uptime

echo
echo "=== services (enabled / active) ==="
for u in ssh.socket tailscaled neon neon-proxy neon-cplane-adapter neon-public-tunnel neon-endpoints; do
  printf "%-24s %-10s %s\n" "$u" "$(systemctl is-enabled $u 2>&1)" "$(systemctl is-active $u 2>&1)"
done

echo
echo "=== neon-endpoints result ==="
systemctl show neon-endpoints -p Result -p ExecMainStatus -p ActiveEnterTimestamp 2>/dev/null

echo
echo "=== neon-endpoints journal (boot start log) ==="
sudo -n journalctl -u neon-endpoints --no-pager -n 40 2>/dev/null

echo
echo "=== funnel status (config persistence across reboot) ==="
sudo -n tailscale funnel status 2>&1

echo
echo "=== watchdog journal ==="
sudo -n journalctl -u neon-public-tunnel --no-pager -n 15 2>/dev/null

echo
echo "=== key listeners ==="
ss -lnt | grep -E "[:.](65432|55432|55634|55433|5433)[[:space:]]" || echo "(some missing!)"

echo
echo "=== compute processes ==="
ps -eo user,pid,cmd | grep -E "compute_ctl|release/proxy|control-plane-adapter" | grep -v grep

echo
echo "=== local psql: all 3 computes ==="
for p in 55432 55634 55433; do
  echo -n "127.0.0.1:$p -> "
  psql -h 127.0.0.1 -p $p -U cloud_admin -d postgres -tAc "SELECT 'ok ' || inet_server_port();" 2>&1 | head -1
done
echo "=== END ==="
