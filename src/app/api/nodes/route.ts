import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers/self-hosted-neon-provider";

// GET /api/nodes — list all pageserver nodes
export async function GET() {
  try {
    const provider = getProvider();
    const nodes = await provider.nodes.list();
    return NextResponse.json({ nodes });
  } catch (err: any) {
    console.error("[API] GET /api/nodes:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch nodes" },
      { status: 500 }
    );
  }
}
