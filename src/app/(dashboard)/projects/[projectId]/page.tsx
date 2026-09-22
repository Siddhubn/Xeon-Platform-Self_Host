"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Database,
  GitBranch,
  Server,
  Settings,
  Copy,
  Check,
  Activity,
  HardDrive,
  ArrowLeft,
  RefreshCw,
  Trash2,
  AlertTriangle,
  X,
  Link2,
  Cpu,
  Shield,
  Plus,
} from "lucide-react";

interface ProjectDetail {
  id: string;
  name: string;
  internalTenantId: string;
  createdAt: string;
  defaultBranchId: string | null;
  branchCount: number;
  primaryTimelineId: string | null;
  pgVersion: number | null;
  timelineCount: number;
  shardCount: number;
  physicalSize: number | null;
  policy: unknown;
  stripeSize: number;
}

interface Branch {
  id: string;
  name: string;
  isPrimary: boolean;
  pgVersion: number;
  state: string;
  lastRecordLsn: string | null;
  internalTimelineId: string;
}

const tabConfig = [
  { id: "dashboard", label: "Dashboard", icon: Database },
  { id: "branches", label: "Branches", icon: GitBranch },
  { id: "databases", label: "Databases", icon: HardDrive },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "compute", label: "Compute", icon: Cpu },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [copied, setCopied] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setProject(data.project);
        setBranches(data.branches || []);
      }
    } catch {
      setError("Failed to fetch project details");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.error) router.push("/projects");
      else setError(data.error);
    } catch {
      setError("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (id: string) =>
    id && id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id || "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-2 border-[var(--neon-green)] border-t-transparent rounded-full animate-spin-slow" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="animate-page-enter">
        <button
          onClick={() => router.push("/projects")}
          className="neon-btn neon-btn-ghost neon-btn-sm mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Projects
        </button>
        <div className="neon-card p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-[var(--status-error)] mx-auto mb-3" />
          <p className="text-[14px] text-[var(--status-error)]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter">
      {/* ── Back + Header ── */}
      <button
        onClick={() => router.push("/projects")}
        className="neon-btn neon-btn-ghost neon-btn-sm mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Projects
      </button>

      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--neon-green-bg)] flex items-center justify-center">
            <Database className="w-6 h-6 text-[var(--neon-green)]" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[var(--text-primary)] flex items-center gap-2">
              {project?.name || "Project"}
              <code className="font-mono text-[14px] text-[var(--text-secondary)] font-normal">
                {fmt(projectId)}
              </code>
            </h1>
            <p className="text-[12px] text-[var(--text-tertiary)] font-mono mt-0.5">
              {projectId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchProject} className="neon-btn neon-btn-secondary neon-btn-sm">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="neon-btn neon-btn-ghost neon-btn-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="neon-tabs mb-5">
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`neon-tab ${activeTab === tab.id ? "neon-tab-active" : ""}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════ DASHBOARD TAB ═══════════ */}
      {activeTab === "dashboard" && project && (
        <div className="space-y-5 animate-card-enter">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
            <div className="neon-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <GitBranch className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                <span className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Branches
                </span>
              </div>
              <p className="text-[24px] font-bold text-[var(--text-primary)]">
                {project.timelineCount}
              </p>
            </div>
            <div className="neon-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <Server className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                <span className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  PG Version
                </span>
              </div>
              <p className="text-[24px] font-bold text-[var(--text-primary)]">
                {project.pgVersion || "—"}
              </p>
            </div>
            <div className="neon-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <HardDrive className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                <span className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Shards
                </span>
              </div>
              <p className="text-[24px] font-bold text-[var(--text-primary)]">
                {project.shardCount}
              </p>
            </div>
            <div className="neon-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                <span className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Policy
                </span>
              </div>
              <p className="text-[24px] font-bold text-[var(--text-primary)] capitalize">
                {JSON.stringify(project.policy).replace(/"/g, "")}
              </p>
            </div>
          </div>

          {/* Connection Details */}
          <div className="neon-card">
            <div className="px-5 py-3 border-b border-[var(--border-default)]">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                Connection Details
              </h3>
            </div>
            <div className="p-5 space-y-3.5">
              <CopyField label="Project ID" value={project.id} copied={copied} onCopy={copyToClipboard} />
              <CopyField label="Tenant ID" value={project.internalTenantId} copied={copied} onCopy={copyToClipboard} />
              {project.primaryTimelineId && (
                <CopyField label="Primary Timeline" value={project.primaryTimelineId} copied={copied} onCopy={copyToClipboard} />
              )}
            </div>
          </div>

          {/* Branches Table */}
          {branches.length > 0 && (
            <div className="neon-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
                  Branches
                </h3>
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {branches.length} branch{branches.length !== 1 ? "es" : ""}
                </span>
              </div>
              <table className="neon-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>PG Version</th>
                    <th>Status</th>
                    <th>Last LSN</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b, i) => (
                    <tr key={b.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-md bg-[var(--neon-green-bg)] flex items-center justify-center">
                            <GitBranch className="w-3.5 h-3.5 text-[var(--neon-green)]" />
                          </div>
                          <div>
                            <p className="text-[13px] font-medium font-mono">
                              {b.name}
                            </p>
                            {b.isPrimary && (
                              <span className="neon-badge neon-badge-green mt-0.5">
                                main
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="neon-badge neon-badge-blue">
                          PG {b.pgVersion}
                        </span>
                      </td>
                      <td>
                        <StatusBadge state={b.state} />
                      </td>
                      <td className="font-mono text-[12px] text-[var(--text-secondary)]">
                        {b.lastRecordLsn || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ BRANCHES TAB ═══════════ */}
      {activeTab === "branches" && (
        <div className="animate-card-enter">
          <Link
            href="/branches"
            className="neon-btn neon-btn-secondary neon-btn-sm mb-4"
          >
            Manage Branches →
          </Link>
          {branches.length === 0 ? (
            <div className="neon-card p-16 text-center">
              <GitBranch className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-[14px] text-[var(--text-secondary)]">
                No branches found.
              </p>
            </div>
          ) : (
            <div className="neon-card overflow-hidden">
              <table className="neon-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>PG Version</th>
                    <th>Status</th>
                    <th>Last LSN</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px]">{b.name}</span>
                          {b.isPrimary && (
                            <span className="neon-badge neon-badge-green">main</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="neon-badge neon-badge-blue">PG {b.pgVersion}</span>
                      </td>
                      <td><StatusBadge state={b.state} /></td>
                      <td className="font-mono text-[12px] text-[var(--text-secondary)]">
                        {b.lastRecordLsn || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ DATABASES TAB ═══════════ */}
      {activeTab === "databases" && (
        <div className="animate-card-enter">
          <Link
            href="/databases"
            className="neon-btn neon-btn-secondary neon-btn-sm mb-4"
          >
            Manage Databases →
          </Link>
          <div className="neon-card p-16 text-center">
            <Database className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-[14px] text-[var(--text-secondary)]">
              Go to the Databases page to manage PostgreSQL databases for this project.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════ ROLES TAB ═══════════ */}
      {activeTab === "roles" && (
        <div className="animate-card-enter">
          <Link
            href="/roles"
            className="neon-btn neon-btn-secondary neon-btn-sm mb-4"
          >
            Manage Roles →
          </Link>
          <div className="neon-card p-16 text-center">
            <Shield className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-[14px] text-[var(--text-secondary)]">
              Go to the Roles page to manage PostgreSQL roles for this project.
            </p>
          </div>
        </div>
      )}

      {/* ═══════════ COMPUTE TAB ═══════════ */}
      {activeTab === "compute" && (
        <div className="animate-card-enter space-y-5">
          <div className="neon-card">
            <div className="px-5 py-3 border-b border-[var(--border-default)]">
              <h3 className="text-[14px] font-semibold">Database Servers</h3>
            </div>
            <div className="p-5">
              <p className="text-[13px] text-[var(--text-secondary)]">
                Compute endpoints are managed through the Storage Controller. Connect to your project using the connection details above.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ SETTINGS TAB ═══════════ */}
      {activeTab === "settings" && (
        <div className="animate-card-enter space-y-5">
          <div className="neon-card">
            <div className="px-5 py-3 border-b border-[var(--border-default)]">
              <h3 className="text-[14px] font-semibold">General</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Project ID
                </label>
                <input
                  type="text"
                  value={projectId}
                  readOnly
                  className="neon-input font-mono text-[12px] bg-[var(--bg-inset)] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Internal Tenant ID
                </label>
                <input
                  type="text"
                  value={project?.internalTenantId || ""}
                  readOnly
                  className="neon-input font-mono text-[12px] bg-[var(--bg-inset)] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                  Region
                </label>
                <input
                  type="text"
                  value="self-hosted"
                  readOnly
                  className="neon-input font-mono text-[12px] bg-[var(--bg-inset)] cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="neon-card border-[var(--status-error)]">
            <div className="px-5 py-3 border-b border-[var(--status-error)] bg-[var(--status-error-bg)]">
              <h3 className="text-[14px] font-semibold text-[var(--status-error)]">
                Danger Zone
              </h3>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium">Delete Project</p>
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    Permanently delete this project and all its data.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="neon-btn neon-btn-danger neon-btn-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteConfirm && (
        <div className="neon-modal-overlay" onClick={() => setDeleteConfirm(false)}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--status-error-bg)] flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[var(--status-error)]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold">Delete Project</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)]">This action is irreversible</p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mb-6">
                All branches, databases, roles, and data will be permanently removed.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm(false)} className="neon-btn neon-btn-secondary">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting} className="neon-btn neon-btn-danger">
                  {deleting ? "Deleting..." : "Delete Project"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function CopyField({
  label, value, copied, onCopy,
}: {
  label: string; value: string; copied: string;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-[var(--text-secondary)] w-32 flex-shrink-0">{label}</span>
      <div className="flex-1 neon-connection-string text-[12px]">
        <code className="flex-1 break-all whitespace-pre-wrap">{value}</code>
        <button
          onClick={() => onCopy(value, label)}
          className="flex-shrink-0 p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
        >
          {copied === label ? (
            <Check className="w-3 h-3 text-[var(--status-active)]" />
          ) : (
            <Copy className="w-3 h-3 text-[var(--text-tertiary)]" />
          )}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const s = typeof state === "string" ? state : "Active";
  const map: Record<string, { badge: string; dot: string }> = {
    Active: { badge: "neon-badge-green", dot: "neon-status-dot-active" },
    Loading: { badge: "neon-badge-yellow", dot: "neon-status-dot-idle" },
    Stopping: { badge: "neon-badge-yellow", dot: "neon-status-dot-idle" },
  };
  const { badge, dot } = map[s] || map.Active;
  return (
    <span className={`neon-badge ${badge}`}>
      <span className={`neon-status-dot ${dot} w-1.5 h-1.5`} />
      {s}
    </span>
  );
}
