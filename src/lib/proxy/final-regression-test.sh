#!/bin/bash
# Final registry sync + full regression test suite
PW=tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D   # cloud_admin DB password
SPW=helloworld                          # sudo password (unchanged)
PROXY_PORT=65432

echo "=== restart adapter to load new registry ==="
echo "$SPW" | sudo -S systemctl restart neon-cplane-adapter 2>&1 | grep -v "password for"
sleep 2
echo "adapter: $(systemctl is-active neon-cplane-adapter)"
echo "proxy:   $(systemctl is-active neon-proxy)"
curl -s http://127.0.0.1:5433/health; echo

run_pg() {
  local label="$1" url="$2" expect="$3" query="$4"
  out=$(PGPASSWORD=$PW psql "$url" -tAc "$query" 2>&1 | head -1)
  if echo "$out" | grep -q "$expect"; then
    echo "PASS: $label -> $out"
  else
    echo "FAIL: $label -> $out (expected '$expect')"
  fi
}

echo "=== multi-endpoint routing via proxy :$PROXY_PORT ==="
run_pg "ep-main port"       "postgresql://cloud_admin@127.0.0.1:$PROXY_PORT/postgres?options=endpoint%3Dep-main&sslmode=require" "55432" "SELECT inet_server_port();"
run_pg "ep-0240dab0 port"   "postgresql://cloud_admin@127.0.0.1:$PROXY_PORT/postgres?options=endpoint%3Dep-0240dab0&sslmode=require" "55634" "SELECT inet_server_port();"
run_pg "ep-99ab67a9 port"   "postgresql://cloud_admin@127.0.0.1:$PROXY_PORT/postgres?options=endpoint%3Dep-99ab67a9&sslmode=require" "55433" "SELECT inet_server_port();"
run_pg "ep-99ab67a9 version" "postgresql://cloud_admin@127.0.0.1:$PROXY_PORT/postgres?options=endpoint%3Dep-99ab67a9&sslmode=require" "PostgreSQL 17" "SELECT version();"
run_pg "ep-99ab67a9 txn"    "postgresql://cloud_admin@127.0.0.1:$PROXY_PORT/postgres?options=endpoint%3Dep-99ab67a9&sslmode=require" "3" "SELECT 1+2;"

echo "=== rejections (must fail) ==="
out=$(PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:$PROXY_PORT/postgres?options=endpoint%3Dep-nope&sslmode=require" -tAc "SELECT 1;" 2>&1 | head -1)
echo "$out" | grep -q "ERROR" && echo "PASS: invalid endpoint rejected" || echo "FAIL: invalid endpoint accepted -> $out"
out=$(PGPASSWORD=wrongpass psql "postgresql://cloud_admin@127.0.0.1:$PROXY_PORT/postgres?options=endpoint%3Dep-99ab67a9&sslmode=require" -tAc "SELECT 1;" 2>&1 | head -1)
echo "$out" | grep -q "ERROR" && echo "PASS: wrong password rejected" || echo "FAIL: wrong password accepted -> $out"

echo "=== direct compute ports (private, still work) ==="
run_pg "direct 55432" "host=127.0.0.1 port=55432 dbname=postgres user=cloud_admin" "ok" "SELECT 'ok';"
run_pg "direct 55634" "host=127.0.0.1 port=55634 dbname=postgres user=cloud_admin" "ok" "SELECT 'ok';"
run_pg "direct 55433" "host=127.0.0.1 port=55433 dbname=postgres user=cloud_admin" "ok" "SELECT 'ok';"

echo "=== internal services still on 127.0.0.1 only ==="
ss -ltn 2>/dev/null | grep -E "127.0.0.1:(1234|9898|9993|5454|7676|64000|50051|51051|5433)$" | wc -l | xargs echo "internal listeners bound to loopback:"
ss -ltn 2>/dev/null | grep -E "0.0.0.0:$PROXY_PORT" | wc -l | xargs echo "public proxy listeners:"

echo "=== DONE ==="
