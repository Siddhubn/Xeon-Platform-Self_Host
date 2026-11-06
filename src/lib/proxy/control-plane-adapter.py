#!/usr/bin/env python3
"""
Neon Proxy Control Plane Adapter — self-hosted multi-endpoint implementation.

Implements the HTTP API the Neon proxy expects when running with
--auth-backend control-plane:

  GET /wake_compute?endpointish=<id>&session_id=<id>
  GET /get_endpoint_access_control?endpointish=<id>&role=<role>&session_id=<id>
  GET /endpoints/<id>/jwks?session_id=<id>

Additionally provides:
  GET /list_endpoints           — JSON list of known endpoints (for UI)
  GET /health                   — health check

Endpoint resolution:
  1. Read endpoints from NEON_ENDPOINTS (JSON) or ENDPOINTS_FILE
  2. Each endpoint maps to a compute address (host:port)
  3. Unknown endpoints are REJECTED (403) — no silent fallback

Security:
  - No hardcoded passwords in source
  - SCRAM secrets fetched from pg_catalog.pg_authid (narrowest safe path)
  - Bearer token check if NEON_CPLANE_BEARER_TOKEN is set
  - No passwords logged
"""

import json
import os
import subprocess
import sys
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional, Dict, Any, List

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PG_HOST = os.environ.get("NEON_CPLANE_PG_HOST", "127.0.0.1")
PG_PORT = os.environ.get("NEON_CPLANE_PG_PORT", "55432")
PG_USER = os.environ.get("NEON_CPLANE_PG_USER", "cloud_admin")
PG_PASSWORD = os.environ.get("NEON_CPLANE_PG_PASSWORD", "")
PG_DATABASE = os.environ.get("NEON_CPLANE_PG_DATABASE", "postgres")

LISTEN_HOST = os.environ.get("NEON_CPLANE_LISTEN_HOST", "127.0.0.1")
LISTEN_PORT = int(os.environ.get("NEON_CPLANE_LISTEN_PORT", "5433"))

EXPECTED_TOKEN = os.environ.get("NEON_CPLANE_BEARER_TOKEN", "")

LOG_LEVEL = os.environ.get("NEON_CPLANE_LOG_LEVEL", "INFO")

# ---------------------------------------------------------------------------
# Endpoint registry — loaded from environment or file
# ---------------------------------------------------------------------------

def load_endpoints() -> Dict[str, Dict[str, Any]]:
    """
    Load endpoint registry. Priority:
      1. NEON_ENDPOINTS env var (JSON string)
      2. ENDPOINTS_FILE env var (path to JSON file)
      3. Single default endpoint from NEON_DEFAULT_ENDPOINT_ID
    """
    endpoints: Dict[str, Dict[str, Any]] = {}

    # Priority 1: NEON_ENDPOINTS environment variable
    endpoints_json = os.environ.get("NEON_ENDPOINTS", "")
    if endpoints_json:
        try:
            raw = json.loads(endpoints_json)
            for ep_id, ep_data in raw.items():
                endpoints[ep_id] = {
                    "host": ep_data.get("host", "127.0.0.1"),
                    "port": int(ep_data.get("port", 55432)),
                    "endpoint_id": ep_id,
                    "project_id": ep_data.get("project_id", "self-hosted"),
                    "branch_id": ep_data.get("branch_id", "main"),
                    "compute_id": ep_data.get("compute_id", ep_id),
                    "tenant_id": ep_data.get("tenant_id"),
                    "timeline_id": ep_data.get("timeline_id"),
                }
            logger.info(f"Loaded {len(endpoints)} endpoint(s) from NEON_ENDPOINTS env")
            return endpoints
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse NEON_ENDPOINTS JSON: {e}")

    # Priority 2: ENDPOINTS_FILE
    endpoints_file = os.environ.get("ENDPOINTS_FILE", "")
    if endpoints_file and os.path.isfile(endpoints_file):
        try:
            with open(endpoints_file, "r") as f:
                raw = json.load(f)
            for ep_id, ep_data in raw.items():
                endpoints[ep_id] = {
                    "host": ep_data.get("host", "127.0.0.1"),
                    "port": int(ep_data.get("port", 55432)),
                    "endpoint_id": ep_id,
                    "project_id": ep_data.get("project_id", "self-hosted"),
                    "branch_id": ep_data.get("branch_id", "main"),
                    "compute_id": ep_data.get("compute_id", ep_id),
                    "tenant_id": ep_data.get("tenant_id"),
                    "timeline_id": ep_data.get("timeline_id"),
                }
            logger.info(f"Loaded {len(endpoints)} endpoint(s) from {endpoints_file}")
            return endpoints
        except Exception as e:
            logger.error(f"Failed to load endpoints from {endpoints_file}: {e}")

    # Priority 3: Single default endpoint
    default_ep_id = os.environ.get("NEON_DEFAULT_ENDPOINT_ID", "ep-main")
    default_host = os.environ.get("NEON_COMPUTE_HOST", "127.0.0.1")
    default_port = int(os.environ.get("NEON_COMPUTE_PORT", "55432"))
    endpoints[default_ep_id] = {
        "host": default_host,
        "port": default_port,
        "endpoint_id": default_ep_id,
        "project_id": "self-hosted",
        "branch_id": "main",
        "compute_id": default_ep_id,
        "tenant_id": None,
        "timeline_id": None,
    }
    logger.info(f"Loaded default endpoint '{default_ep_id}' -> {default_host}:{default_port}")
    return endpoints


