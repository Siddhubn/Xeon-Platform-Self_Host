"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import CreateBranchDialog from "@/components/CreateBranchDialog";
import { useProject } from "@/lib/project-context";
import { BranchesSkeleton } from "@/components/Skeleton";

interface Branch {
  id: string;
  name: string;
  isPrimary: boolean;
  parentBranchId: string | null;
  pgVersion: number;
  state: string;
  lastRecordLsn: string | null;
  createdAt: string;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const { projectId, refreshBranches } = useProject();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingBranchId, setRenamingBranchId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renamingLoading, setRenamingLoading] = useState(false);
  const [renameError, setRenameError] = useState("");

  const fetchBranches = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/branches`);
      const data = await res.json();
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleDelete = async (branch: Branch) => {
    if (!projectId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/branches/${branch.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setDeleteConfirm(null);
        fetchBranches();
        refreshBranches();
      }
    } catch {
      alert("Failed to delete branch");
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async (branch: Branch) => {
    if (!projectId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenameError("Branch name cannot be empty");
      return;
    }
    if (trimmed.length > 63) {
      setRenameError("Branch name cannot exceed 63 characters");
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_\-. ]*$/.test(trimmed)) {
      setRenameError("Branch name can only contain letters, numbers, hyphens, underscores, dots, and spaces");
      return;
    }
    if (trimmed === branch.name) {
      setRenamingBranchId(null);
      return;
    }

    setRenamingLoading(true);
    setRenameError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/branches/${branch.id}/rename`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        }
      );
      const data = await res.json();
      if (data.error) {
        setRenameError(data.error);
      } else {
        setRenamingBranchId(null);
        setRenameError("");
        fetchBranches();
        refreshBranches();
      }
    } catch {
      setRenameError("Failed to rename branch");
    } finally {
      setRenamingLoading(false);
    }
  };

  return (
    <div className="animate-page-enter px-4 py-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Branches</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage database branches with copy-on-write cloning
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchBranches}
            disabled={loading}
            className="neon-btn neon-btn-ghost neon-btn-sm"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin-slow" : ""}`}
            />
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            disabled={!projectId}
            className="neon-btn neon-btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Branch
          </button>
        </div>
      </div>



      {/* Branches table */}
      {loading ? (
        <div className="neon-card overflow-hidden mt-4">
          <BranchesSkeleton inline />
        </div>
      ) : (
      <div className="neon-card overflow-hidden mt-4">
        <table className="neon-table">
          <thead>
            <tr>
              <th>BRANCH</th>
              <th>STATUS</th>
              <th>PG VERSION</th>
              <th>LAST LSN</th>
              <th>CREATED</th>
              <th className="w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="stagger-children">
            {branches.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <GitBranch className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {projectId
                      ? "No branches found. Create one to get started."
                      : "No project selected."}
                  </p>
                </td>
              </tr>
            ) : (
              branches.map((branch) => (
                <tr key={branch.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center ${
                          branch.isPrimary
                            ? "bg-[var(--neon-green-bg)]"
                            : "bg-[var(--bg-inset)]"
                        }`}
                      >
                        <GitBranch
                          className={`w-3.5 h-3.5 ${
                            branch.isPrimary
                              ? "text-[var(--neon-green)]"
                              : "text-[var(--text-secondary)]"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        {renamingBranchId === branch.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => {
                                setRenameValue(e.target.value);
                                setRenameError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRename(branch);
                                if (e.key === "Escape") {
                                  setRenamingBranchId(null);
                                  setRenameError("");
                                }
                              }}
                              className="neon-input text-[13px] font-mono py-1 px-2 flex-1"
                              autoFocus
                              disabled={renamingLoading}
                            />
                            <button
                              onClick={() => handleRename(branch)}
                              className="p-1 rounded text-[var(--neon-green)] hover:bg-[var(--neon-green-bg)]"
                              disabled={renamingLoading}
                            >
                              {renamingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => {
                                setRenamingBranchId(null);
                                setRenameError("");
                              }}
                              className="p-1 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
                              disabled={renamingLoading}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-[13px] font-medium font-mono">
                              {branch.name}
                            </p>
                            {branch.isPrimary && (
                              <p className="text-[11px] text-[var(--text-tertiary)]">
                                Primary branch
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`neon-badge ${
                        branch.state === "Active"
                          ? "neon-badge-green"
                          : "neon-badge-yellow"
                      }`}
                    >
                      {branch.state}
                    </span>
                  </td>
                  <td>
                    <span className="text-[12px] font-mono">
                      PG {branch.pgVersion}
                    </span>
                  </td>
                  <td className="text-[12px] font-mono text-[var(--text-secondary)]">
                    {branch.lastRecordLsn || "—"}
                  </td>
                  <td className="text-[12px] text-[var(--text-secondary)]">
                    {new Date(branch.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setRenamingBranchId(branch.id);
                          setRenameValue(branch.name);
                          setRenameError("");
                        }}
                        className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                        title="Rename branch"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!branch.isPrimary && (
                        <button
                          onClick={() => setDeleteConfirm(branch)}
                          className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
                          title="Delete branch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Create Branch Dialog */}
      <CreateBranchDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => fetchBranches()}
        projectId={projectId}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="neon-modal-overlay"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--status-error-bg)] flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-[var(--status-error)]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold">Delete Branch</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)]">
                    This action is irreversible
                  </p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mb-6">
                Are you sure you want to delete branch{" "}
                <code className="font-mono bg-[var(--bg-inset)] px-1.5 py-0.5 rounded border border-[var(--border-default)]">
                  {deleteConfirm.name}
                </code>
                ? All data in this branch will be permanently lost.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="neon-btn neon-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="neon-btn neon-btn-danger"
                >
                  {deleting ? "Deleting..." : "Delete Branch"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
