#!/bin/bash
# Funnel diagnosis: clean ONLY stale funnel procs, then test funnel with captured output.
set -u
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null   # prime sudo timestamp

echo "=== BASELINE (must remain untouched) ==="
ps -o pid,cmd -C tailscaled,proxy,python3 2>/dev/null | head -10

echo
echo "=== BEFORE: funnel-related processes ==="
pgrep -af "funnel" || echo "(none)"

echo
echo "=== STEP 1: kill ONLY stale funnel processes ==="
for pid in $(pgrep -f "tailscale funnel"); do
  echo "kill TERM -> $pid ($(ps -o cmd= -p $pid 2>/dev/null))"
  sudo -n kill -TERM "$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
done
for pid in $(pgrep -f "enable-funnel.sh"); do
  echo "kill TERM -> $pid ($(ps -o cmd= -p $pid 2>/dev/null))"
  kill -TERM "$pid" 2>/dev/null || sudo -n kill -TERM "$pid" 2>/dev/null
done
sleep 2
for pid in $(pgrep -f "tailscale funnel"); do
  echo "kill KILL -> $pid"
  sudo -n kill -KILL "$pid" 2>/dev/null || true
done
sleep 1
echo "remaining funnel procs: $(pgrep -af 'tailscale funnel' || echo '(none)')"
echo "tailscaled still up:   $(pgrep -af '/usr/sbin/tailscaled' || echo 'MISSING!')"

echo
echo "=== STEP 2: funnel status + reset any partial config ==="
sudo -n tailscale funnel status 2>&1 || true
sudo -n tailscale funnel reset 2>&1 || true

echo
echo "=== STEP 3: capability probe ==="
tailscale status --json 2>/dev/null | grep -io '"[^"]*funnel[^"]*"' | head -5 || echo "(no funnel cap strings in status JSON)"

echo
echo "=== STEP 4: funnel --bg test (60s timeout, stdin=/dev/null) ==="
sudo -n timeout 60 tailscale funnel --bg --yes --tcp=443 65432 </dev/null >/tmp/funnel-bg.log 2>&1
rc=$?
echo "exit code: $rc  (124 = timed out/hung)"
echo "--- /tmp/funnel-bg.log ---"
cat /tmp/funnel-bg.log
echo "--- end log ---"

echo
echo "=== STEP 5: funnel status after --bg attempt ==="
sudo -n tailscale funnel status 2>&1 || true

echo
echo "=== STEP 6: if still no config, foreground run (45s) to capture live output ==="
if ! sudo -n tailscale funnel status 2>&1 | grep -qi "tcp"; then
  sudo -n timeout 45 tailscale funnel --yes --tcp=443 65432 </dev/null >/tmp/funnel-fg.log 2>&1
  frc=$?
  echo "foreground exit code: $frc"
  echo "--- /tmp/funnel-fg.log ---"
  cat /tmp/funnel-fg.log
  echo "--- end fg log ---"
  echo "=== status after foreground ==="
  sudo -n tailscale funnel status 2>&1 || true
fi

echo
echo "=== FINAL: baseline check (pids must match) ==="
ps -o pid,cmd -C tailscaled,proxy,python3 2>/dev/null | head -10
echo "=== END ==="
