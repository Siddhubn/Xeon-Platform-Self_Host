"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useProject } from "@/lib/project-context";
import {
  Activity,
  RefreshCw,
  Search,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Database,
  GitBranch,
  Cpu,
  Users,
  Shield,
  Download,
  Upload,
  Globe,
  Eye,
  EyeOff,
  BarChart3,
  Server,
  ChevronDown,
  Filter,
  ArrowUpDown,
  Calendar,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Link as LinkIcon2,
  FileText,
  HardDrive,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityEvent {
  id: string;
  userId: string;
  organizationId: string | null;
  projectId: string | null;
  branchId: string | null;
  computeId: string | null;
  databaseName: string | null;
  roleName: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  status: string | null;
  actorName: string | null;
  details: string | null;
  ipAddress: string | null;
  operationId: string | null;
  createdAt: string;
}

interface MonitoringStats {
  totalEvents: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  inProgressCount: number;
  eventsByResourceType: Record<string, number>;
  eventsByAction: Record<string, number>;
  recentActivity: ActivityEvent[];
  eventsLast24h: number;
  eventsLast7d: number;
  uniqueActors: number;
}

interface FilterOptions {
  resourceTypes: string[];
  actions: string[];
  statuses: string[];
  actors: { id: string; name: string }[];
  databases: string[];
  roles: string[];
}

interface MonitoringData {
  activities: ActivityEvent[];
  total: number;
  hasMore: boolean;
  stats: MonitoringStats;
  filters: FilterOptions;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getResourceIcon(resourceType: string | null) {
  switch (resourceType) {
    case "branch":
      return <GitBranch className="w-3.5 h-3.5" />;
    case "compute":
      return <Cpu className="w-3.5 h-3.5" />;
    case "database":
      return <Database className="w-3.5 h-3.5" />;
    case "role":
      return <Users className="w-3.5 h-3.5" />;
    case "backup":
      return <Shield className="w-3.5 h-3.5" />;
    case "restore":
      return <RotateCcw className="w-3.5 h-3.5" />;
    case "import":
      return <Download className="w-3.5 h-3.5" />;
    case "replica":
      return <Server className="w-3.5 h-3.5" />;
    case "data_api":
      return <Globe className="w-3.5 h-3.5" />;
    case "security":
      return <Eye className="w-3.5 h-3.5" />;
    case "auth":
      return <EyeOff className="w-3.5 h-3.5" />;
    case "query":
      return <FileText className="w-3.5 h-3.5" />;
    case "connection":
      return <LinkIcon2 className="w-3.5 h-3.5" />;
    case "project":
      return <HardDrive className="w-3.5 h-3.5" />;
    case "configuration":
      return <Settings className="w-3.5 h-3.5" />;
    default:
      return <Activity className="w-3.5 h-3.5" />;
  }
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case "success":
      return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
    case "failed":
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case "warning":
      return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
    case "in_progress":
      return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
    default:
      return <CheckCircle className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />;
  }
}

function getStatusColor(status: string | null): string {
  switch (status) {
    case "success":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "failed":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "warning":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    case "in_progress":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    default:
      return "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-default)]";
  }
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getResourceTypeLabel(resourceType: string | null): string {
  switch (resourceType) {
    case "branch":
      return "Branch";
    case "compute":
      return "Compute";
    case "database":
      return "Database";
    case "role":
      return "Role";
    case "backup":
      return "Backup";
    case "restore":
      return "Restore";
    case "import":
      return "Import";
    case "replica":
      return "Read Replica";
    case "data_api":
      return "Data API";
    case "security":
      return "Security";
    case "auth":
      return "Auth";
    case "query":
      return "Query";
    case "connection":
      return "Connection";
    case "project":
      return "Project";
    case "configuration":
      return "Configuration";
    default:
      return resourceType || "Unknown";
  }
}

function groupByDate(activities: ActivityEvent[]): Map<string, ActivityEvent[]> {
  const groups = new Map<string, ActivityEvent[]>();
  const now = new Date();

  for (const activity of activities) {
    const date = new Date(activity.createdAt);
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
    );

    let label: string;
    if (diffDays === 0) label = "Today";
    else if (diffDays === 1) label = "Yesterday";
    else if (diffDays < 7) label = "This Week";
    else label = "Older";

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(activity);
  }

  return groups;
}

// ---------------------------------------------------------------------------
// FilterChip Component
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--accent-soft)] text-[var(--text-primary)] text-[11px] border border-[var(--border-default)]">
      <span className="text-[var(--text-tertiary)]">{label}:</span>
      <span className="font-medium">{value}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-[var(--text-primary)] transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard Component
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  color = "var(--neon-green)",
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-tertiary)]">
          {label}
        </p>
        <p className="text-lg font-bold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterDropdown Component
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  options,
  value,
  onChange,
  icon,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
          value
            ? "border-[var(--neon-green)]/30 bg-[var(--accent-soft)] text-[var(--text-primary)]"
            : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
        }`}
      >
        {icon}
        <span>{label}</span>
        {value && (
          <span className="text-[var(--text-tertiary)]">: {options.find((o) => o.value === value)?.label || value}</span>
        )}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-lg z-50 py-1 max-h-[250px] overflow-y-auto">
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover-strong)] transition-colors"
          >
            All {label}s
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                value === opt.value
                  ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityItem Component
// ---------------------------------------------------------------------------

function ActivityItem({ activity }: { activity: ActivityEvent }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="px-4 py-3 border-b border-[var(--border-default)] last:border-0 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getStatusIcon(activity.status)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-[var(--text-primary)]">
              {formatAction(activity.action)}
            </span>
            {activity.resourceType && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-tertiary)]">
                {getResourceIcon(activity.resourceType)}
                {getResourceTypeLabel(activity.resourceType)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {activity.resourceName && (
              <span className="text-[11px] text-[var(--text-secondary)] truncate">
                {activity.resourceName}
              </span>
            )}
            {activity.actorName && (
              <span className="text-[10px] text-[var(--text-tertiary)]">
                by {activity.actorName}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {formatTimestamp(activity.createdAt)}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            {formatTimeAgo(activity.createdAt)}
          </span>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border-default)] grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[var(--text-tertiary)]">Status: </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${getStatusColor(activity.status)}`}
            >
              {activity.status || "unknown"}
            </span>
          </div>
          {activity.projectId && (
            <div>
              <span className="text-[var(--text-tertiary)]">Project: </span>
              <span className="text-[var(--text-primary)]">{activity.projectId}</span>
            </div>
          )}
          {activity.databaseName && (
            <div>
              <span className="text-[var(--text-tertiary)]">Database: </span>
              <span className="text-[var(--text-primary)]">{activity.databaseName}</span>
            </div>
          )}
          {activity.roleName && (
            <div>
              <span className="text-[var(--text-tertiary)]">Role: </span>
              <span className="text-[var(--text-primary)]">{activity.roleName}</span>
            </div>
          )}
          {activity.computeId && (
            <div>
              <span className="text-[var(--text-tertiary)]">Compute: </span>
              <span className="text-[var(--text-primary)]">{activity.computeId}</span>
            </div>
          )}
          {activity.operationId && (
            <div>
              <span className="text-[var(--text-tertiary)]">Operation ID: </span>
              <span className="text-[var(--text-primary)] font-mono text-[10px]">
                {activity.operationId.slice(0, 8)}...
              </span>
            </div>
          )}
          {activity.details && (
            <div className="col-span-2">
              <span className="text-[var(--text-tertiary)]">Details: </span>
              <span className="text-[var(--text-primary)] font-mono text-[10px]">
                {(() => {
                  try {
                    const parsed = JSON.parse(activity.details);
                    return JSON.stringify(parsed, null, 2);
                  } catch {
                    return activity.details;
                  }
                })()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResourceBreakdown Component
// ---------------------------------------------------------------------------

function ResourceBreakdown({
  eventsByResourceType,
}: {
  eventsByResourceType: Record<string, number>;
}) {
  const entries = Object.entries(eventsByResourceType).sort(
    (a, b) => b[1] - a[1]
  );
  const max = entries.length > 0 ? entries[0][1] : 1;

  if (entries.length === 0) {
    return (
      <p className="text-[12px] text-[var(--text-tertiary)] text-center py-4">
        No activity breakdown available
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([type, count]) => (
        <div key={type} className="flex items-center gap-2">
          <div className="w-20 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] flex-shrink-0">
            {getResourceIcon(type)}
            <span className="truncate">{getResourceTypeLabel(type)}</span>
          </div>
          <div className="flex-1 h-4 bg-[var(--bg-surface)] rounded overflow-hidden">
            <div
              className="h-full rounded bg-[var(--neon-green)]/60 transition-all duration-500"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-[var(--text-tertiary)] w-8 text-right">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Monitoring Page
// ---------------------------------------------------------------------------

export default function MonitoringPage() {
  const { projectId, project, selectedBranchId, selectedBranch } = useProject();

  const [activeTab, setActiveTab] = useState<"overview" | "activity">("overview");
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterResourceType, setFilterResourceType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [filterDatabase, setFilterDatabase] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [timeRange, setTimeRange] = useState("24h");

  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("projectId", projectId);
      if (selectedBranchId) params.set("branchId", selectedBranchId);
      if (searchQuery) params.set("search", searchQuery);
      if (filterResourceType) params.set("resourceType", filterResourceType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterActor) params.set("actorId", filterActor);
      if (filterDatabase) params.set("databaseName", filterDatabase);
      if (filterRole) params.set("roleName", filterRole);

      // Time range
      const now = new Date();
      if (timeRange === "1h") {
        params.set(
          "startTime",
          new Date(now.getTime() - 60 * 60 * 1000).toISOString()
        );
      } else if (timeRange === "24h") {
        params.set(
          "startTime",
          new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
        );
      } else if (timeRange === "7d") {
        params.set(
          "startTime",
          new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        );
      } else if (timeRange === "30d") {
        params.set(
          "startTime",
          new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        );
      }

      params.set("limit", String(pageSize));
      params.set("offset", String(page * pageSize));

      const res = await fetch(`/api/projects/${projectId}/monitoring?${params}`);
      if (!res.ok) throw new Error("Failed to load monitoring data");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  }, [
    projectId,
    selectedBranchId,
    searchQuery,
    filterResourceType,
    filterStatus,
    filterActor,
    filterDatabase,
    filterRole,
    timeRange,
    page,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [
    searchQuery,
    filterResourceType,
    filterStatus,
    filterActor,
    filterDatabase,
    filterRole,
    timeRange,
    selectedBranchId,
  ]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setFilterResourceType("");
    setFilterStatus("");
    setFilterActor("");
    setFilterDatabase("");
    setFilterRole("");
    setTimeRange("24h");
  };

  const hasActiveFilters =
    searchQuery ||
    filterResourceType ||
    filterStatus ||
    filterActor ||
    filterDatabase ||
    filterRole ||
    timeRange !== "24h";

  const stats = data?.stats;
  const groupedActivities = data?.activities
    ? groupByDate(data.activities)
    : new Map();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] flex-shrink-0">
        <div>
          <h1 className="text-[16px] font-semibold text-[var(--text-primary)]">
            Monitoring
          </h1>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            {project?.name}
            {selectedBranch && (
              <> / {selectedBranch.name}</>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-default)] flex-shrink-0">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === "overview"
              ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === "activity"
              ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          Activity
          {stats && stats.totalEvents > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-[var(--bg-surface)] border border-[var(--border-default)]">
              {stats.totalEvents}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-[13px] text-[var(--text-primary)] font-medium mb-1">
              Unable to load monitoring data
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)] mb-4">
              {error}
            </p>
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-lg text-[12px] font-medium bg-[var(--accent-soft)] text-[var(--text-primary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : loading && !data ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--neon-green)]" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && stats && (
              <div className="p-4 space-y-4">
                {/* Status */}
                <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        stats.failedCount > 0
                          ? "bg-red-500"
                          : stats.warningCount > 0
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">
                      {stats.failedCount > 0
                        ? "Issues Detected"
                        : stats.warningCount > 0
                        ? "Warnings"
                        : "Healthy"}
                    </span>
                    <span className="text-[11px] text-[var(--text-tertiary)] ml-auto">
                      {selectedBranch?.name || "All branches"}
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard
                    label="Total Events"
                    value={stats.totalEvents}
                    icon={<Activity className="w-4 h-4" />}
                  />
                  <StatCard
                    label="Last 24 Hours"
                    value={stats.eventsLast24h}
                    icon={<Clock className="w-4 h-4" />}
                  />
                  <StatCard
                    label="Failed"
                    value={stats.failedCount}
                    icon={<XCircle className="w-4 h-4" />}
                    color={stats.failedCount > 0 ? "#ef4444" : undefined}
                  />
                  <StatCard
                    label="Active Actors"
                    value={stats.uniqueActors}
                    icon={<Users className="w-4 h-4" />}
                  />
                </div>

                {/* Resource Breakdown */}
                <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
                  <h3 className="text-[12px] font-semibold text-[var(--text-primary)] mb-3">
                    Activity by Resource Type
                  </h3>
                  <ResourceBreakdown
                    eventsByResourceType={stats.eventsByResourceType}
                  />
                </div>

                {/* Recent Activity */}
                <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">
                      Recent Activity
                    </h3>
                    <button
                      onClick={() => setActiveTab("activity")}
                      className="text-[11px] text-[var(--neon-green)] hover:underline"
                    >
                      View All →
                    </button>
                  </div>
                  {stats.recentActivity.length === 0 ? (
                    <p className="text-[12px] text-[var(--text-tertiary)] text-center py-4">
                      No activity yet. Events will appear here as operations
                      occur.
                    </p>
                  ) : (
                    <div>
                      {stats.recentActivity.slice(0, 5).map((activity) => (
                        <ActivityItem
                          key={activity.id}
                          activity={activity}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && (
              <div className="flex flex-col">
                {/* Filter Bar */}
                <div className="px-4 py-2.5 border-b border-[var(--border-default)] space-y-2 flex-shrink-0">
                  {/* Search + Time */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search activity..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--neon-green)]/50 outline-none transition-colors"
                      />
                    </div>
                    <FilterDropdown
                      label="Time"
                      value={timeRange}
                      onChange={setTimeRange}
                      options={[
                        { value: "1h", label: "Last hour" },
                        { value: "24h", label: "Last 24 hours" },
                        { value: "7d", label: "Last 7 days" },
                        { value: "30d", label: "Last 30 days" },
                        { value: "all", label: "All time" },
                      ]}
                      icon={<Calendar className="w-3 h-3" />}
                    />
                  </div>

                  {/* Resource Filters */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <FilterDropdown
                      label="Resource"
                      value={filterResourceType}
                      onChange={setFilterResourceType}
                      options={data?.filters.resourceTypes.map((r) => ({
                        value: r,
                        label: getResourceTypeLabel(r),
                      })) || []}
                      icon={<Filter className="w-3 h-3" />}
                    />
                    <FilterDropdown
                      label="Status"
                      value={filterStatus}
                      onChange={setFilterStatus}
                      options={[
                        { value: "success", label: "Successful" },
                        { value: "failed", label: "Failed" },
                        { value: "warning", label: "Warning" },
                        { value: "in_progress", label: "In Progress" },
                      ]}
                      icon={<ArrowUpDown className="w-3 h-3" />}
                    />
                    {data?.filters.actors && data.filters.actors.length > 0 && (
                      <FilterDropdown
                        label="Actor"
                        value={filterActor}
                        onChange={setFilterActor}
                        options={data.filters.actors.map((a) => ({
                          value: a.id,
                          label: a.name,
                        }))}
                        icon={<Users className="w-3 h-3" />}
                      />
                    )}
                    {data?.filters.databases && data.filters.databases.length > 0 && (
                      <FilterDropdown
                        label="Database"
                        value={filterDatabase}
                        onChange={setFilterDatabase}
                        options={data.filters.databases.map((d) => ({
                          value: d,
                          label: d,
                        }))}
                        icon={<Database className="w-3 h-3" />}
                      />
                    )}
                    {data?.filters.roles && data.filters.roles.length > 0 && (
                      <FilterDropdown
                        label="Role"
                        value={filterRole}
                        onChange={setFilterRole}
                        options={data.filters.roles.map((r) => ({
                          value: r,
                          label: r,
                        }))}
                        icon={<Users className="w-3 h-3" />}
                      />
                    )}
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Active Filter Chips */}
                  {hasActiveFilters && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {filterResourceType && (
                        <FilterChip
                          label="Resource"
                          value={getResourceTypeLabel(filterResourceType)}
                          onRemove={() => setFilterResourceType("")}
                        />
                      )}
                      {filterStatus && (
                        <FilterChip
                          label="Status"
                          value={filterStatus}
                          onRemove={() => setFilterStatus("")}
                        />
                      )}
                      {filterActor && (
                        <FilterChip
                          label="Actor"
                          value={
                            data?.filters.actors.find((a) => a.id === filterActor)
                              ?.name || filterActor
                          }
                          onRemove={() => setFilterActor("")}
                        />
                      )}
                      {filterDatabase && (
                        <FilterChip
                          label="Database"
                          value={filterDatabase}
                          onRemove={() => setFilterDatabase("")}
                        />
                      )}
                      {filterRole && (
                        <FilterChip
                          label="Role"
                          value={filterRole}
                          onRemove={() => setFilterRole("")}
                        />
                      )}
                      {timeRange !== "24h" && (
                        <FilterChip
                          label="Time"
                          value={
                            timeRange === "1h"
                              ? "Last hour"
                              : timeRange === "7d"
                              ? "Last 7 days"
                              : timeRange === "30d"
                              ? "Last 30 days"
                              : "All time"
                          }
                          onRemove={() => setTimeRange("24h")}
                        />
                      )}
                    </div>
                  )}

                  {/* Results count */}
                  {data && (
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      Showing {data.activities.length} of {data.total} activities
                    </p>
                  )}
                </div>

                {/* Activity List */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--neon-green)]" />
                  </div>
                ) : data?.activities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <Activity className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
                    <p className="text-[13px] text-[var(--text-primary)] font-medium mb-1">
                      No activity yet
                    </p>
                    <p className="text-[11px] text-[var(--text-tertiary)] text-center max-w-xs">
                      Activity for this {selectedBranch ? "branch" : "project"} will
                      appear here when operations and events occur.
                    </p>
                  </div>
                ) : (
                  <div>
                    {Array.from(groupedActivities.entries()).map(
                      ([dateLabel, activities]: [string, ActivityEvent[]]) => (
                        <div key={dateLabel}>
                          <div className="px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-default)]">
                            <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--text-tertiary)]">
                              {dateLabel}
                            </span>
                          </div>
                          {activities.map((activity) => (
                            <ActivityItem
                              key={activity.id}
                              activity={activity}
                            />
                          ))}
                        </div>
                      )
                    )}

                    {/* Pagination */}
                    {data && data.hasMore && (
                      <div className="px-4 py-3 text-center border-t border-[var(--border-default)]">
                        <button
                          onClick={() => setPage(page + 1)}
                          className="px-4 py-2 rounded-lg text-[11px] font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition-colors"
                        >
                          Load More
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
