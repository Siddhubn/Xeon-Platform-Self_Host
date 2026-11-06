#!/bin/bash
# Read-only: inspect neon_local registry files
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
echo "=== /srv/neon/.neon listing ==="
ls -la /srv/neon/.neon/ 2>/dev/null | head -30
echo
echo "=== neon_local endpoints registry (usually .neon/endpoints.json) ==="
cat /srv/neon/.neon/endpoints.json 2>/dev/null || echo "(no endpoints.json)"
echo
echo "=== config.json samples for the 3 endpoints ==="
for ep in ep-main ep-0240dab0 ep-99ab67a9; do
  echo "--- $ep ---"
  ls /srv/neon/.neon/endpoints/$ep/ 2>/dev/null
done
echo "=== END ==="
