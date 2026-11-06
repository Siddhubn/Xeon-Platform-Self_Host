#!/bin/bash
# recover-safekeeper2.sh — full sk1 ownership fix, control sanity check,
# safekeeper restart, then ep-main start verification.
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
export PATH=/usr/local/bin:/usr/bin:/bin
SK=/srv/neon/.neon/safekeepers/sk1
cd /srv/neon || exit 1

echo "=== control file contents (timeline_id sanity) ==="
for f in \
  $SK/0908a23e5151e6d9c6cf43fbbb819aa5/5ead2b92252b3fab15b7e93bda5a5d50/safekeeper.control \
  $SK/0240dab0263ed68fee9030b816a97da4/475f3158d444a0fab44ee8a7b3d99c5f/safekeeper.control \
  $SK/99ab67a94ff8e72b51e809e426312384/a000393206bd41c546d5f53b78e7ade5/safekeeper.control; do
  echo "--- $f"
  cat "$f" 2>/dev/null; echo
done

echo "=== any remaining root-owned paths under sk1 (full tree) ==="
sudo -n find $SK ! -user skxll_thief 2>/dev/null | head -15
n=$(sudo -n find $SK ! -user skxll_thief 2>/dev/null | wc -l)
echo "total non-skxll_thief paths: $n"

echo
echo "=== chown ENTIRE sk1 tree -> skxll_thief:neon-admin ==="
sudo -n chown -R skxll_thief:neon-admin $SK
echo "chown rc=$?"
echo "remaining non-owner paths: $(sudo -n find $SK ! -user skxll_thief 2>/dev/null | wc -l)"

echo
echo "=== safekeeper CLI subcommands ==="
neon_local safekeeper -h 2>&1 | head -15

echo
echo "=== restart safekeeper ==="
sudo -n neon_local safekeeper stop 2>&1 | tail -2
sleep 2
sudo -n neon_local safekeeper start 2>&1 | tail -3
sleep 5
echo -n "port 5454: "; ss -lnt | grep -qE "[:.]5454[[:space:]]" && echo UP || echo DOWN

echo
echo "=== mark baseline: current 'timeline not found' count ==="
before=$(grep -c "timeline not found" $SK/safekeeper-1.log)
echo "before=$before"

echo
echo "=== start ep-main (up to 150s) ==="
timeout 150 neon_local endpoint start ep-main 2>&1 | tail -4

echo
echo "=== VERDICTS ==="
echo -n "port 55432: "; ss -lnt | grep -qE "[:.]55432[[:space:]]" && echo UP || echo DOWN
after=$(grep -c "timeline not found" $SK/safekeeper-1.log)
echo "timeline-not-found: before=$before after=$after (delta=$((after-before)))"
echo "SK log: non-rejection lines since restart:"
awk -v RS='\n' 'NR>0' $SK/safekeeper-1.log | grep -vE "timeline not found|got query|Disconnected|Broken pipe" | tail -8
echo "compute.log (last 6 non-status):"
grep -vE "GET /status|BatchSpanProcessor" /srv/neon/.neon/endpoints/ep-main/compute.log | tail -6
echo "=== END ==="
