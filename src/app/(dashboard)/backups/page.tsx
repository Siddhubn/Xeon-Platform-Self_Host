"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Plus,
  X,
  Check,
  AlertCircle,
  Loader2,
  Database,
  GitBranch,
  Clock,
  HardDrive,
  FileCode,
  DatabaseZap,
  Copy,
  RotateCcw,
} from "lucide-react";
import { BackupsSkeleton } from "@/components/Skeleton";
import CustomSelect from "@/components/CustomSelect";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Backup {
  id: string;
  name: string;
  projectId: string;
  branchId: string | null;
  databaseName: string;
  type: string;
  format: string;
  status: string;
  scope: string;
  filePath: string | null;
  fileSize: number | null;
  checksum: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}

interface Project {
  id: string;
  name: string;
  branchCount: number;
}

interface Branch {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface DatabaseEntry {
  name: string;
  ownerName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
}

function statusColor(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-500/10 border-green-500/20";
    case "creating":
    case "restoring":
      return "bg-yellow-500/10 border-yellow-500/20";
    case "failed":
      return "bg-red-500/10 border-red-500/20";
    case "deleting":
      return "bg-orange-500/10 border-orange-500/20";
    default:
      return "bg-[var(--bg-surface-secondary)] border-[var(--border)]";
  }
}

function typeIcon(type: string) {
  switch (type) {
    case "full":
      return <DatabaseZap className="w-4 h-4" />;
    case "schema":
      return <FileCode className="w-4 h-4" />;
    case "data":
      return <HardDrive className="w-4 h-4" />;
    default:
      return <Shield className="w-4 h-4" />;
  }
}

// ---------------------------------------------------------------------------
// Create Backup Dialog
// ---------------------------------------------------------------------------

