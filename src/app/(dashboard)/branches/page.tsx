"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Clock,
  Database,
} from "lucide-react";
import CreateBranchDialog from "@/components/CreateBranchDialog";
import ProjectBranchSelector from "@/components/ProjectBranchSelector";
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchBranches = useCallback(async () => {
    if (!selectedProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/branches`);
      const data = await res.json();
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleDelete = async (branch: Branch) => {
    if (!selectedProjectId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${selectedProjectId}/branches/${branch.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setDeleteConfirm(null);
        fetchBranches();
      }
    } catch {
      alert("Failed to delete branch");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animate-page-enter max-w-[1200px]">
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
            disabled={!selectedProjectId}
            className="neon-btn neon-btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Branch
          </button>
        </div>
      </div>

      <ProjectBranchSelector
        onSelectionChange={(pid, bid) => {
          setSelectedProjectId(pid);
          setSelectedBranchId(bid);
        }}
      />

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
                    {selectedProjectId
                      ? "No branches found. Create one to get started."
                      : "Select a project to view branches."}
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
                      <div>
                        <p className="text-[13px] font-medium font-mono">
                          {branch.name}
                        </p>
                        {branch.isPrimary && (
                          <p className="text-[11px] text-[var(--text-tertiary)]">
                            Primary branch
                          </p>
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
                    {!branch.isPrimary && (
                      <button
                        onClick={() => setDeleteConfirm(branch)}
                        className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
                        title="Delete branch"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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
        projectId={selectedProjectId}
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
