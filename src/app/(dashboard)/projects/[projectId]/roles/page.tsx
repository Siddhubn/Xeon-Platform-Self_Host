"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Trash2, Copy, Check, Key, X, RefreshCw, AlertTriangle } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { RolesSkeleton } from "@/components/Skeleton";

interface Role {
  id: string;
  name: string;
  isDefault: boolean;
  projectId: string;
  branchId: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [newRole, setNewRole] = useState({ name: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { projectId, selectedBranchId } = useProject();

  const fetchRoles = useCallback(async () => {
    if (!projectId || !selectedBranchId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/roles?branchId=${selectedBranchId}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setRoles([]);
      } else {
        setRoles(data.roles || []);
      }
    } catch {
      setError("Failed to fetch roles");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedBranchId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleCreate = async () => {
    if (!newRole.name.trim() || !newRole.password.trim()) return;
    if (!projectId || !selectedBranchId) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: selectedBranchId,
          name: newRole.name.trim(),
          password: newRole.password,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setShowInput(false);
        setNewRole({ name: "", password: "" });
        if (data.warning) {
          setWarning(data.warning);
          setTimeout(() => setWarning(""), 8000);
        }
        await fetchRoles();
      }
    } catch {
      setError("Failed to create role");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (roleName: string) => {
    if (!projectId || !selectedBranchId) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/roles?branchId=${selectedBranchId}&name=${encodeURIComponent(roleName)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setDeleteConfirm(null);
        await fetchRoles();
      }
    } catch {
      setError("Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div className="animate-page-enter px-4 py-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Roles</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage PostgreSQL roles for your databases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchRoles}
            disabled={loading}
            className="neon-btn neon-btn-ghost neon-btn-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin-slow" : ""}`} />
          </button>
          <button
            onClick={() => setShowInput(true)}
            disabled={!selectedBranchId}
            className="neon-btn neon-btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            New Role
          </button>
        </div>
      </div>



      {error && (
        <div className="mt-4 mb-4 p-3 rounded-lg bg-[var(--status-error-bg)] border border-red-200 text-[var(--status-error)] text-[13px] animate-card-enter flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="p-1 rounded hover:bg-red-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {warning && (
        <div className="mt-4 mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[13px] animate-card-enter flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{warning}</span>
          </div>
          <button onClick={() => setWarning("")} className="p-1 rounded hover:bg-amber-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showInput && (
        <div className="neon-card p-4 mt-4 mb-4 animate-card-enter">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                Role Name
              </label>
              <input
                type="text"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                placeholder="my_role"
                className="neon-input h-[38px]"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={newRole.password}
                onChange={(e) => setNewRole({ ...newRole, password: e.target.value })}
                placeholder="secure_password"
                className="neon-input h-[38px]"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !newRole.name.trim() || !newRole.password.trim()}
              className="neon-btn neon-btn-primary neon-btn-sm"
            >
              {creating ? (
                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin-slow" />
              ) : (
                "Create"
              )}
            </button>
            <button
              onClick={() => setShowInput(false)}
              className="neon-btn neon-btn-ghost neon-btn-sm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {loading && roles.length === 0 ? (
        <div className="neon-card overflow-hidden mt-4">
          <RolesSkeleton inline />
        </div>
      ) : (
      <div className="neon-card overflow-hidden mt-4">
        <table className="neon-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Type</th>
              <th className="w-[100px]"></th>
            </tr>
          </thead>
          <tbody className="stagger-children">
            {roles.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12">
                  <Users className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {selectedBranchId
                      ? "No roles found. Create one to get started."
                      : "Select a project and branch to view roles."}
                  </p>
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-md bg-[var(--bg-inset)] flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                      </div>
                      <span className="font-mono text-[13px] font-medium">{role.name}</span>
                      <button
                        onClick={() => copyToClipboard(role.name)}
                        className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {copied === role.name ? (
                          <Check className="w-3 h-3 text-[var(--status-active)]" />
                        ) : (
                          <Copy className="w-3 h-3 text-[var(--text-tertiary)]" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`neon-badge ${role.isDefault ? "neon-badge-blue" : "neon-badge-gray"}`}
                    >
                      <Key className="w-2.5 h-2.5" />
                      {role.isDefault ? "System" : "Custom"}
                    </span>
                  </td>
                  <td className="text-right">
                    {!role.isDefault && (
                      <button
                        onClick={() => setDeleteConfirm(role.name)}
                        className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="neon-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--status-error-bg)] flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[var(--status-error)]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold">Delete Role</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)]">This action is irreversible</p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mb-6">
                Are you sure you want to delete role{" "}
                <code className="font-mono bg-[var(--bg-inset)] px-1.5 py-0.5 rounded border border-[var(--border-default)]">
                  {deleteConfirm}
                </code>
                ?
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="neon-btn neon-btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="neon-btn neon-btn-danger"
                >
                  {deleting ? "Deleting..." : "Delete Role"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
