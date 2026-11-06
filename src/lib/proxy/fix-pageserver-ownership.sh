#!/bin/bash
# Recovery: pageserver was restarted with `sudo` and now runs as root.
# PostgreSQL WAL-redo refuses to run as root -> every page read fails ->
# computes crash on startup -> projects show "degraded".
# Fix: stop root pageserver, chown its data dir back, start it as skxll_thief.
set -x
SPW=helloworld                          # sudo password (unchanged)
DBPW=tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D  # cloud_admin DB password
cd /srv/neon || exit 1

echo "== process owners =="
for p in pageserver safekeeper storage_controller storage_broker compute_ctl proxy; do
  pgrep -af "$p" | head -3
done
ps -eo user,pid,cmd | grep -E "pageserver|safekeeper|storage_controller|compute_ctl" | grep -v grep

echo "== stop root pageserver =="
PSPID=$(pgrep -x pageserver | head -1)
if [ -n "$PSPID" ]; then
  PUSER=$(ps -o user= -p "$PSPID" | tr -d ' ')
  echo "pageserver pid=$PSPID user=$PUSER"
  if [ "$PUSER" = "root" ]; then
    echo "$SPW" | sudo -S kill "$PSPID"
    sleep 4
    echo "$SPW" | sudo -S pkill -x pageserver 2>/dev/null
    sleep 2
    # return any root-owned files to the service user
    echo "$SPW" | sudo -S chown -R skxll_thief:neon-admin /srv/neon/.neon
  fi
else
  echo "no pageserver running"
fi

echo "== start pageserver as skxll_thief =="
neon_local pageserver status || true
neon_local pageserver start || true
sleep 3
neon_local pageserver status
ps -eo user,pid,cmd | grep "[p]ageserver"

echo "== start ep-main endpoint =="
neon_local endpoint list || true
neon_local endpoint start ep-main || true
sleep 5
neon_local endpoint list || true

echo "== listeners =="
ss -ltnp | grep -E "55432|64000" || true

echo "== psql through compute =="
PGPASSWORD=$DBPW psql -h 127.0.0.1 -p 55432 -U cloud_admin -d postgres -tAc "SELECT version();" 2>&1 | head -2 || true

echo "== psql through neon proxy 65432 =="
PGPASSWORD=$DBPW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-main&sslmode=require" -tAc "SELECT current_user, current_database();" 2>&1 | head -3 || true

echo "== DONE rc=$? =="
