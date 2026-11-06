#!/bin/bash
# Deploy multi-endpoint adapter fix + provision SCRAM secret on ep-0240dab0's cluster
PW=tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D   # cloud_admin DB password
SPW=helloworld                          # sudo password (unchanged)

echo "=== set SCRAM secret on 55634 cluster ==="
PGPASSWORD=$PW psql -h 127.0.0.1 -p 55634 -U cloud_admin -d postgres \
  -c "ALTER USER cloud_admin PASSWORD '$PW';" 2>&1

echo "=== restart adapter service ==="
echo "$SPW" | sudo -S systemctl restart neon-cplane-adapter 2>&1 | grep -v "password for"
sleep 2
systemctl is-active neon-cplane-adapter

echo "=== TEST 1: proxy -> ep-0240dab0 (new endpoint) ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-0240dab0&sslmode=require" \
  -tAc "SELECT version();" 2>&1 | head -2

echo "=== TEST 2: proxy -> ep-main (regression) ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-main&sslmode=require" \
  -tAc "SELECT inet_server_port();" 2>&1 | head -2

echo "=== TEST 3: wrong endpoint routes to ITS OWN port ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-0240dab0&sslmode=require" \
  -tAc "SELECT inet_server_addr() || ':' || inet_server_port();" 2>&1 | head -2

echo "=== TEST 4: invalid endpoint must FAIL ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-nope&sslmode=require" \
  -tAc "SELECT 1;" 2>&1 | head -2

echo "=== TEST 5: transaction on ep-0240dab0 ==="
PGPASSWORD=$PW psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?options=endpoint%3Dep-0240dab0&sslmode=require" \
  -c "CREATE TEMP TABLE t(x int); INSERT INTO t VALUES (1),(2); SELECT sum(x) FROM t;" 2>&1 | tail -4

echo "=== adapter health ==="
curl -s http://127.0.0.1:5433/health
echo
curl -s http://127.0.0.1:5433/list_endpoints
echo
echo "=== DONE ==="
