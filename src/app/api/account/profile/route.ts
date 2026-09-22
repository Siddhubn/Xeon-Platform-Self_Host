import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import { userProfiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const profile = db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .get();

    return NextResponse.json({
      profile: profile || null,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Failed to get profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      displayName,
      username,
      bio,
      fullName,
      organization,
      jobTitle,
      location,
      website,
    } = body;

    // Validation
    if (displayName !== undefined) {
      if (typeof displayName !== "string" || displayName.trim().length === 0) {
        return NextResponse.json(
          { error: "Display name cannot be empty" },
          { status: 400 }
        );
      }
      if (displayName.trim().length > 100) {
        return NextResponse.json(
          { error: "Display name must be 100 characters or less" },
          { status: 400 }
        );
      }
    }

    if (username !== undefined && username !== null && username !== "") {
      if (typeof username !== "string") {
        return NextResponse.json(
          { error: "Invalid username" },
          { status: 400 }
        );
      }
      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 30) {
        return NextResponse.json(
          { error: "Username must be between 3 and 30 characters" },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return NextResponse.json(
          { error: "Username can only contain letters, numbers, hyphens, and underscores" },
          { status: 400 }
        );
      }
      // Check uniqueness
      const db = getDb();
      const existing = db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.username, trimmed))
        .get();
      if (existing && existing.userId !== user.id) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 400 }
        );
      }
    }

    if (bio !== undefined && bio !== null && typeof bio === "string" && bio.length > 500) {
      return NextResponse.json(
        { error: "Bio must be 500 characters or less" },
        { status: 400 }
      );
    }

    if (website !== undefined && website !== null && website !== "") {
      try {
        new URL(website);
      } catch {
        return NextResponse.json(
          { error: "Invalid website URL" },
          { status: 400 }
        );
      }
    }

    const db = getDb();
    const existing = db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .get();

    const now = new Date().toISOString();
    const updates: Record<string, string | null> = {
      updatedAt: now,
    };

    if (displayName !== undefined) updates.displayName = displayName.trim();
    if (username !== undefined) updates.username = username?.trim() || null;
    if (bio !== undefined) updates.bio = bio?.trim() || null;
    if (fullName !== undefined) updates.fullName = fullName?.trim() || null;
    if (organization !== undefined) updates.organization = organization?.trim() || null;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle?.trim() || null;
    if (location !== undefined) updates.location = location?.trim() || null;
    if (website !== undefined) updates.website = website?.trim() || null;

    if (existing) {
      db.update(userProfiles)
        .set(updates)
        .where(eq(userProfiles.userId, user.id))
        .run();
    } else {
      const profileId = crypto.randomUUID();
      db.insert(userProfiles)
        .values({
          id: profileId,
          userId: user.id,
          displayName: displayName?.trim() || user.name,
          username: username?.trim() || null,
          bio: bio?.trim() || null,
          fullName: fullName?.trim() || null,
          organization: organization?.trim() || null,
          jobTitle: jobTitle?.trim() || null,
          location: location?.trim() || null,
          website: website?.trim() || null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    const updated = db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .get();

    return NextResponse.json({ profile: updated });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
