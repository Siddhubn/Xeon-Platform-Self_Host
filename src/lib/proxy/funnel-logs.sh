#!/bin/bash
# Show what the Neon proxy logged during the funnel tests (last 30 min)
PW=helloworld
echo "$PW" | sudo -S true 2>/dev/null
echo "=== neon-proxy journal (last 30 min, connection/handshake lines) ==="
sudo -n journalctl -u neon-proxy --since "30 min ago" --no-pager 2>/dev/null | grep -iE "handshake|tls|ssl|connect|endpoint|error|warn" | tail -40
echo
echo "=== raw last 20 lines ==="
sudo -n journalctl -u neon-proxy --since "30 min ago" --no-pager 2>/dev/null | tail -20
echo "=== END ==="
