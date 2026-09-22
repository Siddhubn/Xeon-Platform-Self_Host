import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { testConnection } from "@/lib/import-service";

/**
 * POST /api/import-data/test-connection
 * Test connection to an external PostgreSQL database.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { connectionString } = body;

    if (!connectionString || typeof connectionString !== "string") {
      return NextResponse.json(
        { error: "Connection string is required" },
        { status: 400 }
      );
    }

    const result = await testConnection(connectionString);

    if (result.success) {
      return NextResponse.json({
        success: true,
        info: result.info,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to test connection" },
      { status: 500 }
    );
  }
}