function CreateBackupDialog({
  open,
  onClose,
  onCreated,
  projectId,
  branchId,
  databases,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projectId: string;
  branchId: string;
  databases: DatabaseEntry[];
}) {
  const [name, setName] = useState("");
  const [databaseName, setDatabaseName] = useState(databases[0]?.name || "neondb");
  const [type, setType] = useState<"full" | "schema" | "data">("full");
  const [scope, setScope] = useState<"database" | "branch">("database");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (databases.length > 0) {
      setDatabaseName(databases[0].name);
    }
  }, [databases]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Backup name is required");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/backups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          branchId,
          databaseName,
          type,
          format: "custom",
          scope,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create backup");
        return;
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 animate-fade-in"
              style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden animate-modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--neon-green)]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[var(--neon-green)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Create Backup
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Create a backup of your database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-secondary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--status-error)" }} />
              {error}
            </div>
          )}

          {/* Backup Name */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Backup Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Before Production Release"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--neon-green)]"
              autoFocus
            />
          </div>

          {/* Database */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Database
            </label>
            <CustomSelect
              value={databaseName}
              options={databases.map((db) => ({ value: db.name, label: db.name }))}
              onChange={setDatabaseName}
              searchable
            />
          </div>

          {/* Backup Type */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Backup Type
            </label>
            <div className="space-y-2">
              {[
                {
                  value: "full",
                  label: "Full Backup",
                  desc: "Schema + Data + Indexes + Constraints",
                },
                {
                  value: "schema",
                  label: "Schema Only",
                  desc: "Database structure without data",
                },
                {
                  value: "data",
                  label: "Data Only",
                  desc: "Table records without schema",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                    type === opt.value
                      ? "bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--neon-green)]"
                      : "border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0">
                    {type === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-[var(--neon-green)]" />
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">{opt.label}</div>
                    <div className="text-[11px] opacity-60">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Backup Scope */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Backup Scope
            </label>
            <div className="space-y-2">
              {[
                {
                  value: "database",
                  label: "Selected Database",
                  desc: `Back up ${databaseName}`,
                },
                {
                  value: "branch",
                  label: "Selected Branch",
                  desc: "Back up all databases in current branch",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                    scope === opt.value
                      ? "bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--neon-green)]"
                      : "border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--text-secondary)]"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0">
                    {scope === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-[var(--neon-green)]" />
                    )}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">{opt.label}</div>
                    <div className="text-[11px] opacity-60">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-secondary)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--neon-green)] text-[var(--accent-foreground)] text-[13px] font-semibold hover:bg-[var(--neon-green-hover)] disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {creating ? "Creating..." : "Create Backup"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Restore Dialog
// ---------------------------------------------------------------------------

function RestoreDialog({
  open,
  onClose,
  onRestored,
  backup,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
  backup: Backup | null;
  projectId: string;
}) {
  const [safetyBackup, setSafetyBackup] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRestore = async () => {
    if (!backup) return;

    setRestoring(true);
    setResult(null);

    try {
      const res = await fetch(`/api/backups/${backup.id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetProjectId: projectId,
          targetDatabaseName: backup.databaseName,
          safetyBackup,
        }),
      });

      const data = await res.json();
      setResult(data);
      if (data.success) onRestored();
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    } finally {
      setRestoring(false);
    }
  };

  if (!open || !backup) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 animate-fade-in"
              style={{ background: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden animate-modal-enter">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Restore Backup
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Restore &quot;{backup.name}&quot;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-secondary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {result && (
            <div
              className={`p-3 rounded-lg text-[13px] flex items-start gap-2 ${
                result.success
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
              style={{ color: "var(--text-primary)" }}
            >
              {result.success ? (
                <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              {result.message}
            </div>
          )}

          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-yellow-400">
                  Warning
                </p>
                <p className="text-[12px] text-yellow-400/80 mt-1">
                  Restoring this backup will overwrite data in the target database
                  <strong> {backup.databaseName}</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Safety Backup */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSafetyBackup(!safetyBackup)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                safetyBackup
                  ? "bg-[var(--neon-green)] border-[var(--neon-green)]"
                  : "border-[var(--border)]"
              }`}
            >
              {safetyBackup && <Check className="w-3 h-3" style={{ color: "var(--accent-foreground)" }} />}
            </button>
            <div>
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                Create safety backup first
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Recommended — protects current data before restore
              </p>
            </div>
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
              Type RESTORE to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="RESTORE"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-surface-secondary)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={restoring || confirmText !== "RESTORE"}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-yellow-500 text-[var(--text-inverse)] text-[13px] font-semibold hover:bg-yellow-400 disabled:opacity-50"
          >
            {restoring ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            {restoring ? "Restoring..." : "Restore Backup"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BackupsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [databases, setDatabases] = useState<DatabaseEntry[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load projects
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        if (data.projects?.length > 0) {
          setSelectedProject(data.projects[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Load branches
  useEffect(() => {
    if (!selectedProject) return;
    fetch(`/api/projects/${selectedProject}/branches`)
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches || []);
        if (data.branches?.length > 0) {
          const primary = data.branches.find((b: Branch) => b.isPrimary);
          setSelectedBranch(primary?.id || data.branches[0].id);
        }
      })
      .catch(() => {});
  }, [selectedProject]);

  // Load databases
  useEffect(() => {
    if (!selectedProject || !selectedBranch) return;
    fetch(`/api/projects/${selectedProject}/databases?branchId=${selectedBranch}`)
      .then((r) => r.json())
      .then((data) => {
        setDatabases(data.databases || []);
      })
      .catch(() => {});
  }, [selectedProject, selectedBranch]);

  // Load backups
  const loadBackups = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject}/backups`);
      const data = await res.json();
      setBackups(data.backups || []);
    } catch {
      setBackups([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  // Delete backup
  const handleDelete = async (backup: Backup) => {
    setDeleting(true);
    try {
      await fetch(`/api/backups/${backup.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      loadBackups();
    } catch {
    } finally {
      setDeleting(false);
    }
  };

  // Filter backups
  const filteredBackups = backups.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.databaseName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const projectName =
    projects.find((p) => p.id === selectedProject)?.name || "—";
  const branchName =
    branches.find((b) => b.id === selectedBranch)?.name || "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Backup & Restore
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Manage database backups and restore points
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--neon-green)] text-[var(--accent-foreground)] text-[13px] font-semibold hover:bg-[var(--neon-green-hover)]"
        >
          <Plus className="w-4 h-4" />
          Create Backup
        </button>
      </div>

      {/* Project/Branch Selectors */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <Database className="w-4 h-4 text-[var(--text-secondary)]" />
          <CustomSelect
            value={selectedProject}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            onChange={setSelectedProject}
            searchable
            className="w-[220px]"
          />
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
          <GitBranch className="w-4 h-4 text-[var(--text-secondary)]" />
          <CustomSelect
            value={selectedBranch}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            onChange={setSelectedBranch}
            searchable
            className="w-[200px]"
          />
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search backups..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--neon-green)]"
        />
      </div>

      {/* Backups Table */}
      {loading ? (
        <BackupsSkeleton />
      ) : filteredBackups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="w-12 h-12 text-[var(--text-secondary)] mb-4" />
          <h3 className="text-[var(--text-primary)] font-semibold text-[15px]">
            No backups yet
          </h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1 max-w-sm">
            Create your first backup to protect your database. Backups use real
            PostgreSQL pg_dump and can be restored at any time.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--neon-green)] text-[var(--accent-foreground)] text-[13px] font-semibold hover:bg-[var(--neon-green-hover)]"
          >
            <Plus className="w-4 h-4" />
            Create Backup
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-surface-secondary)]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Backup
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Database
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Created
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Size
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredBackups.map((backup) => (
                <tr
                  key={backup.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-surface-secondary)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--neon-green)]/10 flex items-center justify-center flex-shrink-0">
                        {typeIcon(backup.type)}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium text-[var(--text-primary)]">
                          {backup.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {backup.format} format
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-[var(--text-secondary)] capitalize">
                      {backup.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-[var(--text-primary)]">
                      {backup.databaseName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-[var(--text-secondary)]">
                      {formatDate(backup.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-[var(--text-secondary)]">
                      {formatFileSize(backup.fileSize)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${statusColor(
                        backup.status
                      )}`}
                    >
                      {backup.status === "creating" && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      {backup.status === "completed" && (
                        <Check className="w-3 h-3" />
                      )}
                      {backup.status === "failed" && (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      <span className="capitalize">{backup.status}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {backup.status === "completed" && (
                        <>
                          <button
                            onClick={() => setRestoreTarget(backup)}
                            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                            title="Restore"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <a
                            href={`/api/backups/${backup.id}/download`}
                            className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10 transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </>
                      )}
                      <button
                        onClick={() => setDeleteTarget(backup)}
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Backup Dialog */}
      <CreateBackupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={loadBackups}
        projectId={selectedProject}
        branchId={selectedBranch}
        databases={databases}
      />

      {/* Restore Dialog */}
      <RestoreDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onRestored={loadBackups}
        backup={restoreTarget}
        projectId={selectedProject}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 animate-fade-in"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-md bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-2xl p-6 animate-modal-enter">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Delete Backup?
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)] mb-1">
              This backup will be permanently deleted.
            </p>
            <p className="text-[13px] text-[var(--text-primary)] font-medium mb-4">
              &quot;{deleteTarget.name}&quot;
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] mb-4">
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-[var(--text-inverse)] text-[13px] font-semibold hover:bg-red-400 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Delete Backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
