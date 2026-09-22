import { NextRequest, NextResponse } from "next/server";
import { ReadReplicaService } from "@/lib/read-replica-service";

// POST /api/replicas/[id]/test-read-only
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await ReadReplicaService.testReadOnly(id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
