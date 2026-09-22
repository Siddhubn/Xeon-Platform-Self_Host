import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers/self-hosted-neon-provider";

// GET /api/operations/:operationId
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> }
) {
  try {
    const { operationId } = await params;
    const provider = getProvider();
    const operation = await provider.operations.get(operationId);

    if (!operation) {
      return NextResponse.json({ error: "Operation not found" }, { status: 404 });
    }

    return NextResponse.json({ operation });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch operation" },
      { status: 500 }
    );
  }
}
