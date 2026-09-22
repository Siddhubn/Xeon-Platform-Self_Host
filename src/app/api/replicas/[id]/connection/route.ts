import { NextRequest, NextResponse } from "next/server";
import { ReadReplicaService } from "@/lib/read-replica-service";

// GET /api/replicas/[id]/connection?method=direct|tailscale|lan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const method = (searchParams.get("method") || "direct") as "direct" | "tailscale" | "lan";

    const replica = ReadReplicaService.get(id);
    if (!replica) {
      return NextResponse.json({ error: "Replica not found" }, { status: 404 });
    }

    const connectionString = ReadReplicaService.getConnectionString(id, method);

    return NextResponse.json({
      connectionString,
      host: replica.host,
      port: replica.port,
      database: replica.database,
      role: replica.role,
      method,
      type: "read_only",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
