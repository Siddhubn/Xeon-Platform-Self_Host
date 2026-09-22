import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { NotificationService } from "@/lib/notification-service";

// PATCH /api/notifications/[notificationId]/read
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { notificationId } = await params;
    const success = NotificationService.markAsRead(notificationId, user.id);

    if (!success) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
