#!/bin/bash
# =============================================================================
# Public domain setup for the Neon Proxy (self-hosted)
#
# Does, in order:
#   1. DuckDNS dynamic-IP updater (cron every 5 min) for your domain + wildcard
#   2. Let's Encrypt wildcard cert *.DOMAIN via acme.sh + dns_duckdns (DNS-01)
#      -> needs NO open ports, works before port-forwarding is done
#   3. Installs cert/key into the proxy TLS dir with an auto-renew reload hook
#   4. Sets NEON_PUBLIC_DOMAIN in the proxy config
#   5. Restarts neon-proxy and verifies the certificate presented on :65432
#
# USAGE (on the Ubuntu server, as skxll_thief):
#   DOMAIN=yourname.duckdns.org \
#   DUCKDNS_TOKEN=<token from duckdns.org> \
#   EMAIL=you@example.com \
#   bash setup-public-domain.sh
# =============================================================================
set -euo pipefail

: "${DOMAIN:?Set DOMAIN=yourname.duckdns.org}"
: "${DUCKDNS_TOKEN:?Set DUCKDNS_TOKEN=<your DuckDNS account token>}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
SUDO_PW="${SUDO_PW:-helloworld}"   # sudo password for skxll_thief (server-only)

CONF_DIR="/opt/neon/proxy-config"
TLS_DIR="$CONF_DIR/tls"
BIN_DIR="$CONF_DIR/bin"
SHORT="${DOMAIN%.duckdns.org}"      # DuckDNS API uses the subname only

mkdir -p "$BIN_DIR" "$TLS_DIR"

echo "== step 1: DuckDNS IP updater =="
cat > "$BIN_DIR/duckdns-update.sh" <<EOF
#!/bin/bash
# Keeps your DuckDNS A record pointed at this connection's public IPv4.
# (Your ISP IP is dynamic; DuckDNS detects it automatically.)
curl -s --max-time 20 "https://www.duckdns.org/update?domains=${SHORT}&token=${DUCKDNS_TOKEN}" >/dev/null 2>&1 || true
# wildcard record (ep-<id>.${DOMAIN}); harmless if unsupported on your account
curl -s --max-time 20 "https://www.duckdns.org/update?domains=*&token=${DUCKDNS_TOKEN}" >/dev/null 2>&1 || true
EOF
chmod 700 "$BIN_DIR/duckdns-update.sh"
"$BIN_DIR/duckdns-update.sh"
# install cron entry exactly once
( crontab -l 2>/dev/null | grep -v duckdns-update || true; echo "*/5 * * * * $BIN_DIR/duckdns-update.sh" ) | crontab -
echo "   updater installed (every 5 min). Current A-record update response:"
curl -s --max-time 20 "https://www.duckdns.org/update?domains=${SHORT}&token=${DUCKDNS_TOKEN}"; echo

echo "== step 2: install acme.sh (if needed) =="
if [ ! -s "$HOME/.acme.sh/acme.sh" ]; then
  curl -s https://get.acme.sh | sh -s email="$EMAIL" >/dev/null
fi
echo "   acme.sh present"

echo "== step 3: issue wildcard cert *.${DOMAIN} (DNS-01, no open ports needed) =="
export DUCKDNS_TOKEN
"$HOME/.acme.sh/acme.sh" --issue --dns dns_duckdns -d "*.${DOMAIN}" --server letsencrypt

echo "== step 4: install cert into proxy TLS dir + renewal reload hook =="
# allow the renewal hook to restart only this one service, without a password prompt
echo "$SUDO_PW" | sudo -S bash -c \
  'echo "skxll_thief ALL=(root) NOPASSWD: /usr/bin/systemctl restart neon-proxy" > /etc/sudoers.d/neon-proxy-reload && chmod 440 /etc/sudoers.d/neon-proxy-reload' 2>/dev/null || true

"$HOME/.acme.sh/acme.sh" --install-cert -d "*.${DOMAIN}" \
  --fullchain-file "$TLS_DIR/server.crt" \
  --key-file "$TLS_DIR/server.key" \
  --reloadcmd "sudo -n /usr/bin/systemctl restart neon-proxy"
chmod 600 "$TLS_DIR/server.key"
chmod 644 "$TLS_DIR/server.crt"
echo "   installed: $TLS_DIR/server.crt + server.key (renews automatically ~60d)"

echo "== step 5: set NEON_PUBLIC_DOMAIN in proxy config =="
if grep -q "^NEON_PUBLIC_DOMAIN=" "$CONF_DIR/proxy.env"; then
  sed -i "s|^NEON_PUBLIC_DOMAIN=.*|NEON_PUBLIC_DOMAIN=${DOMAIN}|" "$CONF_DIR/proxy.env"
else
  echo "NEON_PUBLIC_DOMAIN=${DOMAIN}" >> "$CONF_DIR/proxy.env"
fi
if grep -q "^NEON_PROXY_PORT=" "$CONF_DIR/proxy.env"; then
  sed -i "s|^NEON_PROXY_PORT=.*|NEON_PROXY_PORT=65432|" "$CONF_DIR/proxy.env"
else
  echo "NEON_PROXY_PORT=65432" >> "$CONF_DIR/proxy.env"
fi
echo "   NEON_PUBLIC_DOMAIN=${DOMAIN}  NEON_PROXY_PORT=65432"

echo "== step 6: restart proxy and verify certificate on :65432 =="
echo "$SUDO_PW" | sudo -S systemctl restart neon-proxy 2>/dev/null || true
sleep 3
echo "   service: $(systemctl is-active neon-proxy)"
echo | timeout 8 openssl s_client -connect 127.0.0.1:65432 -servername "ep-main.${DOMAIN}" 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates 2>/dev/null || echo "   (openssl check failed)"

cat <<DONE

=============================================================================
DONE. What this script did NOT do (verify manually):

  A. DuckDNS record(s) must exist in your account (duckdns.org -> Add Domain):
       ${SHORT}        -> (updater keeps its IP current)
       *               -> wildcard for ep-<id>.${SHORT}  (Add Domain named *)

  B. Router port forward (required for internet reachability):
       WAN 49.207.131.22:65432/TCP  ->  33.0.0.114:65432
       Forward ONLY 65432. Do NOT forward 55432/9898/1234/etc.
       Router admin is likely at http://33.0.0.1

  C. Local console config (Neon UI machine), then restart the dev server:
       neon-platform/.env.local:
         NEON_PUBLIC_DOMAIN=${DOMAIN}
         NEON_PROXY_PORT=65432

  D. BEFORE opening the port to the internet: the cloud_admin password has
     been rotated (see NEON_CPLANE_PG_PASSWORD in proxy.env — server-only).

  E. External test (from cellular data, NOT this network):
       psql "postgresql://cloud_admin:<PASSWORD>@ep-main.${DOMAIN}:65432/postgres?sslmode=require&options=endpoint%3Dep-main"
=============================================================================
DONE
