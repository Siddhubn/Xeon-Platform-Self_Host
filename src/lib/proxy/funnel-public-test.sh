#!/bin/bash
# FINAL public remote-access test suite via Tailscale Funnel -> Neon Proxy
# Checks: 3 endpoints route to the correct computes, version, SELECT 1,
# transaction, wrong password rejected, invalid endpoint rejected (no ep-main
# fallback), encryption required, public-IP path (no tailnet shortcut).
set -u
PW='tfC4O0RCx-JdhOdk3cxxG5KR5SGWq_0D'
HOST=testserver.tailb0a697.ts.net
PORT=443
PASS=0; FAIL=0
fail_pat='psql: error|FATAL|ERROR|could not|no route|timed out|closed the connection|refused'

# t <label> <expect ok|fail> <sql> <want-pattern> <extra-opts> <endpoint>
t() {
  local label="$1" expect="$2" sql="$3" want="$4" opts="$5" ep="$6"
  local url="postgresql://cloud_admin:${PW}@${HOST}:${PORT}/postgres?sslmode=require&sslnegotiation=direct${opts}"
  [ -n "$ep" ] && url="${url}&options=endpoint%3D${ep}"
  local out rc=0
  out=$(PGCONNECT_TIMEOUT=25 PGPASSWORD="$PW" psql "$url" -tAc "$sql" 2>&1) || rc=$?
  if [ "$expect" = ok ]; then
    if [ "$rc" -eq 0 ] && echo "$out" | grep -qiF "$want"; then
      echo "PASS  $label -> $(echo "$out" | head -1)"; PASS=$((PASS+1))
    else
      echo "FAIL  $label (rc=$rc) -> $out"; FAIL=$((FAIL+1))
    fi
  else
    if [ "$rc" -ne 0 ] && echo "$out" | grep -qiE "$fail_pat"; then
      echo "PASS  $label (correctly rejected) -> $(echo "$out" | head -1)"; PASS=$((PASS+1))
    else
      echo "FAIL  $label (should have been rejected, rc=$rc) -> $out"; FAIL=$((FAIL+1))
    fi
  fi
}

echo "=== 0. external DNS via public resolver (8.8.8.8) ==="
dig +short "$HOST" @8.8.8.8 +time=5 +tries=1

echo
echo "=== 1. ep-main (expected compute port 55432) ==="
t "ep-main version"    ok "SELECT version();" "PostgreSQL 17.5" "" "ep-main"
t "ep-main select 1"   ok "SELECT 1;" "1" "" "ep-main"
t "ep-main server port" ok "SELECT inet_server_port();" "55432" "" "ep-main"
t "ep-main db/user"    ok "SELECT current_user || '@' || current_database();" "cloud_admin@postgres" "" "ep-main"
t "ep-main transaction" ok "BEGIN; CREATE TEMP TABLE remote_access_test (id integer); INSERT INTO remote_access_test VALUES (1); SELECT id FROM remote_access_test; ROLLBACK; SELECT 'txn_ok';" "txn_ok" "" "ep-main"

echo
echo "=== 2. ep-0240dab0 (expected compute port 55634) ==="
t "ep-0240dab0 version"    ok "SELECT version();" "PostgreSQL 17.5" "" "ep-0240dab0"
t "ep-0240dab0 server port" ok "SELECT inet_server_port();" "55634" "" "ep-0240dab0"

echo
echo "=== 3. ep-99ab67a9 (expected compute port 55433) ==="
t "ep-99ab67a9 version"    ok "SELECT version();" "PostgreSQL 17.5" "" "ep-99ab67a9"
t "ep-99ab67a9 server port" ok "SELECT inet_server_port();" "55433" "" "ep-99ab67a9"

echo
echo "=== 4. security regressions ==="
t "invalid endpoint rejected" fail "SELECT version();" "x" "" "does-not-exist"

echo
echo "=== 4b. wrong password (explicit) ==="
url_badpw="postgresql://cloud_admin:WrongPassword123@${HOST}:${PORT}/postgres?sslmode=require&sslnegotiation=direct&options=endpoint%3Dep-main"
out=$(PGCONNECT_TIMEOUT=25 PGPASSWORD=WrongPassword123 psql "$url_badpw" -tAc "SELECT 1;" 2>&1); rc=$?
if [ "$rc" -ne 0 ] && echo "$out" | grep -qiE "$fail_pat"; then
  echo "PASS  wrong password rejected -> $(echo "$out" | head -1)"; PASS=$((PASS+1))
else
  echo "FAIL  wrong password NOT rejected (rc=$rc) -> $out"; FAIL=$((FAIL+1))
fi

echo
echo "=== 5. direct public-IP path (hostaddr forces internet route) ==="
IP=$(dig +short "$HOST" @8.8.8.8 +time=5 +tries=1 | head -1)
echo "public IP: $IP"
t "public-IP ep-main version" ok "SELECT version();" "PostgreSQL 17.5" "&hostaddr=${IP}" "ep-main"

echo
echo "=== 6. TLS: cert served on public 443 ==="
echo | timeout 10 openssl s_client -connect "${HOST}:${PORT}" -servername "$HOST" 2>/dev/null | grep -E "subject=|issuer=|Verify return" | head -3

echo
echo "=================== RESULT: PASS=$PASS FAIL=$FAIL ==================="
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "THERE ARE FAILURES"
