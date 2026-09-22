import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { getDb } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { isValidAccentColor } from "@/lib/theme/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDb();
    const prefs = db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .get();

    return NextResponse.json({
      preferences: prefs || {
        theme: "system",
        defaultProjectId: null,
        defaultBranchId: null,
        timezone: null,
        sidebarCollapsed: false,
      },
    });
  } catch (error) {
    console.error("Failed to get preferences:", error);
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
    const { theme, accentColor, defaultProjectId, defaultBranchId, timezone, sidebarCollapsed } = body;

    // Validation
    if (theme !== undefined && !["system", "light", "dark"].includes(theme)) {
      return NextResponse.json(
        { error: "Invalid theme. Must be: system, light, or dark" },
        { status: 400 }
      );
    }

    if (accentColor !== undefined && accentColor !== null && !isValidAccentColor(accentColor)) {
      return NextResponse.json(
        { error: "Invalid accent color. Must be one of 16 predefined colors." },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .get();

    const now = new Date().toISOString();
    const updates: Record<string, string | boolean | null> = {
      updatedAt: now,
    };

    if (theme !== undefined) updates.theme = theme;
    if (accentColor !== undefined) updates.accentColor = accentColor || "blue";
    if (defaultProjectId !== undefined) updates.defaultProjectId = defaultProjectId || null;
    if (defaultBranchId !== undefined) updates.defaultBranchId = defaultBranchId || null;
    if (timezone !== undefined) updates.timezone = timezone || null;
    if (sidebarCollapsed !== undefined) updates.sidebarCollapsed = sidebarCollapsed;

    if (existing) {
      db.update(userPreferences)
        .set(updates)
        .where(eq(userPreferences.userId, user.id))
        .run();
    } else {
      db.insert(userPreferences)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          theme: theme || "system",
          accentColor: accentColor || "blue",
          defaultProjectId: defaultProjectId || null,
          defaultBranchId: defaultBranchId || null,
          timezone: timezone || null,
          sidebarCollapsed: sidebarCollapsed ?? false,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    const updated = db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .get();

    return NextResponse.json({ preferences: updated });
  } catch (error) {
    console.error("Failed to update preferences:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
