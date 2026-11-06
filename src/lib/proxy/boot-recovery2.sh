#!/bin/bash
# boot-recovery2.sh — diagnose + fix timeout + start ep-main manually
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
export PATH=/usr/local/bin:/usr/bin:/bin
cd /srv/neon || exit 1

echo "=== tenant attach status ==="
sudo -n neon_local tenant list 2>&1

echo
echo "=== ep-main compute.log: errors / basebackup / attach ==="
grep -iE "error|basebackup|attach|panic|failed|timed" /srv/neon/.neon/endpoints/ep-main/compute.log 2>/dev/null | tail -15

echo
echo "=== start ep-main (detached, IO fully redirected) ==="
setsid nohup neon_local endpoint start ep-main </dev/null >/tmp/start-main.log 2>&1 &
echo "launched; log: /tmp/start-main.log"

echo
echo "=== fix TimeoutStartSec=900 (persist for future boots) ==="
sudo -n sed -i 's/^TimeoutStartSec=.*/TimeoutStartSec=900/' /etc/systemd/system/neon-endpoints.service
sudo -n systemctl daemon-reload
grep TimeoutStartSec /etc/systemd/system/neon-endpoints.service

echo
echo "=== current starting processes ==="
ps -eo pid,user,etime,cmd | grep -E "neon_local endpoint start|compute_ctl" | grep -v grep || echo "(none yet)"
echo "=== END ==="
