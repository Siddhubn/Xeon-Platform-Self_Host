import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/session-helper";
import { notifyDataApiEnabled, notifyDataApiDisabled } from "@/lib/notification-service";

function generateId(): string {
  return randomBytes(16).toString("hex");
}

// GET /api/data-api/config?projectId=X&branchId=Y&databaseName=Z
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const branchId = searchParams.get("branchId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();
    const conditions = [
      eq(schema.dataApiConfigs.projectId, projectId),
    ];
    if (branchId) {
      conditions.push(eq(schema.dataApiConfigs.branchId, branchId));
    }

    // Query all configs matching the project (and optionally branch)
    const rows = db
      .select()
      .from(schema.dataApiConfigs)
      .where(and(...conditions))
      .all();

    // Remove sensitive fields
    const configs = rows.map((r) => ({
      ...r,
      jwtSecret: r.jwtSecret ? "••••••••" : null,
    }));

    return NextResponse.json({ configs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/data-api/config — create or update config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      branchId,
      databaseName,
      enabled,
      authMode,
      jwtSecret,
      jwksUrl,
      anonymousAccess,
      allowedSchemas,
      defaultSchema,
      apiRoles,
      corsOrigins,
      publicSchemaAccess,
    } = body;

    if (!projectId || !branchId || !databaseName) {
      return NextResponse.json(
        { error: "projectId, branchId, and databaseName are required" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if config already exists
    const existing = db
      .select()
      .from(schema.dataApiConfigs)
      .where(
        and(
          eq(schema.dataApiConfigs.projectId, projectId),
          eq(schema.dataApiConfigs.branchId, branchId),
          eq(schema.dataApiConfigs.databaseName, databaseName)
        )
      )
      .get();

    if (existing) {
      // Update existing
      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (enabled !== undefined) updates.enabled = enabled;
      if (authMode !== undefined) updates.authMode = authMode;
      if (jwtSecret !== undefined && jwtSecret !== "••••••••") updates.jwtSecret = jwtSecret;
      if (jwksUrl !== undefined) updates.jwksUrl = jwksUrl;
      if (anonymousAccess !== undefined) updates.anonymousAccess = anonymousAccess;
      if (allowedSchemas !== undefined) updates.allowedSchemas = allowedSchemas;
      if (defaultSchema !== undefined) updates.defaultSchema = defaultSchema;
      if (apiRoles !== undefined) updates.apiRoles = apiRoles;
      if (corsOrigins !== undefined) updates.corsOrigins = corsOrigins;
      if (publicSchemaAccess !== undefined) updates.publicSchemaAccess = publicSchemaAccess;

      db.update(schema.dataApiConfigs)
        .set(updates)
        .where(eq(schema.dataApiConfigs.id, existing.id))
        .run();

      const updated = db
        .select()
        .from(schema.dataApiConfigs)
        .where(eq(schema.dataApiConfigs.id, existing.id))
        .get();

      return NextResponse.json({ config: updated ? { ...updated, jwtSecret: updated.jwtSecret ? "••••••••" : null } : null });
    }

    // Create new config
    const id = generateId();
    const now = new Date().toISOString();

    // Generate JWT secret if not provided
    const finalJwtSecret = jwtSecret || randomBytes(32).toString("hex");

    db.insert(schema.dataApiConfigs)
      .values({
        id,
        organizationId: body.organizationId || "org-default-001",
        projectId,
        branchId,
        databaseName,
        enabled: enabled ?? false,
        authMode: authMode || "jwt",
        jwtSecret: finalJwtSecret,
        jwksUrl: jwksUrl || null,
        anonymousAccess: anonymousAccess ?? false,
        allowedSchemas: allowedSchemas || "public",
        defaultSchema: defaultSchema || "public",
        apiRoles: apiRoles || null,
        corsOrigins: corsOrigins || "*",
        publicSchemaAccess: publicSchemaAccess ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const config = db
      .select()
      .from(schema.dataApiConfigs)
      .where(eq(schema.dataApiConfigs.id, id))
      .get();

    // Create notification for Data API enable/disable
    try {
      const user = await getCurrentUser();
      if (user && enabled !== undefined) {
        const cookie = request.headers.get("cookie") || "";
        const orgMatch = cookie.match(/active_org=([^;]+)/);
        const orgId = orgMatch?.[1] || undefined;
        if (enabled) {
          notifyDataApiEnabled(user.id, orgId, databaseName);
        } else {
          notifyDataApiDisabled(user.id, orgId, databaseName);
        }
      }
    } catch {}

    return NextResponse.json({ config: { ...config, jwtSecret: "••••••••" } }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/data-api/config?id=X — disable and remove config
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    db.update(schema.dataApiConfigs)
      .set({ enabled: false, updatedAt: new Date().toISOString() })
      .where(eq(schema.dataApiConfigs.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
