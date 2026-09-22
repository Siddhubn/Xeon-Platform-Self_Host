"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProject } from "@/lib/project-context";
import {
  Database,
  GitBranch,
  Cpu,
  HardDrive,
  Shield,
  Globe,
  Clock,
  Activity,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  BarChart3,
  Server,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  project: { id: string; name: string; createdAt: string };
  health: "healthy" | "warning" | "degraded";
  summary: {
    branches: number;
    databases: number;
    computes: number;
    replicas: number;
    backups: number;
  };
  branches: Array<{ id: string; name: string; isPrimary: boolean }>;
  computes: Array<{ id: string; name: string; host: string; port: number; database: string }>;
  databases: Array<{ id: string; name: string }>;
  replicas: Array<{ id: string; displayName: string; status: string; replicationStatus: string | null }>;
  recentActivity: Array<{
    type: string;
    title: string;
    resource?: string;
    status: string;
    timestamp: string;
  }>;
  activeOperations: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
  dataApiEnabled: boolean;
  lastBackup: { name: string; status: string; createdAt: string } | null;
  activeImports: Array<{
    id: string;
    databaseName: string;
    status: string;
    tablesCompleted: number;
    tablesTotal: number;
  }>;
}

interface MonitoringStats {
  totalEvents: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  inProgressCount: number;
  eventsByResourceType: Record<string, number>;
  eventsByAction: Record<string, number>;
  eventsLast24h: number;
  eventsLast7d: number;
  uniqueActors: number;
  recentActivity: Array<{ id: number; action: string; status: string | null; resourceName: string | null; resourceType: string | null; actorName: string | null; createdAt: string | null }>;
}

