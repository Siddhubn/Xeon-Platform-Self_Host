#!/bin/bash
# Read-only: dump neon_local config + endpoint.json files
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
echo "=== /srv/neon/.neon/config ==="
cat /srv/neon/.neon/config 2>/dev/null
echo
echo "=== endpoint.json for each endpoint ==="
for ep in ep-main ep-0240dab0 ep-99ab67a9; do
  echo "--- $ep ---"
  cat /srv/neon/.neon/endpoints/$ep/endpoint.json 2>/dev/null
  echo
done
echo "=== END ==="
