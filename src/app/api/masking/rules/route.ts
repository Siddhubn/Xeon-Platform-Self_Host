import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";

function generateId(): string {
  return randomBytes(16).toString("hex");
}

// GET /api/masking/rules?projectId=X&branchId=Y&databaseName=Z
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const branchId = searchParams.get("branchId");
    const databaseName = searchParams.get("databaseName");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const db = getDb();
    const conditions = [eq(schema.maskingRules.projectId, projectId)];
    if (branchId) conditions.push(eq(schema.maskingRules.branchId, branchId));
    if (databaseName) conditions.push(eq(schema.maskingRules.databaseName, databaseName));

    const rules = db
      .select()
      .from(schema.maskingRules)
      .where(and(...conditions))
      .all();

    return NextResponse.json({ rules });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/masking/rules — create or update masking rules
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id: existingId,
      projectId,
      branchId,
      databaseName,
      schemaName,
      tableName,
      columnName,
      ruleType,
      configuration,
      customExpression,
      enabled,
      createdBy,
    } = body;

    if (!projectId || !branchId || !databaseName || !tableName || !columnName || !ruleType) {
      return NextResponse.json(
        { error: "projectId, branchId, databaseName, tableName, columnName, and ruleType are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    if (existingId) {
      // Update existing rule
      const updates: Record<string, unknown> = { updatedAt: now };
      if (ruleType) updates.ruleType = ruleType;
      if (configuration !== undefined) updates.configuration = JSON.stringify(configuration);
      if (customExpression !== undefined) updates.customExpression = customExpression;
      if (enabled !== undefined) updates.enabled = enabled;

      db.update(schema.maskingRules)
        .set(updates)
        .where(eq(schema.maskingRules.id, existingId))
        .run();

      const updated = db
        .select()
        .from(schema.maskingRules)
        .where(eq(schema.maskingRules.id, existingId))
        .get();

      return NextResponse.json({ rule: updated });
    }

    // Create new rule
    const id = generateId();
    db.insert(schema.maskingRules)
      .values({
        id,
        organizationId: body.organizationId || "org-default-001",
        projectId,
        branchId,
        databaseName,
        schemaName: schemaName || "public",
        tableName,
        columnName,
        ruleType,
        configuration: configuration ? JSON.stringify(configuration) : null,
        customExpression: customExpression || null,
        enabled: enabled ?? true,
        createdBy: createdBy || "1",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const rule = db
      .select()
      .from(schema.maskingRules)
      .where(eq(schema.maskingRules.id, id))
      .get();

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/masking/rules?id=X
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = getDb();
    db.delete(schema.maskingRules)
      .where(eq(schema.maskingRules.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
