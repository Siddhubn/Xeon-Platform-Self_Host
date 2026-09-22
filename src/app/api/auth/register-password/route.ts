import { NextRequest, NextResponse } from "next/server";
import { registerPassword } from "@/lib/auth/password-store";

// POST /api/auth/register-password — register or update a user's password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, password, name, role } = body;

    if (!userId || !email || !password) {
      return NextResponse.json(
        { error: "userId, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    registerPassword(userId, email, password, name, role);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API] POST /api/auth/register-password:", err);
    return NextResponse.json(
      { error: err.message || "Failed to register password" },
      { status: 500 }
    );
  }
}
