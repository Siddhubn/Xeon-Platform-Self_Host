import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { introspectSourceSchema, parseConnectionString } from "@/lib/import-service";

/**
 * POST /api/import-data/schema
 * Introspect the schema of an external source database.
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

    // Validate it parses correctly (don't store or return password)
    const parsed = parseConnectionString(connectionString);

    const schema = await introspectSourceSchema(connectionString);

    return NextResponse.json({
      success: true,
      sourceHost: parsed.host,
      sourceDatabase: parsed.database,
      schema,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to introspect source schema" },
      { status: 500 }
    );
  }
}
