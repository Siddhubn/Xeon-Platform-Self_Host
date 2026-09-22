import { NextRequest, NextResponse } from "next/server";
import { ReadReplicaService } from "@/lib/read-replica-service";

// GET /api/replicas/[id]/status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const status = await ReadReplicaService.getStatus(id);
    if (!status) {
      return NextResponse.json({ error: "Replica not found" }, { status: 404 });
    }
    return NextResponse.json({ status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
