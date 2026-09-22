#!/bin/bash
# Deploy Neon Proxy + Adapter files to the remote server
# Run from the project root
set -e

SERVER="skxll_thief@100.85.236.26"
REMOTE_DIR="/opt/neon/proxy-config"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploying Neon Proxy Configuration ==="
echo "Local:  $LOCAL_DIR"
echo "Remote: $SERVER:$REMOTE_DIR"

# Create remote directory
sshpass -p 'helloworld' ssh -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR/bin $REMOTE_DIR/tls $REMOTE_DIR/logs"

# Copy files
sshpass -p 'helloworld' scp -o StrictHostKeyChecking=no "$LOCAL_DIR/control-plane-adapter.py" "$SERVER:$REMOTE_DIR/bin/"
sshpass -p 'helloworld' scp -o StrictHostKeyChecking=no "$LOCAL_DIR/endpoints.json" "$SERVER:$REMOTE_DIR/"
sshpass -p 'helloworld' scp -o StrictHostKeyChecking=no "$LOCAL_DIR/proxy.env" "$SERVER:$REMOTE_DIR/"
sshpass -p 'helloworld' scp -o StrictHostKeyChecking=no "$LOCAL_DIR/neon-cplane-adapter.service" "$SERVER:/etc/systemd/system/"
sshpass -p 'helloworld' scp -o StrictHostKeyChecking=no "$LOCAL_DIR/neon-proxy.service" "$SERVER:/etc/systemd/system/"
sshpass -p 'helloworld' scp -o StrictHostKeyChecking=no "$LOCAL_DIR/generate-tls-certs.sh" "$SERVER:$REMOTE_DIR/bin/"
sshpass -p 'helloworld' scp -o StrictHostKeyChecking=no "$LOCAL_DIR/verify-proxy-prereqs.sh" "$SERVER:$REMOTE_DIR/bin/"

echo "=== Files deployed ==="
echo "Now run on server: bash $REMOTE_DIR/bin/install-services.sh"
