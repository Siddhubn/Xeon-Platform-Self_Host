#!/bin/bash
# start-endpoints.sh — idempotent boot-time start of all registered compute
# endpoints. Used by neon-endpoints.service. Runs as user skxll_thief so that
# PostgreSQL is NEVER started as root.
set -u
export PATH=/usr/local/bin:/usr/bin:/bin
cd /srv/neon || { echo "ERROR: /srv/neon not found"; exit 1; }

ENDPOINTS="ep-main ep-0240dab0 ep-99ab67a9"

port_of() {
  python3 -c "import json;print(json.load(open('/srv/neon/.neon/endpoints/'+'$1'+'/endpoint.json'))['pg_port'])" 2>/dev/null
}

listening() { ss -lnt | grep -qE "[:.]$1[[:space:]]"; }

# Pageserver readiness: TCP check only (the pageserver HTTP API closes bare
# curl requests with an empty reply, so HTTP-level probing is unreliable here).
echo "[start-endpoints] waiting for pageserver listener (127.0.0.1:64000)..."
for i in $(seq 1 45); do
  if ss -lnt | grep -qE "[:.]64000[[:space:]]"; then
    echo "[start-endpoints] pageserver is up"
    break
  fi
  sleep 2
done

rc=0
for ep in $ENDPOINTS; do
  port=$(port_of "$ep")
  if [ -z "$port" ]; then
    echo "[start-endpoints] ERROR: no endpoint.json for $ep — skipping"
    rc=1
    continue
  fi
  if listening "$port"; then
    echo "[start-endpoints] OK: $ep already listening on 127.0.0.1:$port"
    continue
  fi
  echo "[start-endpoints] starting $ep (pg port $port)..."
  started=0
  for attempt in 1 2 3 4 5; do
    if neon_local endpoint start "$ep"; then
      started=1
      break
    fi
    echo "[start-endpoints]   attempt $attempt failed for $ep; retrying in 10s"
    sleep 10
  done
  # wait for the postgres port to actually accept connections
  for i in $(seq 1 30); do
    listening "$port" && break
    sleep 2
  done
  if listening "$port"; then
    echo "[start-endpoints] OK: $ep up on 127.0.0.1:$port"
  else
    echo "[start-endpoints] ERROR: $ep FAILED to come up on port $port (started=$started)"
    rc=1
  fi
done

echo "[start-endpoints] done (rc=$rc)"
exit $rc
