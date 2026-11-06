#!/bin/bash
# Install and start Neon Proxy systemd services
# Run this as a regular user with sudo access

PASS="helloworld"

echo "$PASS" | sudo -S bash -c '
cat > /etc/systemd/system/neon-cplane-adapter.service << '"'"'UNIT'"'"'
[Unit]
Description=Neon Control Plane Adapter
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=skxll_thief
WorkingDirectory=/opt/neon/proxy-config
EnvironmentFile=/opt/neon/proxy-config/proxy.env
ExecStart=/usr/bin/python3 /opt/neon/proxy-config/bin/control-plane-adapter.py
Restart=always
RestartSec=3
StandardOutput=append:/opt/neon/proxy-config/logs/adapter.log
StandardError=append:/opt/neon/proxy-config/logs/adapter.log
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

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
systemctl enable neon-cplane-adapter neon-proxy
'

echo "=== Services installed ==="

# Kill existing manual processes first
echo "$PASS" | sudo -S kill $(ps aux | grep "python3.*control-plane-adapter" | grep -v grep | awk "{print \$2}") 2>/dev/null || true
echo "$PASS" | sudo -S kill $(ps aux | grep "[/].*target/release/proxy" | grep -v grep | awk "{print \$2}") 2>/dev/null || true
sleep 2

echo "$PASS" | sudo -S systemctl start neon-cplane-adapter
sleep 2
echo "$PASS" | sudo -S systemctl start neon-proxy
sleep 2

echo "=== Service Status ==="
echo "$PASS" | sudo -S systemctl status neon-cplane-adapter --no-pager -l 2>&1 | head -15
echo "---"
echo "$PASS" | sudo -S systemctl status neon-proxy --no-pager -l 2>&1 | head -15
