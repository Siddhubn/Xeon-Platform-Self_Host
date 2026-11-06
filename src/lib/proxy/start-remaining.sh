#!/bin/bash
# start-remaining.sh — verify ep-main, start ep-0240dab0 + ep-99ab67a9,
# apply TimeoutStartSec fix, check neon-extension error history.
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
export PATH=/usr/local/bin:/usr/bin:/bin
export PGPASSWORD=tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D
cd /srv/neon || exit 1

echo "=== ep-main verification ==="
echo -n "psql 55432: "
psql -h 127.0.0.1 -p 55432 -U cloud_admin -d postgres -tAc "SELECT 'ok ' || inet_server_port();" 2>&1 | head -1
sudo -n neon_local endpoint list 2>&1

echo
echo "=== is 'extension neon does not exist' pre-existing? (history in compute.log) ==="
grep -c 'extension "neon" does not exist' /srv/neon/.neon/endpoints/ep-main/compute.log
echo "--- dated occurrences (first + last):"
grep 'extension "neon" does not exist' /srv/neon/.neon/endpoints/ep-main/compute.log | head -1 | cut -c1-30
grep 'extension "neon" does not exist' /srv/neon/.neon/endpoints/ep-main/compute.log | tail -1 | cut -c1-30

echo
echo "=== start remaining endpoints (persistent idempotent script) ==="
timeout 400 /opt/neon/proxy-config/bin/start-endpoints.sh 2>&1 | grep -vE "GET /status" | tail -20

echo
echo "=== VERDICTS ==="
for p in 55432 55634 55433; do
  echo -n "127.0.0.1:$p -> "
  psql -h 127.0.0.1 -p $p -U cloud_admin -d postgres -tAc "SELECT 'ok ' || inet_server_port();" 2>&1 | head -1
done

echo
echo "=== apply TimeoutStartSec=900 ==="
sudo -n sed -i 's/^TimeoutStartSec=.*/TimeoutStartSec=900/' /etc/systemd/system/neon-endpoints.service
sudo -n systemctl daemon-reload
grep TimeoutStartSec /etc/systemd/system/neon-endpoints.service

echo "=== safekeeper rejections since baseline (must be 0 for our timelines) ==="
grep "timeline not found" /srv/neon/.neon/safekeepers/sk1/safekeeper-1.log | tail -3
echo "=== END ==="
