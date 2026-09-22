"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/lib/org-context";
import { useAuth } from "@/lib/auth-context";
import {
  Users,
  Plus,
  Shield,
  X,
  Search,
  Pencil,
  Key,
  Eye,
  EyeOff,
  Trash2,
  AlertCircle,
  Loader2,
  LogOut,
  Monitor,
} from "lucide-react";
import CustomSelect from "@/components/CustomSelect";

interface OrgUser {
  membershipId: string;
  role: string;
  joinedAt: string;
  userId: string;
  name: string;
  email: string;
  userRole: string;
  lastLogin: string | null;
  status: string;
  activeSessionCount?: number;
}

export default function AdminUsersPage() {
  const { organization, isAdmin } = useOrganization();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "developer",
    orgRole: "member",
  });
  const [creating, setCreating] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Edit state
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "", orgRole: "" });
  const [saving, setSaving] = useState(false);

  // Password reset state
  const [showPasswordReset, setShowPasswordReset] = useState<OrgUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Delete state
  const [deletingUser, setDeletingUser] = useState<OrgUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Session revoke state
  const [revokingSessions, setRevokingSessions] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }
      setShowCreate(false);
      setCreateForm({ name: "", email: "", password: "", role: "developer", orgRole: "member" });
      setShowCreatePassword(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.userId,
          membershipId: editingUser.membershipId,
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          orgRole: editForm.orgRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update user");
        return;
      }
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: deletingUser.userId,
          membershipId: deletingUser.membershipId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to remove user");
        return;
      }
      setDeletingUser(null);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to remove user");
    } finally {
      setDeleting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!showPasswordReset || !newPassword) return;
    setResettingPassword(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${showPasswordReset.userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }
      setShowPasswordReset(null);
      setNewPassword("");
      setShowNewPassword(false);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleRevokeSessions = async (userId: string) => {
    setRevokingSessions(userId);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/sessions`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to revoke sessions");
        return;
      }
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to revoke sessions");
    } finally {
      setRevokingSessions(null);
    }
  };

  const openEdit = (user: OrgUser) => {
    setEditForm({ name: user.name, email: user.email, role: user.userRole, orgRole: user.role });
    setEditingUser(user);
  };

  const isCurrentUser = (u: OrgUser) => currentUser?.id === u.userId;

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="animate-page-enter max-w-[1200px]">
        <div className="neon-card p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="text-[16px] font-semibold mb-1">Access Denied</h3>
          <p className="text-[13px] text-[var(--text-secondary)]">
            You need administrator privileges to access user management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Users</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage users in {organization?.name || "your organisation"}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="neon-btn neon-btn-primary">
          <Plus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-error-bg)] border border-[var(--status-error)] text-[13px] flex items-center gap-2 animate-card-enter" style={{ color: "var(--text-primary)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="search-input-wrapper mb-4">
        <Search className="search-input-icon" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="search-input"
        />
      </div>

      <div className="neon-card overflow-hidden">
        <table className="neon-table">
          <thead>
            <tr>
              <th>USER</th>
              <th>PLATFORM ROLE</th>
              <th>ORG ROLE</th>
              <th>SESSIONS</th>
              <th>LAST LOGIN</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin-slow mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Users className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                  <p className="text-[13px] text-[var(--text-secondary)]">No users found.</p>
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.userId}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center">
                        <span className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>
                          {u.name[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium">{u.name}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="neon-badge neon-badge-blue capitalize">{u.userRole}</span>
                  </td>
                  <td>
                    <span
                      className={`neon-badge ${
                        u.role === "owner" ? "neon-badge-green" : u.role === "admin" ? "neon-badge-yellow" : "neon-badge-gray"
                      } capitalize`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.activeSessionCount && u.activeSessionCount > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border bg-green-500/10 border-green-500/20 text-green-400">
                          <Monitor className="w-3 h-3" />
                          {u.activeSessionCount} active
                        </span>
                        {!isCurrentUser(u) && (
                          <button
                            onClick={() => handleRevokeSessions(u.userId)}
                            disabled={revokingSessions === u.userId}
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Revoke all sessions"
                          >
                            {revokingSessions === u.userId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <LogOut className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[var(--text-tertiary)]">Offline</span>
                    )}
                  </td>
                  <td className="text-[12px] text-[var(--text-secondary)]">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}
                  </td>
                  <td>
                    {/* Always-visible action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                        title="Edit user"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setShowPasswordReset(u);
                          setNewPassword("");
                          setShowNewPassword(false);
                        }}
                        className="p-1.5 rounded text-[var(--text-secondary)] hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                        title="Reset password"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      {!isCurrentUser(u) && u.role !== "owner" && (
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Remove from organisation"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* ── Create User Modal ── */}
      {showCreate && (
        <div className="neon-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[16px] font-bold">Create User</h3>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    Set a password so the user can log in immediately
                  </p>
                </div>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-[var(--bg-hover)]">
                  <X className="w-4 h-4 text-[var(--text-tertiary)]" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Full Name</label>
                  <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="neon-input" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
                  <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="neon-input" placeholder="user@example.com" />
                </div>
                <div className="p-4 rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/30">
                  <label className="block text-[12px] font-semibold mb-2" style={{ color: "var(--accent)" }}>
                    <Key className="w-3.5 h-3.5 inline mr-1" />
                    Login Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? "text" : "password"}
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      className="neon-input pr-10"
                      placeholder="Enter password (min 6 characters)"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                    >
                      {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {createForm.password && createForm.password.length < 6 && (
                    <p className="text-[11px] text-[var(--status-error)] mt-1">Password must be at least 6 characters</p>
                  )}
                  <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                    The user will use this password to log in at the login page with their email address.
                    You can also reset it later using the key icon.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Platform Role</label>
                    <CustomSelect
                      value={createForm.role}
                      options={[{ value: "admin", label: "Admin" }, { value: "developer", label: "Developer" }, { value: "readonly", label: "Read Only" }]}
                      onChange={(val) => setCreateForm({ ...createForm, role: val })}
                      searchable
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Org Role</label>
                    <CustomSelect
                      value={createForm.orgRole}
                      options={[{ value: "owner", label: "Owner" }, { value: "admin", label: "Admin" }, { value: "member", label: "Member" }, { value: "viewer", label: "Viewer" }]}
                      onChange={(val) => setCreateForm({ ...createForm, orgRole: val })}
                      searchable
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowCreate(false)} className="neon-btn neon-btn-secondary">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !createForm.name || !createForm.email || !createForm.password || createForm.password.length < 6}
                  className="neon-btn neon-btn-primary"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Create User</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="neon-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-bold">Edit User</h3>
                <button onClick={() => setEditingUser(null)} className="p-1 rounded hover:bg-[var(--bg-hover)]">
                  <X className="w-4 h-4 text-[var(--text-tertiary)]" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Full Name</label>
                  <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="neon-input" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="neon-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Platform Role</label>
                    <CustomSelect
                      value={editForm.role}
                      options={[{ value: "admin", label: "Admin" }, { value: "developer", label: "Developer" }, { value: "readonly", label: "Read Only" }]}
                      onChange={(val) => setEditForm({ ...editForm, role: val })}
                      searchable
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">Org Role</label>
                    <CustomSelect
                      value={editForm.orgRole}
                      options={[{ value: "owner", label: "Owner" }, { value: "admin", label: "Admin" }, { value: "member", label: "Member" }, { value: "viewer", label: "Viewer" }]}
                      onChange={(val) => setEditForm({ ...editForm, orgRole: val })}
                      searchable
                    />
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)]">
                  <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                    <Key className="w-3.5 h-3.5 flex-shrink-0" />
                    To change this user&apos;s password, use the password reset (key icon) on the user row.
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditingUser(null)} className="neon-btn neon-btn-secondary">Cancel</button>
                <button onClick={handleEdit} disabled={saving || !editForm.name || !editForm.email} className="neon-btn neon-btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Pencil className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Password Reset Modal ── */}
      {showPasswordReset && (
        <div className="neon-modal-overlay" onClick={() => { setShowPasswordReset(null); setNewPassword(""); setShowNewPassword(false); }}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[16px] font-bold">Reset Password</h3>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                    Set a new password for <strong>{showPasswordReset.name}</strong>
                  </p>
                </div>
                <button onClick={() => { setShowPasswordReset(null); setNewPassword(""); setShowNewPassword(false); }} className="p-1 rounded hover:bg-[var(--bg-hover)]">
                  <X className="w-4 h-4 text-[var(--text-tertiary)]" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-yellow-400">Admin Action</p>
                      <p className="text-[12px] text-yellow-400/80 mt-1">
                        The user will need to use this new password to log in. Their current password will no longer work.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="neon-input pr-10" placeholder="Minimum 6 characters" autoFocus />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && newPassword.length < 6 && (
                    <p className="text-[11px] text-[var(--status-error)] mt-1">Password must be at least 6 characters</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => { setShowPasswordReset(null); setNewPassword(""); setShowNewPassword(false); }} className="neon-btn neon-btn-secondary">Cancel</button>
                <button onClick={handlePasswordReset} disabled={resettingPassword || !newPassword || newPassword.length < 6} className="neon-btn neon-btn-primary">
                  {resettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Key className="w-4 h-4" /> Reset Password</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete User Confirmation ── */}
      {deletingUser && (
        <div className="neon-modal-overlay" onClick={() => setDeletingUser(null)}>
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--status-error-bg)] flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-[var(--status-error)]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold">Remove User</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)]">This can be undone by re-adding them</p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mb-2">
                Are you sure you want to remove <strong className="text-[var(--text-primary)]">{deletingUser.name}</strong> from the organisation?
              </p>
              <div className="p-3 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] mb-4">
                <p className="text-[12px] text-[var(--text-secondary)]">
                  This will remove their access to all organisation resources. Their user account will not be deleted.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeletingUser(null)} className="neon-btn neon-btn-secondary">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="neon-btn neon-btn-danger">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Remove User</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
