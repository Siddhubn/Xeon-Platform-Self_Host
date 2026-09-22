"use client";

import { useState } from "react";
import { X, Database, Loader2 } from "lucide-react";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: { id: string; name: string }) => void;
}

export default function CreateProjectDialog({
  isOpen,
  onClose,
  onCreated,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Project name cannot be empty");
      return;
    }
    if (trimmedName.length < 2) {
      setError("Project name must be at least 2 characters");
      return;
    }
    if (trimmedName.length > 100) {
      setError("Project name must be 100 characters or less");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        onCreated(data.project);
        setName("");
        onClose();
      }
    } catch (err) {
      setError("Failed to create project. Please try again.");
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
                <Database className="w-5 h-5 text-[var(--neon-green)]" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold">Create New Project</h2>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  Set up a new database project
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
        <div className="px-6 py-5">
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-[var(--text-primary)] mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="e.g., My Application Database"
              className="neon-input w-full h-[42px]"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
              Enter a descriptive name for your project. This will be displayed
              throughout the console.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[var(--status-error-bg)] border border-red-200 text-[var(--status-error)] text-[12px] mb-4">
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
            disabled={creating || !name.trim()}
            className="neon-btn neon-btn-primary"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Project"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
