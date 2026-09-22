import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session-helper";
import { cancelImportJob } from "@/lib/import-service";

/**
 * POST /api/import-data/jobs/:jobId/cancel
 * Cancel a running import job.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const success = cancelImportJob(jobId);

    if (!success) {
      return NextResponse.json(
        { error: "Import job not found or cannot be cancelled" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Import job cancelled",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to cancel import" },
      { status: 500 }
    );
  }
}
