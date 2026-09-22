import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// -----------------------------------------------------------------------
// Connection resolver
// -----------------------------------------------------------------------

function resolvePostgresConnection(
  projectId: string,
  branchId: string
): { host: string; port: number; user: string; password: string; database: string } {
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
    user: process.env.POSTGRES_USER || "cloud_admin",
    password: process.env.POSTGRES_PASSWORD || "helloworld",
    database: compute?.database || process.env.POSTGRES_DATABASE || "neondb",
  };
}

// -----------------------------------------------------------------------
// Process management
// -----------------------------------------------------------------------

interface StudioInstance {
  process: ChildProcess;
  port: number;
  configPath: string;
  projectId: string;
  branchId: string;
  databaseName: string;
  startedAt: number;
}

const runningInstances = new Map<string, StudioInstance>();

function getInstanceKey(
  projectId: string,
  branchId: string,
  databaseName: string
): string {
  return `${projectId}:${branchId}:${databaseName}`;
}

function killInstance(instance: StudioInstance) {
  try {
    instance.process.kill("SIGTERM");
  } catch {
    // process may already be dead
  }
  try {
    fs.unlinkSync(instance.configPath);
  } catch {
    // ignore
  }
}

function cleanupStaleInstances() {
  for (const [key, instance] of runningInstances.entries()) {
    if (instance.process.exitCode !== null) {
      runningInstances.delete(key);
      try {
        fs.unlinkSync(instance.configPath);
      } catch {
        // ignore
      }
    }
  }
}

// -----------------------------------------------------------------------
// POST /api/data/studio — Start a drizzle-kit studio instance
// -----------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, branchId, databaseName } = body;

    if (!projectId || !branchId) {
      return NextResponse.json(
        { error: "projectId and branchId are required" },
        { status: 400 }
      );
    }

    const dbName = databaseName || "neondb";
    const instanceKey = getInstanceKey(projectId, branchId, dbName);

    // Clean up stale instances
    cleanupStaleInstances();

    // Check if already running for this context
    const existing = runningInstances.get(instanceKey);
    if (existing && existing.process.exitCode === null) {
      return NextResponse.json({
        port: existing.port,
        url: `https://local.drizzle.studio?port=${existing.port}`,
        status: "already_running",
      });
    }

    // Resolve connection details
    const conn = resolvePostgresConnection(projectId, branchId);

    // Generate a random port between 15000-19999
    const port = 15000 + Math.floor(Math.random() * 5000);

    // Create a temp directory for the config
    const tmpDir = path.join(os.tmpdir(), `drizzle-studio-${instanceKey.replace(/:/g, "-")}`);
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const configPath = path.join(tmpDir, "drizzle.config.ts");
    const configContent = `
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: {
    host: "${conn.host}",
    port: ${conn.port},
    user: "${conn.user}",
    password: "${conn.password}",
    database: "${dbName}",
    ssl: false,
  },
});
`.trim();

    fs.writeFileSync(configPath, configContent, "utf-8");

    // Find the drizzle-kit binary and node_modules
    const neonPlatformDir = path.resolve(process.cwd());
    const drizzleKitPath = path.join(
      neonPlatformDir,
      "node_modules",
      ".bin",
      "drizzle-kit"
    );

    if (!fs.existsSync(drizzleKitPath)) {
      return NextResponse.json(
        { error: "drizzle-kit not found. Please install it: npm install drizzle-kit" },
        { status: 500 }
      );
    }

    // Symlink node_modules into the temp dir so drizzle-kit can resolve imports
    const nodeModulesLink = path.join(tmpDir, "node_modules");
    if (!fs.existsSync(nodeModulesLink)) {
      fs.symlinkSync(path.join(neonPlatformDir, "node_modules"), nodeModulesLink, "dir");
    }

    // Start drizzle-kit studio
    const child = spawn(
      drizzleKitPath,
      ["studio", "--port", String(port), "--host", "0.0.0.0"],
      {
        cwd: tmpDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NODE_ENV: "development",
          NODE_PATH: path.join(neonPlatformDir, "node_modules"),
        },
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    // Store the instance
    const instance: StudioInstance = {
      process: child,
      port,
      configPath,
      projectId,
      branchId,
      databaseName: dbName,
      startedAt: Date.now(),
    };
    runningInstances.set(instanceKey, instance);

    // Clean up on exit
    child.on("exit", () => {
      runningInstances.delete(instanceKey);
      try {
        fs.unlinkSync(configPath);
      } catch {
        // ignore
      }
    });

    // Wait a bit for the server to start
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if process is still running
    if (child.exitCode !== null) {
      runningInstances.delete(instanceKey);
      return NextResponse.json(
        {
          error: `drizzle-kit studio failed to start`,
          details: stderr || stdout,
          exitCode: child.exitCode,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      studioPort: port,
      url: `https://local.drizzle.studio?port=${port}`,
      status: "started",
      database: dbName,
      host: conn.host,
      postgresPort: conn.port,
    });
  } catch (err: any) {
    console.error("[API] POST /api/data/studio:", err);
    return NextResponse.json(
      { error: err.message || "Failed to start Drizzle Studio" },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------
// DELETE /api/data/studio — Stop a drizzle-kit studio instance
// -----------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || "";
    const branchId = request.nextUrl.searchParams.get("branchId") || "";
    const databaseName =
      request.nextUrl.searchParams.get("databaseName") || "neondb";

    if (!projectId || !branchId) {
      return NextResponse.json(
        { error: "projectId and branchId are required" },
        { status: 400 }
      );
    }

    const instanceKey = getInstanceKey(projectId, branchId, databaseName);
    const instance = runningInstances.get(instanceKey);

    if (instance) {
      killInstance(instance);
      runningInstances.delete(instanceKey);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API] DELETE /api/data/studio:", err);
    return NextResponse.json(
      { error: err.message || "Failed to stop Drizzle Studio" },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------
// GET /api/data/studio — Check status of a drizzle-kit studio instance
// -----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || "";
    const branchId = request.nextUrl.searchParams.get("branchId") || "";
    const databaseName =
      request.nextUrl.searchParams.get("databaseName") || "neondb";

    if (!projectId || !branchId) {
      return NextResponse.json(
        { error: "projectId and branchId are required" },
        { status: 400 }
      );
    }

    cleanupStaleInstances();

    const instanceKey = getInstanceKey(projectId, branchId, databaseName);
    const instance = runningInstances.get(instanceKey);

    if (instance && instance.process.exitCode === null) {
      return NextResponse.json({
        status: "running",
        port: instance.port,
        url: `https://local.drizzle.studio?port=${instance.port}`,
        database: instance.databaseName,
        uptime: Date.now() - instance.startedAt,
      });
    }

    return NextResponse.json({ status: "stopped" });
  } catch (err: any) {
    console.error("[API] GET /api/data/studio:", err);
    return NextResponse.json(
      { error: err.message || "Failed to check Drizzle Studio status" },
      { status: 500 }
    );
  }
}
