import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { handleDataApiRequest } from "@/lib/data-api/proxy";

function resolvePostgresConnection(projectId: string, branchId: string) {
  const db = getDb();
  const compute = db
    .select()
    .from(schema.computes)
    .where(
      and(
        eq(schema.computes.projectId, projectId),
        eq(schema.computes.branchId, branchId),
        isNull(schema.computes.deletedAt)
      )
    )
    .get();

  return {
    host: compute?.host || process.env.POSTGRES_HOST || "localhost",
    port: compute?.port || parseInt(process.env.POSTGRES_PORT || "5432"),
  };
}

async function handleProxyRequest(
  request: NextRequest,
  params: { projectId: string; branchId: string; databaseName: string; path: string[] }
) {
  const { projectId, branchId, databaseName } = params;
  const resourcePath = params.path?.join("/") || "";

  // Verify Data API is enabled for this database
  const db = getDb();
  const config = db
    .select()
    .from(schema.dataApiConfigs)
    .where(
      and(
        eq(schema.dataApiConfigs.projectId, projectId),
        eq(schema.dataApiConfigs.branchId, branchId),
        eq(schema.dataApiConfigs.databaseName, databaseName),
        eq(schema.dataApiConfigs.enabled, true)
      )
    )
    .get();

  if (!config) {
    return NextResponse.json(
      { error: "Data API is not enabled for this database" },
      { status: 403 }
    );
  }

  // Check authentication
  const authHeader = request.headers.get("authorization");
  if (!config.anonymousAccess && (!authHeader || !authHeader.startsWith("Bearer "))) {
    return NextResponse.json(
      { error: "Authorization required. Provide a Bearer token." },
      { status: 401 }
    );
  }

  // TODO: Validate JWT token against jwtSecret or jwksUrl when authMode is "jwt"

  // Resolve PostgreSQL connection
  const conn = resolvePostgresConnection(projectId, branchId);

  // Parse request
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let body: unknown = undefined;
  if (["POST", "PATCH", "PUT"].includes(request.method)) {
    try {
      body = await request.json();
    } catch {
      // No body or invalid JSON
    }
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const allowedSchemas = (config.allowedSchemas || "public").split(",").map((s) => s.trim());

  // Forward request to Data API proxy
  const response = await handleDataApiRequest(
    {
      method: request.method,
      path: resourcePath,
      headers,
      query,
      body,
    },
    {
      host: conn.host,
      port: conn.port,
      database: databaseName,
      role: config.apiRoles?.split(",")[0]?.trim(),
      schema: config.defaultSchema || "public",
      allowedSchemas,
    }
  );

  return NextResponse.json(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string; databaseName: string; path: string[] }> }
) {
  const p = await params;
  return handleProxyRequest(request, p);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string; databaseName: string; path: string[] }> }
) {
  const p = await params;
  return handleProxyRequest(request, p);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string; databaseName: string; path: string[] }> }
) {
  const p = await params;
  return handleProxyRequest(request, p);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; branchId: string; databaseName: string; path: string[] }> }
) {
  const p = await params;
  return handleProxyRequest(request, p);
}
