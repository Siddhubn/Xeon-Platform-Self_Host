#!/bin/bash
# Read-only: how does neon_local see endpoints when run from /srv/neon?
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
echo "=== neon_local endpoint list (from /srv/neon) ==="
cd /srv/neon || exit 1
sudo -n neon_local endpoint list 2>&1
echo
echo "=== endpoint spec files ==="
ls -la /srv/neon/.neon/endpoints/ 2>/dev/null
echo
echo "=== who starts computes: adapter references ==="
grep -nE "compute_ctl|endpoint start|neon_local|spawn|wake" /opt/neon/proxy-config/bin/control-plane-adapter.py | head -20
echo "=== END ==="
