#!/bin/bash
# Install systemd services for Neon Proxy and Control Plane Adapter
# Run this with sudo on the server

set -e

echo "=== Installing Neon Proxy Services ==="

# Create service files
cat > /etc/systemd/system/neon-cplane-adapter.service << 'EOF'
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

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/neon/proxy-config
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/neon-proxy.service << 'EOF'
[Unit]
Description=Neon PostgreSQL Proxy
After=network.target neon-cplane-adapter.service postgresql.service
Wants=neon-cplane-adapter.service

[Service]
Type=simple
User=skxll_thief
WorkingDirectory=/opt/neon/proxy-config
EnvironmentFile=/opt/neon/proxy-config/proxy.env
ExecStartPre=/bin/bash -c 'sleep 2'
ExecStart=/opt/neon/target/release/proxy \
    --proxy 0.0.0.0:5432 \
    --auth-backend control-plane \
    --auth-endpoint http://127.0.0.1:5433/ \
    --control-plane-token "" \
    --http 127.0.0.1:7001 \
    --mgmt 127.0.0.1:7000 \
    --tls-key /opt/neon/proxy-config/tls/server.key \
    --tls-cert /opt/neon/proxy-config/tls/server.crt \
    --certs-dir /opt/neon/proxy-config/tls \
    --handshake-timeout 15s \
    --scram-protocol-timeout 15s \
    --scram-thread-pool-size 4
Restart=always
RestartSec=3
StandardOutput=append:/opt/neon/proxy-config/logs/proxy.log
StandardError=append:/opt/neon/proxy-config/logs/proxy.log

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/neon/proxy-config
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo "Service files created"
