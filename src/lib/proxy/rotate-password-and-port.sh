#!/bin/bash
# Rotate cloud_admin DB password on every compute + move Neon Proxy 5432 -> 65432.
# Sudo/SSH password (helloworld) is intentionally UNCHANGED — only the DB password rotates.
# ALREADY APPLIED 2026-09-23 — kept for audit/re-run (idempotent).
NEWPW='tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D'
OLDPW='helloworld'
SPW='helloworld'   # sudo password for skxll_thief (unchanged)
PORT=65432
CONF=/opt/neon/proxy-config

set -e

echo "== 0. target port $PORT must be free =="
if ss -ltn | grep -q ":$PORT "; then echo "ERROR: port $PORT already in use"; exit 1; fi
echo "   free"

echo "== 1. rotate cloud_admin password on all computes =="
for P in 55432 55634 55433; do
  if PGPASSWORD=$OLDPW psql -h 127.0.0.1 -p $P -U cloud_admin -d postgres -tAc \
      "ALTER USER cloud_admin PASSWORD '$NEWPW';" 2>/dev/null; then
    echo "   rotated on :$P"
  else
    echo "   FAILED on :$P"; exit 1
  fi
done

echo "== 2. update proxy.env (port + adapter password) =="
sed -i "s|^NEON_PROXY_PORT=.*|NEON_PROXY_PORT=$PORT|" $CONF/proxy.env
sed -i "s|^NEON_CPLANE_PG_PASSWORD=.*|NEON_CPLANE_PG_PASSWORD=\"$NEWPW\"|" $CONF/proxy.env
grep -E "^NEON_PROXY_PORT=|^NEON_CPLANE_PG_PASSWORD=" $CONF/proxy.env | sed "s/PG_PASSWORD=.*/PG_PASSWORD=<redacted>/"

echo "== 3. update systemd unit bind port =="
echo "$SPW" | sudo -S sed -i "s|--proxy 0.0.0.0:5432|--proxy 0.0.0.0:$PORT|" /etc/systemd/system/neon-proxy.service
grep -o "0.0.0.0:[0-9]*" /etc/systemd/system/neon-proxy.service

echo "== 4. restart adapter + proxy =="
echo "$SPW" | sudo -S systemctl daemon-reload
echo "$SPW" | sudo -S systemctl restart neon-cplane-adapter
echo "$SPW" | sudo -S systemctl restart neon-proxy
sleep 4
echo "   adapter: $(systemctl is-active neon-cplane-adapter)"
echo "   proxy:   $(systemctl is-active neon-proxy)"

echo "== 5. listeners =="
ss -ltnp | grep -E ":(5432|65432|5433) " || true

echo "== 6. adapter health =="
curl -s http://127.0.0.1:5433/health; echo

echo "== 7. auth + routing tests through NEW port =="
for EP in ep-main:55432 ep-0240dab0:55634 ep-99ab67a9:55433; do
  ID="${EP%%:*}"; WANT="${EP##*:}"
  GOT=$(PGPASSWORD=$NEWPW psql "postgresql://cloud_admin@127.0.0.1:$PORT/postgres?options=endpoint%3D$ID&sslmode=require" -tAc "SELECT inet_server_port();" 2>&1 | head -1)
  [ "$GOT" = "$WANT" ] && echo "PASS: $ID -> $GOT" || echo "FAIL: $ID -> $GOT (want $WANT)"
done

echo "== 8. rejections =="
OUT=$(PGPASSWORD=$OLDPW psql "postgresql://cloud_admin@127.0.0.1:$PORT/postgres?options=endpoint%3Dep-main&sslmode=require" -tAc "SELECT 1;" 2>&1 | head -1)
echo "$OUT" | grep -q ERROR && echo "PASS: old password rejected" || echo "FAIL: old password still accepted -> $OUT"
OUT=$(PGPASSWORD=$NEWPW psql "postgresql://cloud_admin@127.0.0.1:$PORT/postgres?options=endpoint%3Dep-nope&sslmode=require" -tAc "SELECT 1;" 2>&1 | head -1)
echo "$OUT" | grep -q ERROR && echo "PASS: invalid endpoint rejected" || echo "FAIL: invalid endpoint accepted -> $OUT"
OUT=$(PGPASSWORD=wrongpass psql "postgresql://cloud_admin@127.0.0.1:$PORT/postgres?options=endpoint%3Dep-main&sslmode=require" -tAc "SELECT 1;" 2>&1 | head -1)
echo "$OUT" | grep -q ERROR && echo "PASS: wrong password rejected" || echo "FAIL: wrong password accepted -> $OUT"

echo "== 9. direct computes (private path, new password) =="
for P in 55432 55634 55433; do
  OUT=$(PGPASSWORD=$NEWPW psql -h 127.0.0.1 -p $P -U cloud_admin -d postgres -tAc "SELECT 'ok';" 2>&1 | head -1)
  [ "$OUT" = "ok" ] && echo "PASS: direct :$P" || echo "FAIL: direct :$P -> $OUT"
done

echo "== 10. transaction via new port =="
PGPASSWORD=$NEWPW psql "postgresql://cloud_admin@127.0.0.1:$PORT/postgres?options=endpoint%3Dep-main&sslmode=require" \
  -tAc "BEGIN; CREATE TEMP TABLE _rt(x int); INSERT INTO _rt VALUES (7); SELECT x FROM _rt; COMMIT;" 2>&1 | head -4

echo "== DONE =="
