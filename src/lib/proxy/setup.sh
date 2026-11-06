#!/bin/bash
# One-time setup script for Neon Proxy remote access.
# Run this on the server as a user with sudo privileges.
#
# Usage:
#   chmod +x /opt/neon/proxy-config/bin/setup.sh
#   sudo /opt/neon/proxy-config/bin/setup.sh
#
# This script:
# 1. Generates TLS certificates
# 2. Installs systemd services
# 3. Installs psql client if not present
# 4. Enables and starts the services

set -euo pipefail

echo "=== Neon Proxy Remote Access Setup ==="
echo ""

# 1. Generate TLS certificates if not present
if [ ! -f "/opt/neon/proxy-config/tls/server.key" ]; then
    echo "Generating TLS certificates..."
    bash /opt/neon/proxy-config/bin/generate-tls-certs.sh "db.neon.example.com"
    echo ""
else
    echo "TLS certificates already exist, skipping generation."
    echo ""
fi

# 2. Install systemd services
echo "Installing systemd services..."
cp /opt/neon/proxy-config/neon-cplane-adapter.service /etc/systemd/system/ 2>/dev/null || \
    cp /tmp/neon-cplane-adapter.service /etc/systemd/system/
cp /opt/neon/proxy-config/neon-proxy.service /etc/systemd/system/ 2>/dev/null || \
    cp /tmp/neon-proxy.service /etc/systemd/system/
systemctl daemon-reload
echo "  ✓ Systemd services installed"
echo ""

# 3. Install psql client if needed
if ! command -v psql &>/dev/null; then
    echo "Installing PostgreSQL client..."
    apt-get update -qq && apt-get install -y -qq postgresql-client > /dev/null 2>&1
    echo "  ✓ psql installed"
else
    echo "  ✓ psql already installed"
fi
echo ""

# 4. Set ownership
chown -R skxll_thief:skxll_thief /opt/neon/proxy-config/

# 5. Enable services (but don't start yet - let the user verify first)
systemctl enable neon-cplane-adapter.service
systemctl enable neon-proxy.service
echo "  ✓ Services enabled (not started yet)"
echo ""

echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Update the domain in /opt/neon/proxy-config/proxy.env:"
echo "       NEON_PUBLIC_DOMAIN=\"your-domain.com\""
echo ""
echo "  2. If using a real domain, replace self-signed certs:"
echo "       /opt/neon/proxy-config/bin/generate-tls-certs.sh your-domain.com"
echo ""
echo "  3. Start the services:"
echo "       sudo systemctl start neon-cplane-adapter"
echo "       sudo systemctl start neon-proxy"
echo ""
echo "  4. Test locally:"
echo "       psql 'postgresql://cloud_admin@127.0.0.1:65432/postgres?sslmode=require'   # password: see proxy.env"
echo ""
echo "  5. Test remotely (from another machine):"
echo "       psql 'postgresql://cloud_admin@<server-ip>:65432/postgres?sslmode=require'   # password: see proxy.env"
echo ""
