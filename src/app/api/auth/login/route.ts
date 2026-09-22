import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const result = verifyPassword(email, password);
    if (result) {
      return NextResponse.json({
        user: {
          id: result.userId,
          name: result.entry.name || email.split("@")[0],
          email,
          role: result.entry.role || "developer",
        },
        success: true,
      });
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
