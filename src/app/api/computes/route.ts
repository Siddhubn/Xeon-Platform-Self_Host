import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers/self-hosted-neon-provider";

// GET /api/computes - list all compute endpoints
export async function GET(request: NextRequest) {
  try {
    const provider = getProvider();
    const projectId = request.nextUrl.searchParams.get("projectId");
    
    // If projectId is provided, list computes for that project
    if (projectId) {
      const computes = await provider.computes.list(projectId);
      return NextResponse.json({ endpoints: computes });
    }
    
    // Otherwise, return empty list (endpoints are discovered dynamically)
    return NextResponse.json({ endpoints: [] });
  } catch (err: any) {
    console.error("[API] GET /api/computes:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch computes" },
      { status: 500 }
    );
  }
}
