#!/bin/bash
# Redeploy all public-access scripts to persistent storage (/opt/neon/proxy-config/bin)
# and run post-reboot verification. The /tmp staging dir is wiped at boot.
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null

echo "=== redeploy scripts to persistent /opt/neon/proxy-config/bin ==="
sudo -n install -m 755 -o root -g root /tmp/neon-public-access/start-endpoints.sh /opt/neon/proxy-config/bin/start-endpoints.sh
sudo -n install -m 755 -o root -g root /tmp/neon-public-access/ensure-funnel.sh   /opt/neon/proxy-config/bin/ensure-funnel.sh
sudo -n install -m 755 -o root -g root /tmp/neon-public-access/post-reboot-verify.sh /opt/neon/proxy-config/bin/post-reboot-verify.sh
ls -la /opt/neon/proxy-config/bin/

echo
echo "=== POST-REBOOT VERIFICATION ==="
bash /opt/neon/proxy-config/bin/post-reboot-verify.sh
echo "=== END ==="
