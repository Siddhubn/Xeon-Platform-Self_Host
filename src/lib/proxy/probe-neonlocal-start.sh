#!/bin/bash
# Probe: does `neon_local endpoint start` know ep-0240dab0 / ep-99ab67a9?
# Both are ALREADY RUNNING, so a correct CLI reports 'already running' (no-op).
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
cd /srv/neon || exit 1

echo "=== endpoint list (again, full) ==="
sudo -n neon_local endpoint list 2>&1

echo
echo "=== start ep-0240dab0 (already running -> expect no-op or 'running') ==="
sudo -n timeout 30 neon_local endpoint start ep-0240dab0 2>&1
echo "rc=$?"

echo
echo "=== start ep-99ab67a9 ==="
sudo -n timeout 30 neon_local endpoint start ep-99ab67a9 2>&1
echo "rc=$?"

echo
echo "=== start ep-main (already running) ==="
sudo -n timeout 30 neon_local endpoint start ep-main 2>&1
echo "rc=$?"

echo
echo "=== final list ==="
sudo -n neon_local endpoint list 2>&1
echo "=== END ==="
