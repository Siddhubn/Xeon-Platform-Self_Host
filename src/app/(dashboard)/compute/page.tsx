"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  RefreshCw,
  Activity,
  Clock,
  Zap,
  Database,
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  Plus,
  Copy,
  Check,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  ArrowRight,
  Copy as CopyIcon,
  Globe,
  Lock,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { ComputeSkeleton } from "@/components/Skeleton";
import {
  useProjects,
  useBranches,
} from "@/components/ProjectBranchSelector";
import CustomSelect from "@/components/CustomSelect";

interface ComputeEndpoint {
  id: string;
  name: string;
  host: string;
  port: number;
  status: "running" | "stopped" | "unknown";
  database: string;
  role: string;
  pgVersion: number;
  tenantId: string | null;
  timelineId: string | null;
  lastActive: string | null;
  connectionTest: {
    success: boolean;
    version: string | null;
    error: string | null;
  } | null;
}

interface ReadReplica {
  id: string;
  displayName: string;
  status: string;
  replicationStatus: string | null;
  replicationLagMs: number | null;
  host: string | null;
  port: number | null;
  database: string | null;
  role: string | null;
  errorMessage: string | null;
  location: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  creating: { color: "var(--status-idle)", bg: "var(--status-idle-bg)", label: "Creating" },
  starting: { color: "var(--status-idle)", bg: "var(--status-idle-bg)", label: "Starting" },
  synchronizing: { color: "var(--status-idle)", bg: "var(--status-idle-bg)", label: "Synchronizing" },
  active: { color: "var(--status-active)", bg: "var(--status-active-bg)", label: "Active" },
  degraded: { color: "var(--status-idle)", bg: "var(--status-idle-bg)", label: "Degraded" },
  unavailable: { color: "var(--status-error)", bg: "var(--status-error-bg)", label: "Unavailable" },
  stopping: { color: "var(--status-idle)", bg: "var(--status-idle-bg)", label: "Stopping" },
  stopped: { color: "var(--text-tertiary)", bg: "var(--bg-inset)", label: "Stopped" },
  failed: { color: "var(--status-error)", bg: "var(--status-error-bg)", label: "Failed" },
  deleting: { color: "var(--status-error)", bg: "var(--status-error-bg)", label: "Deleting" },
};

