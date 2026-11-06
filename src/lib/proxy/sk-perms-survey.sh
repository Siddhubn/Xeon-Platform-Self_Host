#!/bin/bash
# sk-perms-survey.sh — who owns the safekeeper state for our 3 tenants?
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
SK=/srv/neon/.neon/safekeepers/sk1

echo "=== per-timeline rejection reasons (SK log) ==="
grep -E "timeline not found|terminated" /srv/neon/.neon/safekeepers/sk1/safekeeper-1.log 2>/dev/null | grep -oE "ttid=[0-9a-f/]+|timeline not found" | sort | uniq -c | tail -10

echo
echo "=== ownership: files NOT owned by skxll_thief in our 3 tenants ==="
for t in 0908a23e5151e6d9c6cf43fbbb819aa5 0240dab0263ed68fee9030b816a97da4 99ab67a94ff8e72b51e809e426312384; do
  echo "--- tenant $t"
  ls -ld $SK/$t 2>/dev/null
  find $SK/$t ! -user skxll_thief 2>/dev/null | head -8
  n=$(find $SK/$t ! -user skxll_thief 2>/dev/null | wc -l)
  echo "  non-skxll_thief files: $n"
done

echo
echo "=== timeline dirs per tenant ==="
for t in 0908a23e5151e6d9c6cf43fbbb819aa5 0240dab0263ed68fee9030b816a97da4 99ab67a94ff8e72b51e809e426312384; do
  echo "--- $t:"
  ls -la $SK/$t/ 2>/dev/null | head -6
done

echo
echo "=== readability test AS skxll_thief (current user) ==="
for f in $(find $SK/0908a23e5151e6d9c6cf43fbbb819aa5 $SK/0240dab0263ed68fee9030b816a97da4 $SK/99ab67a94ff8e72b51e809e426312384 -name "*.json" -o -name "*.state" -o -name "*.seg" 2>/dev/null | head -6); do
  if cat "$f" >/dev/null 2>&1; then echo "READABLE: $f"; else echo "UNREADABLE: $f"; fi
done
echo "=== END ==="
