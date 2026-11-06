#!/bin/bash
# Restart proxy (clears any cached empty access-control entries) and run full test suite
PW=tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D   # cloud_admin DB password
SPW=helloworld                          # sudo password (unchanged)

echo "=== proxy logs before restart (ep-0240dab0 attempts) ==="
journalctl -u neon-proxy --no-pager -n 40 2>&1 | grep -iE "0240dab0|access_control|error|secret" | tail -10

echo "=== restart proxy ==="
echo "$SPW" | sudo -S systemctl restart neon-proxy 2>&1 | grep -v "password for"
sleep 3
systemctl is-active neon-proxy

echo "=== TEST 1: proxy -> ep-0240dab0 version ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-0240dab0&sslmode=require" \
  -tAc "SELECT version();" 2>&1 | head -2

echo "=== TEST 2: proxy -> ep-0240dab0 server port (must be 55634) ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-0240dab0&sslmode=require" \
  -tAc "SELECT inet_server_addr() || ':' || inet_server_port();" 2>&1 | head -2

echo "=== TEST 3: proxy -> ep-main (must be 55432) ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-main&sslmode=require" \
  -tAc "SELECT inet_server_addr() || ':' || inet_server_port();" 2>&1 | head -2

echo "=== TEST 4: invalid endpoint must FAIL ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-nope&sslmode=require" \
  -tAc "SELECT 1;" 2>&1 | head -2

echo "=== TEST 5: wrong password must FAIL on ep-0240dab0 ==="
PGPASSWORD=wrongpass psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-0240dab0&sslmode=require" \
  -tAc "SELECT 1;" 2>&1 | head -2

echo "=== TEST 6: transaction on ep-0240dab0 through proxy ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-0240dab0&sslmode=require" \
  -c "CREATE TEMP TABLE t(x int); INSERT INTO t VALUES (1),(2); SELECT sum(x) FROM t;" 2>&1 | tail -3

echo "=== TEST 7: direct computes still work ==="
PGPASSWORD=$PW psql -h 127.0.0.1 -p 55432 -U cloud_admin -d postgres -tAc "SELECT '55432-ok';" 2>&1 | head -1
PGPASSWORD=$PW psql -h 127.0.0.1 -p 55634 -U cloud_admin -d postgres -tAc "SELECT '55634-ok';" 2>&1 | head -1

echo "=== DONE ==="