export default function ComputePage() {
  const { projects, loading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { branches, loading: branchesLoading } = useBranches(selectedProjectId);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [endpoints, setEndpoints] = useState<ComputeEndpoint[]>([]);
  const [replicas, setReplicas] = useState<ReadReplica[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Create replica dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [replicaName, setReplicaName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Replica details
  const [selectedReplica, setSelectedReplica] = useState<ReadReplica | null>(null);
  const [replicaConnectionString, setReplicaConnectionString] = useState("");
  const [copied, setCopied] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState("direct");
  const [testingReadOnly, setTestingReadOnly] = useState(false);
  const [readOnlyResult, setReadOnlyResult] = useState<{ readOnly: boolean; error?: string } | null>(null);

  // Delete confirmation
  const [deletingReplica, setDeletingReplica] = useState<ReadReplica | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Auto-select
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedProjectId, branches, selectedBranchId]);

  // Fetch endpoints
  const fetchEndpoints = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/computes");
      const data = await res.json();

      const endpointList: ComputeEndpoint[] = [];
      const knownEndpoints = [
        {
          id: "ep-main",
          name: "Primary Compute",
          host: process.env.NEXT_PUBLIC_POSTGRES_HOST || "127.0.0.1",
          port: parseInt(process.env.NEXT_PUBLIC_POSTGRES_PORT || "55432"),
          database: "postgres",
          role: "cloud_admin",
          pgVersion: 17,
        },
      ];

      for (const ep of knownEndpoints) {
        let status: "running" | "stopped" | "unknown" = "unknown";
        let connectionTest = null;

        try {
          const testRes = await fetch("/api/sql/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId: selectedProjectId,
              branchId: selectedBranchId || "main",
              database: ep.database,
              role: ep.role,
              sql: "SELECT version();",
            }),
          });
          const testData = await testRes.json();
          if (testData.error && !testData.rows?.length) {
            connectionTest = { success: false, version: null, error: testData.error };
            status = "stopped";
          } else {
            connectionTest = { success: true, version: testData.rows?.[0]?.version || null, error: null };
            status = "running";
          }
        } catch {
          connectionTest = { success: false, version: null, error: "Connection failed" };
          status = "stopped";
        }

        endpointList.push({ ...ep, status, tenantId: selectedProjectId, timelineId: selectedBranchId, lastActive: status === "running" ? new Date().toISOString() : null, connectionTest });
      }

      if (data.endpoints) {
        for (const ep of data.endpoints) {
          if (!endpointList.find((e) => e.host === ep.host && e.port === ep.port)) {
            endpointList.push({
              id: ep.id, name: ep.name || `compute-${ep.port}`,
              host: ep.host || "localhost", port: ep.port || 5432,
              status: "unknown", database: ep.database || "neondb",
              role: ep.role || "neondb_owner", pgVersion: ep.pgVersion || 17,
              tenantId: ep.projectId, timelineId: ep.branchId,
              lastActive: null, connectionTest: null,
            });
          }
        }
      }

      setEndpoints(endpointList);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectedBranchId]);

  // Fetch replicas
  const fetchReplicas = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const res = await fetch(`/api/replicas?projectId=${selectedProjectId}`);
      const data = await res.json();
      setReplicas(data.replicas || []);
    } catch {
      // ignore
    }
  }, [selectedProjectId]);

  useEffect(() => { fetchEndpoints(); fetchReplicas(); }, [fetchEndpoints, fetchReplicas]);

  // Test connection
  const testConnection = async (ep: ComputeEndpoint) => {
    setTesting(ep.id);
    try {
      const res = await fetch("/api/sql/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: ep.tenantId, branchId: ep.timelineId, database: ep.database, role: ep.role, sql: "SELECT version();" }),
      });
      const data = await res.json();
      setEndpoints((prev) =>
        prev.map((e) => e.id === ep.id ? { ...e, status: data.error && !data.rows?.length ? "stopped" : "running", connectionTest: { success: !data.error || !!data.rows?.length, version: data.rows?.[0]?.version || null, error: data.error || null }, lastActive: !data.error ? new Date().toISOString() : e.lastActive } : e)
      );
    } catch {
      setEndpoints((prev) => prev.map((e) => e.id === ep.id ? { ...e, status: "stopped", connectionTest: { success: false, version: null, error: "Connection failed" } } : e));
    } finally {
      setTesting(null);
    }
  };

  // Create replica
  const handleCreateReplica = async () => {
    if (!replicaName.trim() || !selectedProjectId || !selectedBranchId) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/replicas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, branchId: selectedBranchId, displayName: replicaName.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplicas((prev) => [data.replica, ...prev]);
      setShowCreateDialog(false);
      setReplicaName("");
      setSelectedReplica(data.replica);
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Get connection string
  const fetchConnectionString = async (replica: ReadReplica) => {
    try {
      const res = await fetch(`/api/replicas/${replica.id}/connection?method=${connectionMethod}`);
      const data = await res.json();
      setReplicaConnectionString(data.connectionString || "");
    } catch {
      setReplicaConnectionString("");
    }
  };

  // Test read-only
  const handleTestReadOnly = async (replica: ReadReplica) => {
    setTestingReadOnly(true);
    setReadOnlyResult(null);
    try {
      const res = await fetch(`/api/replicas/${replica.id}/test-read-only`, { method: "POST" });
      const data = await res.json();
      setReadOnlyResult(data);
    } catch (err: any) {
      setReadOnlyResult({ readOnly: false, error: err.message });
    } finally {
      setTestingReadOnly(false);
    }
  };

  // Delete replica
  const handleDeleteReplica = async () => {
    if (!deletingReplica) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/replicas/${deletingReplica.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplicas((prev) => prev.filter((r) => r.id !== deletingReplica.id));
      if (selectedReplica?.id === deletingReplica.id) setSelectedReplica(null);
      setDeletingReplica(null);
    } catch (err: any) {
      setCreateError(err.message);
      setDeletingReplica(null);
    } finally {
      setDeleting(false);
    }
  };

  // Stop/Start replica
  const handleStopReplica = async (replica: ReadReplica) => {
    await fetch(`/api/replicas/${replica.id}/stop`, { method: "POST" });
    setReplicas((prev) => prev.map((r) => r.id === replica.id ? { ...r, status: "stopped" } : r));
    if (selectedReplica?.id === replica.id) setSelectedReplica({ ...selectedReplica, status: "stopped" });
  };

  const handleStartReplica = async (replica: ReadReplica) => {
    await fetch(`/api/replicas/${replica.id}/start`, { method: "POST" });
    setReplicas((prev) => prev.map((r) => r.id === replica.id ? { ...r, status: "starting" } : r));
    setTimeout(fetchReplicas, 3000);
  };

  const handleRestartReplica = async (replica: ReadReplica) => {
    await fetch(`/api/replicas/${replica.id}/restart`, { method: "POST" });
    setReplicas((prev) => prev.map((r) => r.id === replica.id ? { ...r, status: "starting" } : r));
    setTimeout(fetchReplicas, 4000);
  };

  // Copy connection string
  const copyConnectionString = () => {
    navigator.clipboard.writeText(replicaConnectionString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Update connection string when method or selected replica changes
  useEffect(() => {
    if (selectedReplica) fetchConnectionString(selectedReplica);
  }, [selectedReplica, connectionMethod]);

  if (projectsLoading) return <ComputeSkeleton />;

  const primaryEndpoint = endpoints[0];

  return (
    <div className="animate-page-enter max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Compute Endpoints</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage compute instances and read replicas for your databases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchEndpoints(); fetchReplicas(); }} disabled={loading} className="neon-btn neon-btn-ghost">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Project/Branch Selectors */}
      {projects.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">Project</label>
            <CustomSelect
              value={selectedProjectId || ""}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(val) => { setSelectedProjectId(val); setSelectedBranchId(null); }}
              searchable className="w-[180px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">Branch</label>
            <CustomSelect
              value={selectedBranchId || ""}
              options={branches.map((b) => ({ value: b.id, label: `${b.name}${b.isPrimary ? " (main)" : ""}` }))}
              onChange={setSelectedBranchId} disabled={branchesLoading}
              searchable className="w-[180px]"
            />
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* ── Primary Compute ── */}
          {primaryEndpoint && (
            <div>
              <h2 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-3">Primary Compute</h2>
              <div className="neon-card">
                <div className="px-5 py-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${primaryEndpoint.status === "running" ? "bg-green-500/10" : primaryEndpoint.status === "stopped" ? "bg-red-500/10" : "bg-[var(--bg-inset)]"}`}>
                      <Server className={`w-5 h-5 ${primaryEndpoint.status === "running" ? "text-green-500" : primaryEndpoint.status === "stopped" ? "text-red-500" : "text-[var(--text-secondary)]"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-semibold">{primaryEndpoint.name}</p>
                        <span className={`neon-badge ${primaryEndpoint.status === "running" ? "neon-badge-green" : primaryEndpoint.status === "stopped" ? "neon-badge-red" : "neon-badge-yellow"}`}>
                          <span className={`neon-status-dot ${primaryEndpoint.status === "running" ? "neon-status-dot-active" : primaryEndpoint.status === "stopped" ? "neon-status-dot-error" : "neon-status-dot-idle"} w-1.5 h-1.5`} />
                          {primaryEndpoint.status}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--text-secondary)]">Primary</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)] font-mono mt-0.5">
                        {primaryEndpoint.host}:{primaryEndpoint.port}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => testConnection(primaryEndpoint)} disabled={testing === primaryEndpoint.id} className="neon-btn neon-btn-ghost neon-btn-sm">
                    {testing === primaryEndpoint.id ? (
                      <div className="w-3 h-3 border-2 border-[var(--neon-green)] border-t-transparent rounded-full animate-spin" />
                    ) : <RefreshCw className="w-3.5 h-3.5" />}
                    Test
                  </button>
                </div>

                <div className="px-5 py-3 border-t border-[var(--border-default)]">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                    <div>
                      <span className="text-[var(--text-tertiary)] uppercase text-[10px] font-medium">Database</span>
                      <p className="font-mono text-[var(--text-primary)]">{primaryEndpoint.database}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)] uppercase text-[10px] font-medium">Role</span>
                      <p className="font-mono text-[var(--text-primary)]">{primaryEndpoint.role}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)] uppercase text-[10px] font-medium">PG Version</span>
                      <p className="font-mono text-[var(--text-primary)]">{primaryEndpoint.pgVersion}</p>
                    </div>
                    <div>
                      <span className="text-[var(--text-tertiary)] uppercase text-[10px] font-medium">Type</span>
                      <p className="font-mono text-[var(--text-primary)]">Read / Write</p>
                    </div>
                  </div>
                </div>

                {primaryEndpoint.connectionTest && (
                  <div className={`px-5 py-3 border-t ${primaryEndpoint.connectionTest.success ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                    <div className="flex items-center gap-2 text-[12px]">
                      {primaryEndpoint.connectionTest.success ? (
                        <>
                          <CheckCircle className="w-4 h-4" style={{ color: "var(--status-active)" }} />
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>Connected</span>
                          {primaryEndpoint.connectionTest.version && (
                            <span className="text-[var(--text-secondary)] font-mono">— {primaryEndpoint.connectionTest.version}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" style={{ color: "var(--status-error)" }} />
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>Connection Failed</span>
                          <span style={{ color: "var(--text-secondary)" }}>— {primaryEndpoint.connectionTest.error}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Read Replicas ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Read Replicas</h2>
              <button onClick={() => { setShowCreateDialog(true); setReplicaName(""); setCreateError(""); }} className="neon-btn neon-btn-primary neon-btn-sm">
                <Plus className="w-3.5 h-3.5" />
                Create Read Replica
              </button>
            </div>

            {replicas.length === 0 ? (
              <div className="neon-card p-8 text-center">
                <Database className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2 opacity-50" />
                <p className="text-[13px] text-[var(--text-secondary)]">
                  No read replicas configured
                </p>
                <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                  Create a read replica to distribute read-heavy workloads
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {replicas.map((replica) => {
                  const stCfg = STATUS_CONFIG[replica.status] || STATUS_CONFIG.active;
                  return (
                    <div key={replica.id} className="neon-card">
                      <div className="px-5 py-4 flex items-start justify-between">
                        <button
                          onClick={() => setSelectedReplica(selectedReplica?.id === replica.id ? null : replica)}
                          className="flex items-center gap-3 text-left flex-1 min-w-0"
                        >
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--accent-soft)]">
                            <Database className="w-5 h-5" style={{ color: "var(--accent)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[14px] font-semibold truncate">{replica.displayName}</p>
                              <span className="neon-badge" style={{ color: stCfg.color, backgroundColor: stCfg.bg }}>
                                <span className="neon-status-dot w-1.5 h-1.5" style={{ backgroundColor: stCfg.color }} />
                                {stCfg.label}
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-inset)] text-[var(--text-tertiary)]">Read Only</span>
                            </div>
                            <p className="text-[12px] text-[var(--text-secondary)] font-mono mt-0.5">
                              {replica.host}:{replica.port} · {replica.database}
                            </p>
                            {replica.replicationStatus && (
                              <p className="text-[11px] mt-1" style={{ color: replica.replicationStatus === "healthy" ? "var(--status-active)" : "var(--status-idle)" }}>
                                Replication: {replica.replicationStatus}
                                {replica.replicationLagMs !== null && replica.replicationLagMs !== undefined && ` · ${replica.replicationLagMs}ms lag`}
                              </p>
                            )}
                          </div>
                          <ChevronRight className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform flex-shrink-0 ${selectedReplica?.id === replica.id ? "rotate-90" : ""}`} />
                        </button>
                        <div className="flex items-center gap-1 ml-3">
                          {replica.status === "active" && (
                            <button onClick={() => handleStopReplica(replica)} className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors" title="Stop">
                              <Square className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(replica.status === "stopped" || replica.status === "failed") && (
                            <button onClick={() => handleStartReplica(replica)} className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--status-active)] hover:bg-[var(--status-active-bg)] transition-colors" title="Start">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {replica.status === "active" && (
                            <button onClick={() => handleRestartReplica(replica)} className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" title="Restart">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => setDeletingReplica(replica)} className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {selectedReplica?.id === replica.id && (
                        <div className="px-5 pb-4 border-t border-[var(--border-default)] pt-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px] mb-4">
                            <div>
                              <span className="text-[var(--text-tertiary)] uppercase text-[10px] font-medium">Type</span>
                              <p className="text-[var(--text-primary)]">Read Replica</p>
                            </div>
                            <div>
                              <span className="text-[var(--text-tertiary)] uppercase text-[10px] font-medium">Mode</span>
                              <p className="text-[var(--text-primary)]">Read Only</p>
                            </div>
                            <div>
                              <span className="text-[var(--text-tertiary)] uppercase text-[10px] font-medium">Location</span>
                              <p className="text-[var(--text-primary)]">{replica.location || "Primary Infrastructure"}</p>
                            </div>
                            <div>
                              <span className="text-[var(--text-tertiary)] uppercase text-[10px] font-medium">Created</span>
                              <p className="text-[var(--text-primary)]">{new Date(replica.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>

                          {/* Connection String */}
                          <div className="mb-4">
                            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase mb-2 block">Connection String</label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-inset)] text-[12px] font-mono text-[var(--text-primary)] truncate border border-[var(--border-default)]">
                                {replicaConnectionString || "Loading..."}
                              </code>
                              <button onClick={copyConnectionString} className="neon-btn neon-btn-ghost neon-btn-sm">
                                {copied ? <Check className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-[11px] text-[var(--text-tertiary)]">Method:</span>
                              {["direct", "tailscale", "lan"].map((m) => (
                                <button key={m} onClick={() => setConnectionMethod(m)} className={`text-[11px] px-2 py-0.5 rounded ${connectionMethod === m ? "bg-[var(--accent-soft)] text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"}`}>
                                  {m}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Test Read-Only */}
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleTestReadOnly(replica)} disabled={testingReadOnly} className="neon-btn neon-btn-ghost neon-btn-sm">
                              {testingReadOnly ? <div className="w-3 h-3 border-2 border-[var(--neon-green)] border-t-transparent rounded-full animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
                              Test Read-Only
                            </button>
                            {readOnlyResult && (
                              <span className={`text-[12px] ${readOnlyResult.readOnly ? "text-[var(--status-active)]" : "text-[var(--status-error)]"}`}>
                                {readOnlyResult.readOnly ? "✓ Replica is read-only" : `✗ ${readOnlyResult.error || "Not read-only"}`}
                              </span>
                            )}
                          </div>

                          {replica.errorMessage && (
                            <div className="mt-3 p-3 rounded-lg bg-[var(--status-error-bg)] text-[12px] text-[var(--status-error)]">
                              {replica.errorMessage}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Create Replica Dialog ── */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreateDialog(false)} />
          <div className="relative bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-lg w-full max-w-md p-6 animate-dropdown-enter">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold">Create Read Replica</h2>
              <button onClick={() => setShowCreateDialog(false)} className="p-1 rounded hover:bg-[var(--bg-hover)]">
                <X className="w-4 h-4 text-[var(--text-tertiary)]" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-[var(--status-error-bg)] text-[var(--status-error)] text-[13px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-medium mb-1.5 block">Replica Name</label>
                <input
                  type="text"
                  value={replicaName}
                  onChange={(e) => setReplicaName(e.target.value)}
                  placeholder="analytics-replica"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                  A friendly name for the read replica (2-64 characters)
                </p>
              </div>

              <div>
                <label className="text-[13px] font-medium mb-1.5 block">Source</label>
                <div className="px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)]">
                  Primary Compute
                </div>
              </div>

              <div>
                <label className="text-[13px] font-medium mb-1.5 block">Location</label>
                <div className="px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-secondary)]">
                  Same location as primary (primary infrastructure)
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[var(--status-info-bg)] text-[12px] text-[var(--text-secondary)]">
                <Lock className="w-4 h-4 inline mr-1.5" />
                The read replica will be a separate compute instance with read-only access to the database. Write operations will be rejected.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setShowCreateDialog(false)} className="neon-btn neon-btn-ghost">Cancel</button>
              <button onClick={handleCreateReplica} disabled={!replicaName.trim() || creating} className="neon-btn neon-btn-primary">
                {creating ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    Create Replica
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deletingReplica && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeletingReplica(null)} />
          <div className="relative bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] shadow-lg w-full max-w-md p-6 animate-dropdown-enter">
            <h2 className="text-[16px] font-bold mb-2">Delete {deletingReplica.displayName}?</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              This will permanently remove the read replica. The primary compute and source database will not be affected.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeletingReplica(null)} className="neon-btn neon-btn-ghost">Cancel</button>
              <button onClick={handleDeleteReplica} disabled={deleting} className="neon-btn neon-btn-danger">
                {deleting ? "Deleting..." : "Delete Replica"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
