#!/bin/bash
# recover-safekeeper.sh — restore safekeeper state ownership to skxll_thief
# (the user the Neon stack actually runs as), then verify compute start works.
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
export PATH=/usr/local/bin:/usr/bin:/bin
SK=/srv/neon/.neon/safekeepers/sk1

echo "=== BEFORE: writability as skxll_thief (current user) ==="
for f in \
  $SK/0908a23e5151e6d9c6cf43fbbb819aa5/5ead2b92252b3fab15b7e93bda5a5d50/safekeeper.control \
  $SK/0240dab0263ed68fee9030b816a97da4/475f3158d444a0fab44ee8a7b3d99c5f/safekeeper.control \
  $SK/99ab67a94ff8e72b51e809e426312384/a000393206bd41c546d5f53b78e7ade5/safekeeper.control; do
  if [ -w "$f" ]; then echo "WRITABLE: $f"; else echo "NOT-WRITABLE: $f"; fi
done

echo
echo "=== chown safekeeper state of the 3 active tenants -> skxll_thief:neon-admin ==="
sudo -n chown -R skxll_thief:neon-admin \
  $SK/0908a23e5151e6d9c6cf43fbbb819aa5 \
  $SK/0240dab0263ed68fee9030b816a97da4 \
  $SK/99ab67a94ff8e72b51e809e426312384
echo "chown rc=$?"

echo
echo "=== AFTER: ownership + writability ==="
ls -la $SK/99ab67a94ff8e72b51e809e426312384/a000393206bd41c546d5f53b78e7ade5/
for f in \
  $SK/0908a23e5151e6d9c6cf43fbbb819aa5/5ead2b92252b3fab15b7e93bda5a5d50/safekeeper.control \
  $SK/0240dab0263ed68fee9030b816a97da4/475f3158d444a0fab44ee8a7b3d99c5f/safekeeper.control \
  $SK/99ab67a94ff8e72b51e809e426312384/a000393206bd41c546d5f53b78e7ade5/safekeeper.control; do
  if [ -w "$f" ]; then echo "WRITABLE: $f"; else echo "NOT-WRITABLE: $f"; fi
done

echo
echo "=== start ep-main (up to 150s) ==="
cd /srv/neon || exit 1
timeout 150 neon_local endpoint start ep-main 2>&1 | tail -5
echo "start rc=$?"

echo
echo "=== verdicts ==="
echo -n "port 55432: "; ss -lnt | grep -qE "[:.]55432[[:space:]]" && echo UP || echo DOWN
echo -n "latest 'timeline not found' count: "; grep -c "timeline not found" $SK/safekeeper-1.log
echo "compute.log (last 5 non-status):"
grep -vE "GET /status|BatchSpanProcessor" /srv/neon/.neon/endpoints/ep-main/compute.log | tail -5
echo "=== END ==="
