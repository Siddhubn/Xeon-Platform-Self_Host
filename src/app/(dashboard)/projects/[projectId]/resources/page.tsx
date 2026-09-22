"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useProject } from "@/lib/project-context";
import {
  Server,
  GitBranch,
  Cpu,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Wrench,
  Shield,
  Activity,
  ArrowRight,
  Loader2,
  Eye,
  Trash2,
  Play,
  Square,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsistencyCheck {
  resourceType: string;
  resourceId: string;
  resourceName: string;
  status: string;
  details: string;
}

interface BranchInspection {
  branchId: string;
  branchName: string;
  timelineId: string;
  mappingExists: boolean;
  timelineExists: boolean;
}

interface EndpointInspection {
  endpointId: string;
  endpointName: string;
  state: string;
  postgresReachable: boolean;
  configurationValid: boolean;
  staleConfigDetected: boolean;
}

interface ResourceInspection {
  projectId: string;
  projectName: string;
  tenantId: string;
  tenantName: string;
  consistencyStatus: string;
  branches: BranchInspection[];
  endpoints: EndpointInspection[];
  issues: ConsistencyCheck[];
}

interface LifecycleLog {
  timestamp: string;
  operationId?: string;
  operation: string;
  stage: string;
  status: string;
  error?: string;
  endpointId?: string;
  projectId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ResourcesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { project } = useProject();

  const [inspection, setInspection] = useState<ResourceInspection | null>(null);
  const [logs, setLogs] = useState<LifecycleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const fetchInspection = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/lifecycle?action=inspect`
      );
      // Also try POST for inspect_resources
      const postRes = await fetch(`/api/projects/${projectId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "inspect_resources" }),
      });
      const data = await postRes.json();
      if (data.error) {
        setError(data.error);
      } else {
        setInspection(data.inspection);
      }
    } catch {
      setError("Failed to load resource inspection");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_logs", limit: 50 }),
      });
      const data = await res.json();
      if (data.logs) setLogs(data.logs);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    fetchInspection();
  }, [fetchInspection]);

  useEffect(() => {
    if (showLogs) fetchLogs();
  }, [showLogs, fetchLogs]);

  const runAction = async (
    action: string,
    params?: Record<string, string>
  ) => {
    setActionLoading(action);
    setActionResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...params }),
      });
      const data = await res.json();
      if (data.error) {
        setActionResult({ type: "error", message: data.error });
      } else {
        setActionResult({
          type: "success",
          message:
            data.message ||
            `${action.replace(/_/g, " ")} completed successfully`,
        });
        fetchInspection();
      }
    } catch {
      setActionResult({ type: "error", message: `Failed to run ${action}` });
    } finally {
      setActionLoading(null);
    }
  };

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
          <button
            onClick={fetchInspection}
            className="neon-btn neon-btn-secondary neon-btn-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">
            Resource Inspection
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Monitor resource health, consistency, and lifecycle state
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="neon-btn neon-btn-ghost neon-btn-sm"
          >
            <Activity className="w-4 h-4" />
            {showLogs ? "Hide Logs" : "Show Logs"}
          </button>
          <button
            onClick={fetchInspection}
            disabled={loading}
            className="neon-btn neon-btn-ghost neon-btn-sm"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin-slow" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Action Result */}
      {actionResult && (
        <div
          className={`mb-4 p-3 rounded-lg border text-[13px] flex items-center gap-2 ${actionResult.type === "success" ? "bg-[var(--success-bg)] border-[var(--success-border)] text-[var(--neon-green)]" : "bg-[var(--error-bg)] border-[var(--error-border)] text-[var(--status-error)]"}`}
        >
          {actionResult.type === "success" ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          {actionResult.message}
        </div>
      )}

      {inspection && (
        <>
          {/* Overall Status */}
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border mb-4 ${
              inspection.consistencyStatus === "healthy"
                ? "bg-[var(--success-bg)] border-[var(--success-border)]"
                : inspection.consistencyStatus === "drifted"
                  ? "bg-[var(--warning-bg)] border-[var(--warning-border)]"
                  : "bg-[var(--error-bg)] border-[var(--error-border)]"
            }`}
          >
            {inspection.consistencyStatus === "healthy" ? (
              <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />
            ) : inspection.consistencyStatus === "drifted" ? (
              <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
            ) : (
              <XCircle className="w-5 h-5 text-[var(--status-error)]" />
            )}
            <div className="flex-1">
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                Resource Consistency:{" "}
                {inspection.consistencyStatus.toUpperCase()}
              </span>
              {inspection.issues.length > 0 && (
                <span className="text-[12px] text-[var(--text-secondary)] ml-2">
                  ({inspection.issues.length} issue
                  {inspection.issues.length !== 1 ? "s" : ""} found)
                </span>
              )}
            </div>
            <button
              onClick={() => runAction("reconcile")}
              disabled={actionLoading === "reconcile"}
              className="neon-btn neon-btn-secondary neon-btn-sm"
            >
              {actionLoading === "reconcile" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Reconcile
            </button>
          </div>

          {/* Resource Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Project */}
            <div className="neon-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  Project
                </span>
              </div>
              <div className="space-y-2">
                <InfoRow label="Name" value={inspection.projectName} />
                <InfoRow label="ID" value={inspection.projectId.slice(0, 12) + "..."} mono />
                <InfoRow label="Tenant" value={inspection.tenantName} />
                <InfoRow label="Tenant ID" value={inspection.tenantId.slice(0, 12) + "..."} mono />
              </div>
            </div>

            {/* Branches */}
            <div className="neon-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="w-4 h-4 text-[var(--neon-green)]" />
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  Branches ({inspection.branches.length})
                </span>
              </div>
              <div className="space-y-2">
                {inspection.branches.map((b) => (
                  <div key={b.branchId} className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${b.mappingExists ? "bg-[var(--neon-green)]" : "bg-[var(--warning)]"}`}
                    />
                    <span className="text-[12px] text-[var(--text-primary)] font-mono">
                      {b.branchName}
                    </span>
                    {!b.mappingExists && (
                      <span className="text-[10px] text-[var(--warning)]">
                        no mapping
                      </span>
                    )}
                  </div>
                ))}
                {inspection.branches.length === 0 && (
                  <p className="text-[12px] text-[var(--text-tertiary)]">
                    No branches
                  </p>
                )}
              </div>
            </div>

            {/* Endpoints */}
            <div className="neon-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  Endpoints ({inspection.endpoints.length})
                </span>
              </div>
              <div className="space-y-2">
                {inspection.endpoints.map((ep) => (
                  <div key={ep.endpointId} className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        ep.state === "running"
                          ? "bg-[var(--neon-green)]"
                          : ep.state === "crashed"
                            ? "bg-[var(--status-error)]"
                            : "bg-[var(--text-tertiary)]"
                      }`}
                    />
                    <span className="text-[12px] text-[var(--text-primary)]">
                      {ep.endpointName}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {ep.state}
                    </span>
                    {ep.staleConfigDetected && (
                      <span className="text-[10px] text-[var(--status-error)]">
                        STALE
                      </span>
                    )}
                  </div>
                ))}
                {inspection.endpoints.length === 0 && (
                  <p className="text-[12px] text-[var(--text-tertiary)]">
                    No endpoints
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Issues */}
          {inspection.issues.length > 0 && (
            <div className="neon-card mb-6">
              <div className="px-5 py-3 border-b border-[var(--border-default)]">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
                  Issues Detected ({inspection.issues.length})
                </h3>
              </div>
              <div className="p-4 space-y-2">
                {inspection.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)]"
                  >
                    <XCircle className="w-4 h-4 text-[var(--status-error)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-[var(--text-primary)]">
                        {issue.resourceType}: {issue.resourceName}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        {issue.details}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                        issue.status === "stale_configuration"
                          ? "bg-[var(--warning-bg)] text-[var(--warning)]"
                          : issue.status === "missing"
                            ? "bg-[var(--error-bg)] text-[var(--status-error)]"
                            : "bg-[var(--bg-inset)] text-[var(--text-tertiary)]"
                      }`}
                    >
                      {issue.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Endpoint Actions */}
          {inspection.endpoints.length > 0 && (
            <div className="neon-card mb-6">
              <div className="px-5 py-3 border-b border-[var(--border-default)]">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  Endpoint Actions
                </h3>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {inspection.endpoints.map((ep) => (
                    <div
                      key={ep.endpointId}
                      className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border-default)]"
                    >
                      <span className="text-[12px] text-[var(--text-primary)]">
                        {ep.endpointName}
                      </span>
                      {ep.state === "crashed" && (
                        <button
                          onClick={() =>
                            runAction("recover_endpoint", {
                              endpointId: ep.endpointId,
                            })
                          }
                          disabled={actionLoading === "recover_endpoint"}
                          className="neon-btn neon-btn-primary neon-btn-sm text-[11px]"
                        >
                          <Wrench className="w-3 h-3" />
                          Recover
                        </button>
                      )}
                      {ep.staleConfigDetected && (
                        <button
                          onClick={() =>
                            runAction("recreate_endpoint", {
                              endpointId: ep.endpointId,
                            })
                          }
                          disabled={actionLoading === "recreate_endpoint"}
                          className="neon-btn neon-btn-secondary neon-btn-sm text-[11px]"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Recreate
                        </button>
                      )}
                      {ep.state === "running" && (
                        <button
                          onClick={() =>
                            runAction("delete_endpoint", {
                              endpointId: ep.endpointId,
                            })
                          }
                          disabled={actionLoading === "delete_endpoint"}
                          className="neon-btn neon-btn-ghost neon-btn-sm text-[11px] text-[var(--status-error)]"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lifecycle Logs */}
      {showLogs && (
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Lifecycle Logs
            </h3>
            <button
              onClick={fetchLogs}
              className="neon-btn neon-btn-ghost neon-btn-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-[12px] text-[var(--text-tertiary)] text-center py-4">
                No lifecycle logs recorded yet
              </p>
            ) : (
              <div className="space-y-1">
                {logs
                  .slice()
                  .reverse()
                  .map((log, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-[11px] font-mono py-1 border-b border-[var(--border-default)] last:border-0"
                    >
                      <span className="text-[var(--text-tertiary)] w-[140px] flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`w-[60px] flex-shrink-0 ${
                          log.status === "completed"
                            ? "text-[var(--neon-green)]"
                            : log.status === "failed"
                              ? "text-[var(--status-error)]"
                              : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="text-[var(--text-secondary)] w-[100px] flex-shrink-0">
                        {log.operation}
                      </span>
                      <span className="text-[var(--text-tertiary)]">
                        {log.stage}
                      </span>
                      {log.error && (
                        <span className="text-[var(--status-error)] ml-auto truncate max-w-[200px]">
                          {log.error}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-[var(--text-tertiary)]">{label}</span>
      <span
        className={`text-[12px] text-[var(--text-primary)] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
