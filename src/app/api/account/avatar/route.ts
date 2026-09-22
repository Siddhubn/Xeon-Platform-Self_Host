import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const AVATAR_DIR = path.join(process.cwd(), "public", "avatars");
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function ensureAvatarDir() {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 5MB" },
        { status: 400 }
      );
    }

    ensureAvatarDir();

    // Generate safe filename
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${user.id}-${crypto.randomUUID()}.${ext}`;
    const filepath = path.join(AVATAR_DIR, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filepath, buffer);

    // Delete old avatar if exists
    const db = getDb();
    const existing = db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .get();

    if (existing?.avatarUrl) {
      const oldPath = path.join(process.cwd(), "public", existing.avatarUrl);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch {}
      }
    }

    const avatarUrl = `/avatars/${filename}`;

    if (existing) {
      db.update(userProfiles)
        .set({ avatarUrl, updatedAt: new Date().toISOString() })
        .where(eq(userProfiles.userId, user.id))
        .run();
    } else {
      db.insert(userProfiles)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          displayName: user.name,
          avatarUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
    }

    return NextResponse.json({ avatarUrl });
  } catch (error) {
    console.error("Failed to upload avatar:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const existing = db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .get();

    if (existing?.avatarUrl) {
      const filepath = path.join(process.cwd(), "public", existing.avatarUrl);
      if (fs.existsSync(filepath)) {
        try { fs.unlinkSync(filepath); } catch {}
      }

      db.update(userProfiles)
        .set({ avatarUrl: null, updatedAt: new Date().toISOString() })
        .where(eq(userProfiles.userId, user.id))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete avatar:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
