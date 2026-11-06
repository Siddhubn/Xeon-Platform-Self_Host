#!/bin/bash
# security-audit.sh — document public exposure surface (read-only)
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== 1. funnel surface (the ONLY public entry) ==="
sudo -n tailscale funnel status 2>&1

echo
echo "=== 2. all listening TCP ports ==="
ss -lntup 2>/dev/null

echo
echo "=== 3. non-loopback listeners (what LAN/tailnet can reach directly) ==="
ss -lntup 2>/dev/null | awk 'NR==1 || ($4 !~ /127\.0\.0\.1/ && $4 !~ /\[::1\]/ && $4 !~ /::1/)'

echo
echo "=== 4. processes ==="
ps -o user,pid,cmd -C tailscaled,proxy,python3,compute_ctl 2>/dev/null
echo "=== END ==="
