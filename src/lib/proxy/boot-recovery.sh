#!/bin/bash
# boot-recovery.sh — diagnose compute startup + start remaining endpoints now
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
export PATH=/usr/local/bin:/usr/bin:/bin

echo "=== neon-endpoints unit status (timeout remaining?) ==="
systemctl status neon-endpoints --no-pager 2>&1 | head -15

echo
echo "=== listeners ==="
ss -lnt | grep -E "[:.](55432|55634|55433)[[:space:]]" || echo "(no compute ports yet)"

echo
echo "=== ep-main compute.log tail (why stuck in Init?) ==="
tail -25 /srv/neon/.neon/endpoints/ep-main/compute.log 2>/dev/null

echo
echo "=== manual parallel start: ep-0240dab0 + ep-99ab67a9 ==="
cd /srv/neon || exit 1
setsid nohup neon_local endpoint start ep-0240dab0 >/tmp/start-0240.log 2>&1 &
setsid nohup neon_local endpoint start ep-99ab67a9 >/tmp/start-99ab.log 2>&1 &
echo "launched both (detached). Logs: /tmp/start-0240.log /tmp/start-99ab.log"

echo
echo "=== storage controller tenant list (via neon_local's working path) ==="
sudo -n neon_local tenant list 2>&1

echo
echo "=== raise TimeoutStartSec for future boots ==="
sed -i 's/^TimeoutStartSec=.*/TimeoutStartSec=900/' /etc/systemd/system/neon-endpoints.service
sudo -n systemctl daemon-reload
grep TimeoutStartSec /etc/systemd/system/neon-endpoints.service
echo "=== END ==="
