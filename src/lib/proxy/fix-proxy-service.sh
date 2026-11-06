#!/bin/bash
# Fix and restart Neon Proxy systemd services
# The proxy requires --control-plane-token to have a non-empty value
PASS="helloworld"

echo "$PASS" | sudo -S bash -c '
cat > /etc/systemd/system/neon-proxy.service << '"'"'UNIT'"'"'
[Unit]
Description=Neon PostgreSQL Proxy
After=network.target neon-cplane-adapter.service postgresql.service
Wants=neon-cplane-adapter.service

[Service]
Type=simple
User=skxll_thief
WorkingDirectory=/opt/neon/proxy-config
EnvironmentFile=/opt/neon/proxy-config/proxy.env
ExecStart=/opt/neon/target/release/proxy --proxy 0.0.0.0:65432 --auth-backend control-plane --auth-endpoint http://127.0.0.1:5433/ --control-plane-token self-hosted-noauth --http 127.0.0.1:7001 --mgmt 127.0.0.1:7000 --tls-key /opt/neon/proxy-config/tls/server.key --tls-cert /opt/neon/proxy-config/tls/server.crt --certs-dir /opt/neon/proxy-config/tls --handshake-timeout 15s --scram-protocol-timeout 15s --scram-thread-pool-size 4
Restart=always
RestartSec=3
StandardOutput=append:/opt/neon/proxy-config/logs/proxy.log
StandardError=append:/opt/neon/proxy-config/logs/proxy.log
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl restart neon-proxy
'

sleep 3
echo "=== Proxy Service Status ==="
echo "$PASS" | sudo -S systemctl status neon-proxy --no-pager -l 2>&1 | head -15
echo "=== Test Connection ==="
sleep 2
# Password comes from proxy.env / PGPASSWORD — do not hardcode credentials here.
timeout 10 psql "postgresql://cloud_admin@127.0.0.1:65432/postgres?sslmode=require&options=endpoint%3Dep-main" -c "SELECT 1 as systemd_proxy_works;" 2>&1
echo "EXIT: $?"
