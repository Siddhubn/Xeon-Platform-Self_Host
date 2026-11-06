#!/bin/bash
# diag-pageserver-curl.sh — why did start-endpoints.sh's readiness wait fail?
PW=helloworld
echo "which curl: $(command -v curl || echo MISSING)"
echo -n "GET /v1/tenant as $(whoami) -> HTTP "
curl -s -o /dev/null -w "%{http_code} (exit=$?)" --max-time 3 http://127.0.0.1:64000/v1/tenant
echo
echo -n "with -f: "
curl -sf --max-time 3 http://127.0.0.1:64000/v1/tenant >/dev/null 2>&1 && echo "OK" || echo "FAILED (rc=$?)"
echo "--- first bytes of body ---"
curl -s --max-time 3 http://127.0.0.1:64000/v1/tenant | head -c 200
echo
