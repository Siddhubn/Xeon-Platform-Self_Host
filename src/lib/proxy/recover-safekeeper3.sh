#!/bin/bash
# recover-safekeeper3.sh — the durable fix:
# 1) prove the control files got re-rooted by the manual ROOT safekeeper run
# 2) chown state back to skxll_thief:neon-admin (neon.service's User=/Group=)
# 3) restart safekeeper AS skxll_thief (NO sudo — matches boot semantics)
# 4) start all 3 computes, verify everything + ownership stays correct
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null          # only used for chown
export PATH=/usr/local/bin:/usr/bin:/bin
export PGPASSWORD=tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D
SK=/srv/neon/.neon/safekeepers/sk1
cd /srv/neon || exit 1

echo "=== EVIDENCE: control file ownership NOW (after the root manual run) ==="
ls -la $SK/0908a23e5151e6d9c6cf43fbbb819aa5/5ead2b92252b3fab15b7e93bda5a5d50/safekeeper.control
n=$(sudo -n find $SK ! -user skxll_thief 2>/dev/null | wc -l)
echo "non-skxll_thief paths now: $n"

echo
echo "=== chown whole sk1 -> skxll_thief:neon-admin ==="
sudo -n chown -R skxll_thief:neon-admin $SK
echo "rc=$?; non-owner paths after: $(sudo -n find $SK ! -user skxll_thief 2>/dev/null | wc -l)"

echo
echo "=== restart safekeeper AS skxll_thief (no sudo) ==="
neon_local safekeeper restart 2>&1 | tail -4
sleep 5
skpid=$(cat $SK/safekeeper.pid 2>/dev/null)
echo "safekeeper pid=$skpid user=$(ps -o user= -p "$skpid" 2>/dev/null)"

echo
echo "=== start all 3 computes ==="
timeout 420 /opt/neon/proxy-config/bin/start-endpoints.sh 2>&1 | grep -E "OK:|ERROR|attempt|failed" | tail -12

echo
echo "=== VERDICTS ==="
for p in 55432 55634 55433; do
  echo -n "127.0.0.1:$p -> "
  psql -h 127.0.0.1 -p $p -U cloud_admin -d postgres -tAc "SELECT 'ok ' || inet_server_port();" 2>&1 | head -1
done
echo -n "control file ownership after WAL activity: "
ls -la $SK/0908a23e5151e6d9c6cf43fbbb819aa5/5ead2b92252b3fab15b7e93bda5a5d50/safekeeper.control | awk '{print $3, $4}'
echo -n "SK rejections in last 30s: "
grep "timeline not found" $SK/safekeeper-1.log | tail -1 | cut -c1-24
echo "=== END ==="