# Setup logging first so load_endpoints() can use logger
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format="%(asctime)s %(levelname)s [control-plane] %(message)s",
)
logger = logging.getLogger("control-plane-adapter")

# Load at startup
ENDPOINTS: Dict[str, Dict[str, Any]] = load_endpoints()


def resolve_endpoint(endpoint_id: str) -> Optional[Dict[str, Any]]:
    """
    Resolve an endpoint ID to its compute address.
    Returns None if the endpoint is not known — this causes a 403 rejection.
    """
    ep = ENDPOINTS.get(endpoint_id)
    if ep:
        return ep
    # Unknown endpoint — return None (rejected)
    logger.warning(f"Unknown endpoint '{endpoint_id}' — rejecting connection")
    return None


def get_scram_secret(role_name: str, ep: Optional[Dict[str, Any]] = None) -> Optional[str]:
    """Query the endpoint's OWN compute PostgreSQL for a role's SCRAM-SHA-256 secret.

    Each endpoint is a separate PostgreSQL cluster with its own pg_authid,
    so the secret must be read from the endpoint's compute — not a global port.
    Falls back to the configured default only if no endpoint is given.
    """
    try:
        env = os.environ.copy()
        env["PGPASSWORD"] = PG_PASSWORD
        result = subprocess.run(
            [
                "psql",
                "-h", ep["host"] if ep else PG_HOST,
                "-p", str(ep["port"]) if ep else PG_PORT,
                "-U", PG_USER,
                "-d", PG_DATABASE,
                "-t", "-A",
                "-c", f"SELECT rolpassword FROM pg_catalog.pg_authid WHERE rolname = '{role_name}'",
            ],
            env=env,
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            secret = result.stdout.strip()
            logger.info(f"Found SCRAM secret for role '{role_name}'")
            return secret
        else:
            logger.warning(f"No SCRAM secret found for role '{role_name}'")
            return ""
    except Exception as e:
        logger.error(f"Failed to query SCRAM secret: {e}")
        return ""


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------

class ControlPlaneHandler(BaseHTTPRequestHandler):
    """HTTP request handler implementing the Neon control-plane API."""

    def log_message(self, format, *args):
        logger.info(f"{self.client_address[0]} {format % args}")

    def _check_auth(self) -> bool:
        if not EXPECTED_TOKEN:
            return True
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:] == EXPECTED_TOKEN
        return False

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status: int, error: str, reason: str = "UNKNOWN"):
        self._send_json(status, {
            "error": error,
            "status": {
                "code": str(status),
                "message": error,
                "details": {
                    "error_info": {"reason": reason},
                    "retry_info": None,
                    "user_facing_message": {"message": error},
                },
            },
        })

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")  # normalize
        params = parse_qs(parsed.query)

        logger.info(f"GET {path} params={params}")

        if not self._check_auth():
            self._send_error_json(401, "Unauthorized")
            return

        if path == "/wake_compute":
            self._handle_wake_compute(params)
        elif path == "/get_endpoint_access_control":
            self._handle_get_endpoint_access_control(params)
        elif path.startswith("/endpoints/") and path.endswith("/jwks"):
            self._handle_get_endpoint_jwks(path, params)
        elif path == "/list_endpoints":
            self._handle_list_endpoints()
        elif path == "/health":
            self._handle_health()
        else:
            self._send_error_json(404, f"Not found: {path}", "RESOURCE_NOT_FOUND")

    def _handle_wake_compute(self, params: dict):
        endpointish = params.get("endpointish", [None])[0]
        if not endpointish:
            self._send_error_json(400, "Missing 'endpointish' parameter")
            return

        ep = resolve_endpoint(endpointish)
        if not ep:
            self._send_error_json(403,
                f"Endpoint '{endpointish}' not found",
                "ENDPOINT_NOT_FOUND")
            return

        address = f"{ep['host']}:{ep['port']}"
        response = {
            "address": address,
            "server_name": None,  # No TLS to internal compute
            "aux": {
                "endpoint_id": ep["endpoint_id"],
                "project_id": ep["project_id"],
                "branch_id": ep["branch_id"],
                "compute_id": ep["compute_id"],
                "cold_start_info": "warm",
            },
        }
        logger.info(f"wake_compute: endpoint={endpointish} -> {address}")
        self._send_json(200, response)

    def _handle_get_endpoint_access_control(self, params: dict):
        endpointish = params.get("endpointish", [None])[0]
        role = params.get("role", [None])[0]

        if not endpointish:
            self._send_error_json(400, "Missing 'endpointish' parameter")
            return
        if not role:
            self._send_error_json(400, "Missing 'role' parameter")
            return

        ep = resolve_endpoint(endpointish)
        if not ep:
            self._send_error_json(403,
                f"Endpoint '{endpointish}' not found",
                "ENDPOINT_NOT_FOUND")
            return

        role_secret = get_scram_secret(role, ep)

        response = {
            "role_secret": role_secret,
            "allowed_ips": [],  # Allow all IPs for self-hosted
            "allowed_vpc_endpoint_ids": [],
            "block_public_connections": False,
            "block_vpc_connections": False,
            "project_id": ep["project_id"],
            "account_id": "self-hosted",
        }
        logger.info(f"get_endpoint_access_control: endpoint={endpointish} role={role}")
        self._send_json(200, response)

    def _handle_get_endpoint_jwks(self, path: str, params: dict):
        parts = path.strip("/").split("/")
        endpoint_id = parts[1] if len(parts) == 3 else "unknown"
        response = {"jwks": []}
        logger.info(f"get_endpoint_jwks: endpoint={endpoint_id}")
        self._send_json(200, response)

    def _handle_list_endpoints(self):
        """Return all known endpoints — used by UI integration."""
        endpoint_list = []
        for ep_id, ep_data in ENDPOINTS.items():
            endpoint_list.append({
                "endpoint_id": ep_id,
                "host": ep_data["host"],
                "port": ep_data["port"],
                "project_id": ep_data["project_id"],
                "branch_id": ep_data["branch_id"],
                "compute_id": ep_data["compute_id"],
            })
        self._send_json(200, {"endpoints": endpoint_list})

    def _handle_health(self):
        """Simple health check."""
        self._send_json(200, {
            "status": "ok",
            "endpoints_count": len(ENDPOINTS),
        })


def main():
    logger.info(f"Starting Neon Control Plane Adapter on {LISTEN_HOST}:{LISTEN_PORT}")
    logger.info(f"PostgreSQL: {PG_HOST}:{PG_PORT} user={PG_USER} db={PG_DATABASE}")
    logger.info(f"Bearer token required: {'yes' if EXPECTED_TOKEN else 'no (accepting all)'}")
    logger.info(f"Known endpoints: {list(ENDPOINTS.keys())}")

    server = HTTPServer((LISTEN_HOST, LISTEN_PORT), ControlPlaneHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down control-plane adapter")
        server.shutdown()


if __name__ == "__main__":
    main()
