#!/bin/bash
# Generate self-signed TLS certificate for Neon Proxy
# Includes wildcard SAN for *.db.neon.example.com
#
# For production: replace with ACME/Let's Encrypt wildcard cert

set -e

CERT_DIR="/opt/neon/proxy-config/tls"
DOMAIN="${NEON_PUBLIC_DOMAIN:-db.neon.example.com}"

mkdir -p "$CERT_DIR"

# Generate RSA private key
openssl genrsa -out "$CERT_DIR/server.key" 2048
chmod 600 "$CERT_DIR/server.key"

# Generate self-signed certificate with wildcard SAN
cat > "$CERT_DIR/san.cnf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = US
ST = California
L = San Francisco
O = Neon Self-Hosted
CN = $DOMAIN

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = *.$DOMAIN
DNS.3 = localhost
IP.1 = 127.0.0.1
EOF

openssl req -new -x509 -key "$CERT_DIR/server.key" \
    -out "$CERT_DIR/server.crt" \
    -days 3650 \
    -config "$CERT_DIR/san.cnf"

echo "TLS certificate generated:"
openssl x509 -in "$CERT_DIR/server.crt" -text -noout | grep -A2 "Subject:"
echo ""
echo "SAN entries:"
openssl x509 -in "$CERT_DIR/server.crt" -text -noout | grep -A5 "Subject Alternative Name"
