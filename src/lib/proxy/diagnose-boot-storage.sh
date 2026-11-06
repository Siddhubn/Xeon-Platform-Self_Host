#!/bin/bash
# diagnose-boot-storage.sh — find why compute_ctl stays in Init post-boot
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
export PATH=/usr/local/bin:/usr/bin:/bin
cd /srv/neon || exit 1

echo "=== Neon stack processes ==="
ps -eo pid,user,etime,cmd | grep -E "pageserver|safekeeper|storage_broker|storage_controller|endpoint_storage|compute_ctl" | grep -v grep || echo "(none!)"

echo
echo "=== stack listeners ==="
ss -lnt | grep -E "[:.](1234|1235|50051|9993|5454|7676|64000)[[:space:]]" || echo "(missing listeners!)"

echo
echo "=== storage controller API (10s timeout) ==="
timeout 10 curl -s -m 8 -w "\nHTTP=%{http_code}\n" http://127.0.0.1:1234/v1/tenant 2>&1 | head -c 500
echo

echo
echo "=== pageserver API /v1/tenant (10s timeout, with -v status) ==="
timeout 10 curl -s -m 8 -o /dev/null -w "HTTP=%{http_code} rc-note\n" http://127.0.0.1:64000/v1/tenant 2>&1
timeout 10 curl -s -m 8 http://127.0.0.1:64000/v1/tenant 2>&1 | head -c 300
echo

echo
echo "=== neon_local pageserver status (timeout 15) ==="
timeout 15 neon_local pageserver status 2>&1 || echo "(timed out/failed)"

echo
echo "=== neon_local tenant list (timeout 15) ==="
timeout 15 neon_local tenant list 2>&1 || echo "(timed out/failed)"

echo
echo "=== storage controller log tail ==="
find /srv/neon/.neon/storage_controller_1 -name "*.log" 2>/dev/null | head -3
tail -20 /srv/neon/.neon/storage_controller_1/*.log 2>/dev/null | tail -25

echo
echo "=== pageserver log tail (attach/errors) ==="
tail -30 /srv/neon/.neon/pageserver_1/*.log 2>/dev/null | grep -iE "attach|error|warn|tenant" | tail -15
echo "--- raw last 10 ---"
tail -10 /srv/neon/.neon/pageserver_1/*.log 2>/dev/null
echo "=== END ==="
