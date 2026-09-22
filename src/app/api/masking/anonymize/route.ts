import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { randomBytes } from "crypto";
import { getProvider, createOperation, completeOperation } from "@/lib/providers/self-hosted-neon-provider";
import { getCurrentUser } from "@/lib/session-helper";
import { notifyMaskingCompleted, notifyMaskingFailed } from "@/lib/notification-service";

function generateId(): string {
  return randomBytes(16).toString("hex");
}

// POST /api/masking/anonymize — create an anonymized branch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      sourceBranchId,
      targetBranchName,
      databaseName,
      rules,
      createdBy,
    } = body;

    if (!projectId || !sourceBranchId || !targetBranchName || !rules || !Array.isArray(rules)) {
      return NextResponse.json(
        { error: "projectId, sourceBranchId, targetBranchName, and rules array are required" },
        { status: 400 }
      );
    }

    if (rules.length === 0) {
      return NextResponse.json(
        { error: "At least one masking rule is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const provider = getProvider();

    // Create operation to track progress
    const operationId = createOperation("anonymize_branch", projectId);
    const maskingOpId = generateId();
    const now = new Date().toISOString();

    // Create masking operation record
    db.insert(schema.maskingOperations)
      .values({
        id: maskingOpId,
        organizationId: body.organizationId || "org-default-001",
        projectId,
        sourceBranchId,
        databaseName: databaseName || "postgres",
        status: "creating_branch",
        progress: 10,
        currentStep: "Creating branch",
        totalSteps: 4,
        rulesApplied: 0,
        rowsAffected: 0,
        createdBy: createdBy || "1",
        createdAt: now,
      })
      .run();

    try {
      // Step 1: Create the new branch (copy of source)
      const sourceBranch = await provider.branches.get(projectId, sourceBranchId);
      const targetBranch = await provider.branches.create({
        projectId,
        parentBranchId: sourceBranchId,
        name: targetBranchName,
      });

      // Update progress
      db.update(schema.maskingOperations)
        .set({
          targetBranchId: targetBranch.id,
          status: "preparing",
          progress: 25,
          currentStep: "Preparing anonymization",
        })
        .where(eq(schema.maskingOperations.id, maskingOpId))
        .run();

      // Step 2: Apply masking rules to the target branch
      // Update progress
      db.update(schema.maskingOperations)
        .set({
          status: "masking",
          progress: 50,
          currentStep: "Applying masking rules",
        })
        .where(eq(schema.maskingOperations.id, maskingOpId))
        .run();

      const { applyMasking } = await import("@/lib/data-masking/masking-engine");

      // Get compute connection for target branch
      const targetCompute = db
        .select()
        .from(schema.computes)
        .where(
          and(
            eq(schema.computes.projectId, projectId),
            eq(schema.computes.branchId, targetBranch.id),
            isNull(schema.computes.deletedAt)
          )
        )
        .get();

      const host = targetCompute?.host || process.env.POSTGRES_HOST || "localhost";
      const port = targetCompute?.port || parseInt(process.env.POSTGRES_PORT || "5432");

      const maskResult = await applyMasking(
        { host, port, database: databaseName || "postgres" },
        rules.map((r: any) => ({
          schemaName: r.schemaName || "public",
          tableName: r.tableName,
          columnName: r.columnName,
          ruleType: r.ruleType,
          configuration: r.configuration,
          customExpression: r.customExpression,
        }))
      );

      // Step 3: Verify
      db.update(schema.maskingOperations)
        .set({
          status: "verifying",
          progress: 80,
          currentStep: "Verifying result",
          rulesApplied: maskResult.rulesApplied,
          rowsAffected: maskResult.rowsAffected,
        })
        .where(eq(schema.maskingOperations.id, maskingOpId))
        .run();

      // Step 4: Complete
      const finalStatus = maskResult.success ? "completed" : "failed";
      const completedAt = new Date().toISOString();

      db.update(schema.maskingOperations)
        .set({
          status: finalStatus,
          progress: 100,
          currentStep: maskResult.success ? "Completed" : "Failed",
          error: maskResult.errors.length > 0 ? maskResult.errors.join("; ") : null,
          completedAt,
        })
        .where(eq(schema.maskingOperations.id, maskingOpId))
        .run();

      completeOperation(operationId, maskResult.success ? "completed" : "failed",
        maskResult.errors.length > 0 ? maskResult.errors.join("; ") : undefined
      );

      // Create notification
      try {
        const user = await getCurrentUser();
        if (user) {
          const cookie = request.headers.get("cookie") || "";
          const orgMatch = cookie.match(/active_org=([^;]+)/);
          const orgId = orgMatch?.[1] || undefined;
          if (maskResult.success) {
            notifyMaskingCompleted(user.id, orgId, targetBranchName, maskResult.rulesApplied);
          } else {
            notifyMaskingFailed(user.id, orgId, targetBranchName, maskResult.errors.join("; "));
          }
        }
      } catch {}

      return NextResponse.json({
        success: maskResult.success,
        operationId: maskingOpId,
        targetBranch,
        rulesApplied: maskResult.rulesApplied,
        rowsAffected: maskResult.rowsAffected,
        errors: maskResult.errors,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // Mark operation as failed
      db.update(schema.maskingOperations)
        .set({
          status: "failed",
          progress: 0,
          currentStep: "Failed",
          error: message,
          completedAt: new Date().toISOString(),
        })
        .where(eq(schema.maskingOperations.id, maskingOpId))
        .run();

      completeOperation(operationId, "failed", message);

      return NextResponse.json(
        { error: message, operationId: maskingOpId },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
