"use client";

import { useState, useEffect } from "react";
import { X, GitBranch, Loader2 } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface CreateBranchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (branch: { id: string; name: string }) => void;
  projectId: string | null;
}

export default function CreateBranchDialog({
  isOpen,
  onClose,
  onCreated,
  projectId,
}: CreateBranchDialogProps) {
  const [name, setName] = useState("");
  const [parentBranchId, setParentBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Fetch branches when dialog opens
  useEffect(() => {
    if (isOpen && projectId) {
      setLoadingBranches(true);
      fetch(`/api/projects/${projectId}/branches`)
        .then((res) => res.json())
        .then((data) => {
          const branchList = data.branches || [];
          setBranches(branchList);
          // Default to the primary (main) branch
          const primary = branchList.find((b: Branch) => b.isPrimary);
          if (primary) {
            setParentBranchId(primary.id);
          } else if (branchList.length > 0) {
            setParentBranchId(branchList[0].id);
          }
        })
        .catch(() => setBranches([]))
        .finally(() => setLoadingBranches(false));
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Branch name cannot be empty");
      return;
    }
    if (trimmedName.length < 2) {
      setError("Branch name must be at least 2 characters");
      return;
    }
    if (trimmedName.length > 100) {
      setError("Branch name must be 100 characters or less");
      return;
    }
    if (!parentBranchId) {
      setError("Please select a parent branch");
      return;
    }
    if (!projectId) {
      setError("No project selected");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          parentBranchId,
        }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        onCreated(data.branch);
        setName("");
        onClose();
      }
    } catch (err) {
      setError("Failed to create branch. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="neon-modal-overlay" onClick={onClose}>
      <div
        className="neon-modal w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-default)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--neon-green-bg)] flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-[var(--neon-green)]" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold">Create New Branch</h2>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Create a copy-on-write branch from an existing branch
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--text-tertiary)]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Branch Name */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-2">
              Branch Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g., development, feature-auth, staging"
              className="neon-input w-full h-[42px]"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
              Give your branch a meaningful name. This will be displayed
              throughout the console.
            </p>
          </div>

          {/* Parent Branch */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-2">
              Parent Branch
            </label>
            {loadingBranches ? (
              <div className="neon-input h-[42px] flex items-center gap-2 text-[var(--text-tertiary)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading branches...
              </div>
            ) : (
              <select
                value={parentBranchId}
                onChange={(e) => setParentBranchId(e.target.value)}
                className="neon-input w-full h-[42px]"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.isPrimary ? " (main)" : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
              Select the branch to fork from. The new branch will be a
              copy-on-write clone.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[var(--status-error-bg)] border border-red-200 text-[var(--status-error)] text-[12px]">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-default)] flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={creating}
            className="neon-btn neon-btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || !parentBranchId}
            className="neon-btn neon-btn-primary"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Branch"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
