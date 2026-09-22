import { NextRequest, NextResponse } from "next/server";
import { ReadReplicaService } from "@/lib/read-replica-service";

// POST /api/replicas/[id]/restart
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await ReadReplicaService.restart(id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