interface MonitoringActivity {
  id: number;
  userId: string | null;
  projectId: string | null;
  branchId: string | null;
  computeId: string | null;
  databaseName: string | null;
  roleName: string | null;
  action: string;
  details: string | null;
  status: string | null;
  actorName: string | null;
  operationId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  createdAt: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { project } = useProject();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [monitoringStats, setMonitoringStats] = useState<MonitoringStats | null>(null);
  const [monitoringActivity, setMonitoringActivity] = useState<MonitoringActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/dashboard`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setDashboard(data);
      }
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchMonitoringSummary = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/monitoring?limit=5`);
      const data = await res.json();
      if (data.stats) setMonitoringStats(data.stats);
      if (data.activities) setMonitoringActivity(data.activities);
    } catch {
      // Monitoring is best-effort on dashboard
    }
  }, [projectId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (dashboard) fetchMonitoringSummary();
  }, [dashboard, fetchMonitoringSummary]);

  // Auto-refresh for active operations
  useEffect(() => {
    if (!dashboard?.activeOperations?.length && !dashboard?.activeImports?.length) return;
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, [dashboard?.activeOperations?.length, dashboard?.activeImports?.length, fetchDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-[var(--neon-green)] border-t-transparent rounded-full animate-spin-slow" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-page-enter px-4 py-3">
        <div className="neon-card p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-[var(--status-error)] mx-auto mb-3" />
          <p className="text-[14px] text-[var(--status-error)] mb-4">{error}</p>
          <button onClick={fetchDashboard} className="neon-btn neon-btn-secondary neon-btn-sm">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const p = `/projects/${projectId}`;

  return (
    <div className="animate-page-enter px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">
            {project?.name || dashboard.project.name}
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Overview of your project
          </p>
        </div>
        <button onClick={fetchDashboard} className="neon-btn neon-btn-ghost neon-btn-sm">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Health Status */}
      <div
        className={`flex items-center gap-3 p-4 rounded-xl border mb-4 ${
          dashboard.health === "healthy"
            ? "bg-[var(--success-bg)] border-[var(--success-border)]"
            : dashboard.health === "warning"
            ? "bg-[var(--warning-bg)] border-[var(--warning-border)]"
            : "bg-[var(--error-bg)] border-[var(--error-border)]"
        }`}
      >
        {dashboard.health === "healthy" ? (
          <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />
        ) : dashboard.health === "warning" ? (
          <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
        ) : (
          <XCircle className="w-5 h-5 text-[var(--status-error)]" />
        )}
        <span className="text-[14px] font-semibold text-[var(--text-primary)]">
          {dashboard.health === "healthy"
            ? "Project is healthy"
            : dashboard.health === "warning"
            ? "Project has warnings"
            : "Project is degraded"}
        </span>
      </div>

      {/* Resource Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <SummaryCard
          icon={GitBranch}
          label="Branches"
          count={dashboard.summary.branches}
          href={`${p}/branches`}
        />
        <SummaryCard
          icon={HardDrive}
          label="Databases"
          count={dashboard.summary.databases}
          href={`${p}/databases`}
        />
        <SummaryCard
          icon={Cpu}
          label="Computes"
          count={dashboard.summary.computes}
          href={`${p}/compute`}
        />
        <SummaryCard
          icon={Server}
          label="Read Replicas"
          count={dashboard.summary.replicas}
          href={`${p}/compute`}
        />
        <SummaryCard
          icon={Shield}
          label="Backups"
          count={dashboard.summary.backups}
          href={`${p}/backups`}
        />
      </div>

      {/* Active Operations */}
      {(dashboard.activeOperations.length > 0 || dashboard.activeImports.length > 0) && (
        <div className="mb-8">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">
            Active Operations
          </h2>
          <div className="space-y-2">
            {dashboard.activeImports.map((imp) => (
              <div
                key={imp.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)]"
              >
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                <div className="flex-1">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">
                    Importing Data
                  </span>
                  <span className="text-[12px] text-[var(--text-secondary)] ml-2">
                    {imp.databaseName}
                  </span>
                </div>
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {imp.tablesCompleted}/{imp.tablesTotal} tables
                </span>
              </div>
            ))}
            {dashboard.activeOperations.map((op) => (
              <div
                key={op.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)]"
              >
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                <span className="text-[13px] font-medium text-[var(--text-primary)]">
                  {op.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
                <span className="ml-auto text-[12px] text-[var(--text-secondary)]">
                  {timeAgo(op.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Branches */}
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Branches
            </h3>
            <button
              onClick={() => router.push(`${p}/branches`)}
              className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4">
            {dashboard.branches.length === 0 ? (
              <EmptyState
                icon={GitBranch}
                message="No branches"
                action={{ label: "Create Branch", href: `${p}/branches` }}
              />
            ) : (
              <div className="space-y-2">
                {dashboard.branches.slice(0, 5).map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <GitBranch className="w-4 h-4 text-[var(--neon-green)]" />
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">
                      {branch.name}
                    </span>
                    {branch.isPrimary && (
                      <span className="neon-badge neon-badge-green text-[10px]">primary</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Computes */}
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Computes
            </h3>
            <button
              onClick={() => router.push(`${p}/compute`)}
              className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4">
            {dashboard.computes.length === 0 ? (
              <EmptyState
                icon={Cpu}
                message="No computes"
                action={{ label: "View Compute", href: `${p}/compute` }}
              />
            ) : (
              <div className="space-y-2">
                {dashboard.computes.map((compute) => (
                  <div
                    key={compute.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-[var(--neon-green)]" />
                    <div className="flex-1">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">
                        {compute.name}
                      </span>
                      <p className="text-[11px] text-[var(--text-tertiary)] font-mono">
                        {compute.host}:{compute.port} · {compute.database}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Read Replicas */}
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Read Replicas
            </h3>
            <button
              onClick={() => router.push(`${p}/compute`)}
              className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4">
            {dashboard.replicas.length === 0 ? (
              <EmptyState
                icon={Server}
                message="No read replicas"
                action={{ label: "Create Replica", href: `${p}/compute` }}
              />
            ) : (
              <div className="space-y-2">
                {dashboard.replicas.map((replica) => (
                  <div
                    key={replica.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        replica.status === "active"
                          ? "bg-[var(--neon-green)]"
                          : "bg-[var(--warning)]"
                      }`}
                    />
                    <div className="flex-1">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">
                        {replica.displayName}
                      </span>
                      <p className="text-[11px] text-[var(--text-tertiary)] capitalize">
                        {replica.replicationStatus || replica.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Monitoring Summary */}
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--accent)]" />
              Monitoring
            </h3>
            <button
              onClick={() => router.push(`${p}/monitoring`)}
              className="text-[12px] text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              View Monitoring <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4">
            {monitoringStats ? (
              <>
                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <div>
                      <p className="text-[12px] text-[var(--text-tertiary)]">Total Events</p>
                      <p className="text-[16px] font-bold text-[var(--text-primary)]">{monitoringStats.totalEvents}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                    <div>
                      <p className="text-[12px] text-[var(--text-tertiary)]">Successful</p>
                      <p className="text-[16px] font-bold text-[var(--text-primary)]">{monitoringStats.successCount}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <XCircle className="w-3.5 h-3.5 text-[var(--status-error)]" />
                    <div>
                      <p className="text-[12px] text-[var(--text-tertiary)]">Failed</p>
                      <p className="text-[16px] font-bold text-[var(--text-primary)]">{monitoringStats.failedCount}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                    <Clock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <div>
                      <p className="text-[12px] text-[var(--text-tertiary)]">Last 24h</p>
                      <p className="text-[16px] font-bold text-[var(--text-primary)]">{monitoringStats.eventsLast24h}</p>
                    </div>
                  </div>
                </div>

                {/* Resource Breakdown */}
                {monitoringStats.eventsByResourceType && Object.keys(monitoringStats.eventsByResourceType).length > 0 && (
                  <div className="mb-4">
                    <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Activity by Resource</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(monitoringStats.eventsByResourceType)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([type, count]) => (
                          <span key={type} className="neon-badge text-[10px]">
                            {type.replace(/_/g, " ")} · {count}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                <span className="text-[12px] text-[var(--text-tertiary)]">Loading monitoring data…</span>
              </div>
            )}

            {/* Recent Activity from Monitoring API */}
            {monitoringActivity.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Recent Activity</p>
                <div className="space-y-1.5">
                  {monitoringActivity.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-2 p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <MonitoringActivityIcon action={activity.action} status={activity.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[var(--text-primary)] truncate">
                          {formatAction(activity.action)}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                          {activity.resourceName || activity.resourceType || activity.actorName || "—"}
                        </p>
                      </div>
                      <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
                        {activity.createdAt ? timeAgo(activity.createdAt) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="neon-card mb-8">
        <div className="px-5 py-3 border-b border-[var(--border-default)]">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
            Quick Actions
          </h3>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          <QuickAction
            icon={GitBranch}
            label="New Branch"
            href={`${p}/branches`}
          />
          <QuickAction
            icon={HardDrive}
            label="SQL Editor"
            href={`${p}/sql-editor`}
          />
          <QuickAction
            icon={Server}
            label="Create Replica"
            href={`${p}/compute`}
          />
          <QuickAction
            icon={Download}
            label="Import Data"
            href={`${p}/import-data`}
          />
          <QuickAction
            icon={Shield}
            label="Create Backup"
            href={`${p}/backups`}
          />
          <QuickAction
            icon={Globe}
            label="Data API"
            href={`${p}/data-api`}
          />
        </div>
      </div>

      {/* Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Data API Status */}
        <div className="neon-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[13px] font-medium text-[var(--text-primary)]">
              Data API
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                dashboard.dataApiEnabled ? "bg-[var(--neon-green)]" : "bg-[var(--text-tertiary)]"
              }`}
            />
            <span className="text-[12px] text-[var(--text-secondary)]">
              {dashboard.dataApiEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        {/* Last Backup */}
        <div className="neon-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[13px] font-medium text-[var(--text-primary)]">
              Last Backup
            </span>
          </div>
          {dashboard.lastBackup ? (
            <div>
              <span className="text-[12px] text-[var(--text-secondary)]">
                {dashboard.lastBackup.status === "completed" ? "✓" : "✗"}{" "}
                {timeAgo(dashboard.lastBackup.createdAt)}
              </span>
            </div>
          ) : (
            <span className="text-[12px] text-[var(--text-tertiary)]">No backups</span>
          )}
        </div>

        {/* Connection */}
        <div className="neon-card p-4">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[13px] font-medium text-[var(--text-primary)]">
              Databases
            </span>
          </div>
          <span className="text-[12px] text-[var(--text-secondary)]">
            {dashboard.databases.length} database{dashboard.databases.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  icon: Icon,
  label,
  count,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  href: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="neon-card p-4 text-left hover:bg-[var(--bg-hover)] transition-all group cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-[var(--neon-green)]" />
        <span className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-[24px] font-bold text-[var(--text-primary)]">{count}</p>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  action?: { label: string; href: string };
}) {
  const router = useRouter();
  return (
    <div className="text-center py-6">
      <Icon className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
      <p className="text-[13px] text-[var(--text-secondary)] mb-3">{message}</p>
      {action && (
        <button
          onClick={() => router.push(action.href)}
          className="neon-btn neon-btn-secondary neon-btn-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function ActivityIcon({ type, status }: { type: string; status: string }) {
  if (status === "failed") {
    return <XCircle className="w-4 h-4 text-[var(--status-error)]" />;
  }
  if (status === "completed") {
    return <CheckCircle2 className="w-4 h-4 text-[var(--neon-green)]" />;
  }
  if (status === "running" || status === "pending") {
    return <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />;
  }

  switch (type) {
    case "backup":
      return <Shield className="w-4 h-4 text-[var(--text-secondary)]" />;
    case "import":
      return <Download className="w-4 h-4 text-[var(--text-secondary)]" />;
    default:
      return <Activity className="w-4 h-4 text-[var(--text-secondary)]" />;
  }
}

function QuickAction({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
    >
      <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
      {label}
    </button>
  );
}

function MonitoringActivityIcon({ action, status }: { action: string; status: string | null }) {
  if (status === "failed") return <XCircle className="w-3.5 h-3.5 text-[var(--status-error)]" />;
  if (status === "success" || status === "completed") return <CheckCircle2 className="w-3.5 h-3.5 text-[var(--neon-green)]" />;
  if (status === "running" || status === "in_progress") return <Loader2 className="w-3.5 h-3.5 text-[var(--accent)] animate-spin" />;

  if (action.includes("COMPUTE") || action.includes("REPLICA")) return <Cpu className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
  if (action.includes("DATABASE")) return <Database className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
  if (action.includes("BRANCH")) return <GitBranch className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
  if (action.includes("BACKUP") || action.includes("RESTORE")) return <Shield className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
  if (action.includes("ROLE") || action.includes("PERMISSION")) return <Shield className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
  if (action.includes("IMPORT")) return <Download className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
  return <Activity className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
