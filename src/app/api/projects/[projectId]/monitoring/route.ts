import { NextRequest, NextResponse } from "next/server";
import {
  queryActivities,
  getMonitoringStats,
  getFilterOptions,
} from "@/lib/activity-service";

/**
 * GET /api/projects/:projectId/monitoring?branchId=&...
 *
 * Returns activity listing, stats, and filter options for monitoring.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);

    const branchId = searchParams.get("branchId") || undefined;
    const computeId = searchParams.get("computeId") || undefined;
    const databaseName = searchParams.get("databaseName") || undefined;
    const roleName = searchParams.get("roleName") || undefined;
    const resourceType = searchParams.get("resourceType") || undefined;
    const action = searchParams.get("action") || undefined;
    const status = searchParams.get("status") || undefined;
    const actorId = searchParams.get("actorId") || undefined;
    const search = searchParams.get("search") || undefined;
    const startTime = searchParams.get("startTime") || undefined;
    const endTime = searchParams.get("endTime") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const section = searchParams.get("section") || "all";

    if (section === "stats") {
      const stats = getMonitoringStats(projectId, branchId);
      return NextResponse.json({ stats });
    }

    if (section === "filters") {
      const filters = getFilterOptions(projectId, branchId);
      return NextResponse.json({ filters });
    }

    // Default: return activity listing + stats + filters
    const result = queryActivities({
      projectId,
      branchId,
      computeId,
      databaseName,
      roleName,
      resourceType,
      action,
      status,
      actorId,
      search,
      startTime,
      endTime,
      limit,
      offset,
    });

    const stats = getMonitoringStats(projectId, branchId);
    const filters = getFilterOptions(projectId, branchId);

    return NextResponse.json({
      activities: result.activities,
      total: result.total,
      hasMore: result.hasMore,
      stats,
      filters,
    });
  } catch (error: any) {
    console.error("Error fetching monitoring data:", error);
    return NextResponse.json(
      { error: "Failed to fetch monitoring data", details: error.message },
      { status: 500 }
    );
  }
}
