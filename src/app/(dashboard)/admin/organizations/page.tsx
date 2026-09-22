"use client";

import { useState, useCallback } from "react";
import { useOrganization } from "@/lib/org-context";
import {
  Building2,
  Plus,
  Users,
  Check,
  X,
  Shield,
  Trash2,
  Pencil,
  AlertCircle,
  Loader2,
  UserPlus,
} from "lucide-react";

interface Org {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  userRole: string;
  createdAt?: string;
}

interface OrgMember {
  userId: string;
  membershipId: string;
  name: string;
  email: string;
  role: string;
}

export default function AdminOrgsPage() {
  const { organization, organizations, isAdmin, refreshOrganizations } = useOrganization();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", description: "" });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingOrg, setDeletingOrg] = useState<Org | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Members state
  const [showMembers, setShowMembers] = useState<Org | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState("");
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create organisation");
        return;
      }
      setSuccess(`Organisation "${form.name}" created successfully`);
      setShowCreate(false);
      setForm({ name: "", slug: "", description: "" });
      await refreshOrganizations();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to create organisation");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editingOrg) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/organizations/${editingOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update organisation");
        return;
      }
      setSuccess("Organisation updated successfully");
      setEditingOrg(null);
      await refreshOrganizations();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update organisation");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingOrg) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/organizations/${deletingOrg.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete organisation");
        return;
      }
      setSuccess("Organisation deleted successfully");
      setDeletingOrg(null);
      await refreshOrganizations();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to delete organisation");
    } finally {
      setDeleting(false);
    }
  };

  // Fetch members for any org using the dedicated endpoint (no cookie dependency)
  const fetchMembers = useCallback(async (orgId: string) => {
    setMembersLoading(true);
    setMembersError("");
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`);
      const data = await res.json();
      if (!res.ok) {
        setMembersError(data.error || "Failed to load members");
        setMembers([]);
        return;
      }
      setMembers(data.members || []);
    } catch {
      setMembers([]);
      setMembersError("Failed to load members");
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const handleRemoveMember = async (member: OrgMember) => {
    if (!showMembers) return;
    setRemovingMember(member.userId);
    setMembersError("");
    try {
      const res = await fetch(`/api/organizations/${showMembers.id}/members/${member.membershipId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setMembersError(data.error || "Failed to remove member");
        return;
      }
      // Refresh the members list
      await fetchMembers(showMembers.id);
    } catch (err: any) {
      setMembersError(err.message || "Failed to remove member");
    } finally {
      setRemovingMember(null);
    }
  };

  const openEdit = (org: Org) => {
    setEditForm({ name: org.name, slug: org.slug || "", description: org.description || "" });
    setEditingOrg(org);
  };

  if (!isAdmin) {
    return (
      <div className="animate-page-enter max-w-[1200px]">
        <div className="neon-card p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="text-[16px] font-semibold mb-1">Access Denied</h3>
          <p className="text-[13px] text-[var(--text-secondary)]">
            You need administrator privileges to manage organisations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Organisations</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage organisations and memberships
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="neon-btn neon-btn-primary">
          <Plus className="w-4 h-4" />
          Create Organisation
        </button>
      </div>

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-active-bg)] border border-[var(--status-active)] text-[13px] flex items-center gap-2 animate-card-enter" style={{ color: "var(--text-primary)" }}>
          <Check className="w-4 h-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess("")} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-error-bg)] border border-[var(--status-error)] text-[13px] flex items-center gap-2 animate-card-enter" style={{ color: "var(--text-primary)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="space-y-3">
        {organizations.map((org) => (
          <div key={org.id} className={`neon-card p-5 flex items-center justify-between ${org.id === organization?.id ? "ring-2 ring-[var(--accent)]" : ""}`}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] flex items-center justify-center">
                <Building2 className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold">{org.name}</h3>
                  {org.id === organization?.id && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-soft)]" style={{ color: "var(--accent)" }}>Active</span>
                  )}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] capitalize">
                  Your role: {org.userRole} · {org.slug || "No slug"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`neon-badge ${org.userRole === "owner" ? "neon-badge-green" : org.userRole === "admin" ? "neon-badge-yellow" : "neon-badge-gray"} capitalize`}>
                {org.userRole}
              </span>
              <button
                onClick={() => {
                  setShowMembers(org);
                  fetchMembers(org.id);
                }}
                className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                title="Manage members"
              >
                <Users className="w-4 h-4" />
              </button>
              {(org.userRole === "owner" || org.userRole === "admin") && (
                <button onClick={() => openEdit(org)} className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors" title="Edit organisation">
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {org.userRole === "owner" && org.id !== organization?.id && (
                <button onClick={() => setDeletingOrg(org)} className="p-1.5 rounded text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete organisation">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Create Organisation Modal ── */}
      {showCreate && (
        <div className="neon-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-bold">Create Organisation</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-[var(--bg-hover)]"><X className="w-4 h-4 text-[var(--text-tertiary)]" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Organisation Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="neon-input" placeholder="My Organisation" autoFocus />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Slug</label>
                  <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="neon-input" placeholder="my-organisation" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="neon-input" rows={3} placeholder="Optional description" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowCreate(false)} className="neon-btn neon-btn-secondary">Cancel</button>
                <button onClick={handleCreate} disabled={creating || !form.name.trim()} className="neon-btn neon-btn-primary">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Organisation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Organisation Modal ── */}
      {editingOrg && (
        <div className="neon-modal-overlay" onClick={() => setEditingOrg(null)}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-bold">Edit Organisation</h3>
                <button onClick={() => setEditingOrg(null)} className="p-1 rounded hover:bg-[var(--bg-hover)]"><X className="w-4 h-4 text-[var(--text-tertiary)]" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Organisation Name</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="neon-input" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Slug</label>
                  <input type="text" value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} className="neon-input" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
                  <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="neon-input" rows={3} />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditingOrg(null)} className="neon-btn neon-btn-secondary">Cancel</button>
                <button onClick={handleEdit} disabled={saving || !editForm.name.trim()} className="neon-btn neon-btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Pencil className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Members / Access Modal ── */}
      {showMembers && (
        <div className="neon-modal-overlay" onClick={() => setShowMembers(null)}>
          <div className="neon-modal" style={{ maxWidth: 560, maxHeight: "85vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[16px] font-bold">Organisation Members</h3>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{showMembers.name}</p>
                </div>
                <button onClick={() => setShowMembers(null)} className="p-1 rounded hover:bg-[var(--bg-hover)]"><X className="w-4 h-4 text-[var(--text-tertiary)]" /></button>
              </div>

              {/* Inline error inside modal */}
              {membersError && (
                <div className="mb-4 p-3 rounded-lg bg-[var(--status-error-bg)] border border-[var(--status-error)] text-[12px] flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {membersError}
                  <button onClick={() => setMembersError("")} className="ml-auto"><X className="w-3 h-3" /></button>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <span className="text-[12px] text-[var(--text-secondary)]">{members.length} member{members.length !== 1 ? "s" : ""}</span>
                <button
                  onClick={() => { setShowMembers(null); window.location.href = "/admin/users"; }}
                  className="neon-btn neon-btn-primary neon-btn-sm"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add Member
                </button>
              </div>

              <div className="space-y-2" style={{ maxHeight: "55vh", overflowY: "auto" }}>
                {membersLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--text-tertiary)]" />
                    <p className="text-[12px] text-[var(--text-tertiary)] mt-2">Loading members...</p>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
                    <p className="text-[12px] text-[var(--text-secondary)]">No members found</p>
                  </div>
                ) : (
                  members.map((m) => (
                    <div key={m.membershipId} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center">
                          <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>{m.name[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-[13px] font-medium">{m.name}</p>
                          <p className="text-[11px] text-[var(--text-tertiary)]">{m.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`neon-badge ${m.role === "owner" ? "neon-badge-green" : m.role === "admin" ? "neon-badge-yellow" : "neon-badge-gray"} capitalize`}>
                          {m.role}
                        </span>
                        {m.role !== "owner" && (
                          <button
                            onClick={() => {
                              const confirmed = window.confirm(
                                `Remove ${m.name} (${m.email}) from this organisation?\n\nThis action will revoke their access.`
                              );
                              if (confirmed) {
                                handleRemoveMember(m);
                              }
                            }}
                            disabled={removingMember === m.userId}
                            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Remove member"
                          >
                            {removingMember === m.userId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Organisation Confirmation ── */}
      {deletingOrg && (
        <div className="neon-modal-overlay" onClick={() => setDeletingOrg(null)}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--status-error-bg)] flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-[var(--status-error)]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold">Delete Organisation</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)]">This action is irreversible</p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mb-2">
                Are you sure you want to delete <strong className="text-[var(--text-primary)]">{deletingOrg.name}</strong>?
              </p>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
                <p className="text-[12px] text-red-400">
                  This will permanently delete the organisation, all its memberships, and activity logs. All members will lose access.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeletingOrg(null)} className="neon-btn neon-btn-secondary">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="neon-btn neon-btn-danger">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete Organisation</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
