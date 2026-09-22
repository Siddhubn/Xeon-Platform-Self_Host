"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  User,
  Shield,
  Palette,
  Camera,
  Save,
  Check,
  X,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Clock,
  Mail,
  Building,
  MapPin,
  Globe,
  Briefcase,
  AlertTriangle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useTheme } from "@/lib/theme/theme-provider";
import { ACCENT_COLORS, type AccentColor } from "@/lib/theme/types";
import { AccountSkeleton } from "@/components/Skeleton";
import { useOrganization } from "@/lib/org-context";

type Tab = "profile" | "personal" | "organisation" | "account" | "security" | "appearance" | "preferences";

interface Profile {
  id: string;
  userId: string;
  displayName: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  fullName: string | null;
  organization: string | null;
  jobTitle: string | null;
  location: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Preferences {
  theme: string;
  defaultProjectId: string | null;
  defaultBranchId: string | null;
  timezone: string | null;
  sidebarCollapsed: boolean;
}

interface Project {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "personal", label: "Personal Information", icon: Building },
  { id: "organisation", label: "Organisation", icon: Building },
  { id: "account", label: "Account", icon: Shield },
  { id: "security", label: "Security", icon: Shield },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "preferences", label: "Preferences", icon: Globe },
];

export default function AccountSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { mode: themeMode, accentColor: themeAccent, setMode: setThemeMode, setAccentColor: setThemeAccent, resetTheme } = useTheme();
  const { organization: activeOrg, isOwner, refreshOrganizations } = useOrganization();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences>({
    theme: "system",
    defaultProjectId: null,
    defaultBranchId: null,
    timezone: null,
    sidebarCollapsed: false,
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [fullName, setFullName] = useState("");
  const [organization, setOrganization] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Organisation form state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  useEffect(() => {
    if (activeOrg) {
      setOrgName(activeOrg.name || "");
      setOrgSlug(activeOrg.slug || "");
      setOrgDescription(activeOrg.description || "");
    }
  }, [activeOrg]);

  // Preferences form state
  const [prefTheme, setPrefTheme] = useState("system");
  const [prefDefaultProject, setPrefDefaultProject] = useState("");
  const [prefDefaultBranch, setPrefDefaultBranch] = useState("");
  const [prefTimezone, setPrefTimezone] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile and preferences
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, prefsRes, projectsRes] = await Promise.all([
        fetch("/api/account/profile"),
        fetch("/api/account/preferences"),
        fetch("/api/projects"),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        const p = profileData.profile;
        setProfile(p);
        if (p) {
          setDisplayName(p.displayName || "");
          setUsername(p.username || "");
          setBio(p.bio || "");
          setFullName(p.fullName || "");
          setOrganization(p.organization || "");
          setJobTitle(p.jobTitle || "");
          setLocation(p.location || "");
          setWebsite(p.website || "");
        } else {
          // Initialize with auth user data
          setDisplayName(user?.name || "");
        }
      }

      if (prefsRes.ok) {
        const prefsData = await prefsRes.json();
        const prefs = prefsData.preferences;
        setPreferences(prefs);
        setPrefTheme(prefs.theme || "system");
        setPrefDefaultProject(prefs.defaultProjectId || "");
        setPrefDefaultBranch(prefs.defaultBranchId || "");
        setPrefTimezone(prefs.timezone || "");
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        setProjects(projectsData.projects || []);

        // Load branches for default project if set
        if (projectsData.projects?.length > 0) {
          const defaultProj = prefDefaultProject || projectsData.projects[0].id;
          const branchesRes = await fetch(`/api/projects/${defaultProj}/branches`);
          if (branchesRes.ok) {
            const branchesData = await branchesRes.json();
            setBranches(branchesData.branches || []);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load account data:", err);
      setError("Failed to load account data");
    } finally {
      setLoading(false);
    }
  }, [user, prefDefaultProject]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) loadData();
  }, [user, authLoading, router, loadData]);

  // Load branches when project changes
  useEffect(() => {
    if (prefDefaultProject) {
      fetch(`/api/projects/${prefDefaultProject}/branches`)
        .then((r) => r.json())
        .then((data) => setBranches(data.branches || []))
        .catch(() => setBranches([]));
    }
  }, [prefDefaultProject]);

  // Save profile
  const saveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          username: username || null,
          bio,
          fullName,
          organization,
          jobTitle,
          location,
          website: website || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      const data = await res.json();
      setProfile(data.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  // Save preferences
  const savePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: prefTheme,
          defaultProjectId: prefDefaultProject || null,
          defaultBranchId: prefDefaultBranch || null,
          timezone: prefTimezone || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save preferences");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  // Save organisation
  const saveOrganisation = async () => {
    if (!activeOrg || !isOwner) return;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch(`/api/organizations/${activeOrg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, slug: orgSlug, description: orgDescription }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update organisation");
      }
      await refreshOrganizations();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update organisation");
    } finally {
      setSaving(false);
    }
  };

  // Save appearance (theme + accent color)
  const saveAppearance = async (newMode?: string, newAccent?: string) => {
    const modeToSave = newMode || themeMode;
    const accentToSave = newAccent || themeAccent;
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: modeToSave,
          accentColor: accentToSave,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save appearance");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save appearance");
    } finally {
      setSaving(false);
    }
  };

  // Reset appearance to defaults
  const handleResetAppearance = () => {
    resetTheme();
    saveAppearance("system", "blue");
  };

  // Upload avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate on client first
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Invalid file type. Allowed: JPEG, PNG, WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum size: 5MB");
      return;
    }

    try {
      setAvatarUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload avatar");
      }

      const data = await res.json();
      setProfile((prev) => (prev ? { ...prev, avatarUrl: data.avatarUrl } : null));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove avatar
  const handleAvatarRemove = async () => {
    try {
      setAvatarUploading(true);
      setError(null);
      const res = await fetch("/api/account/avatar", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove avatar");
      setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : null));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setAvatarUploading(false);
    }
  };

  // Change password
  const changePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  // Generate initials from name
  const getInitials = () => {
    const name = displayName || user?.name || "U";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (authLoading || loading) {
    return <AccountSkeleton />;
  }

  if (!user) return null;

  return (
    <div className="animate-page-enter max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Account Settings</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage your profile and account preferences
          </p>
        </div>
        {(activeTab === "profile" || activeTab === "personal" || (activeTab === "organisation" && isOwner) || activeTab === "appearance") && (
          <button
            onClick={activeTab === "appearance" ? () => saveAppearance() : activeTab === "organisation" ? saveOrganisation : saveProfile}
            disabled={saving}
            className="neon-btn neon-btn-primary"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </button>
        )}
        {activeTab === "preferences" && (
          <button
            onClick={savePreferences}
            disabled={saving}
            className="neon-btn neon-btn-primary"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Preferences"}
          </button>
        )}
      </div>

      {/* Success/Error banners */}
      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-active-bg)] border border-green-500/20 text-[13px] flex items-center gap-2 success-banner" style={{ color: "var(--text-primary)" }}>
          <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--status-active)" }} />
          Changes saved successfully.
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] flex items-center gap-2 error-banner" style={{ color: "var(--text-primary)" }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--status-error)" }} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Left: Tabs */}
        <div className="w-[200px] flex-shrink-0">
          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setError(null);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all text-left ${
                    activeTab === tab.id
                      ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right: Content */}
        <div className="flex-1 min-w-0">
          {/* ── Profile Tab ── */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Avatar */}
              <div className="neon-card">
                <div className="p-5">
                  <h3 className="text-[14px] font-semibold mb-4">Profile Photo</h3>
                  <div className="flex items-center gap-5">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--bg-surface-secondary)] flex items-center justify-center border-2 border-[var(--border-default)]">
                        {profile?.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[24px] font-bold text-[var(--text-secondary)]">
                            {getInitials()}
                          </span>
                        )}
                      </div>
                      {avatarUploading && (
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-inverse)" }} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="neon-btn neon-btn-sm flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {profile?.avatarUrl ? "Replace Photo" : "Upload Photo"}
                      </button>
                      {profile?.avatarUrl && (
                        <button
                          onClick={handleAvatarRemove}
                          disabled={avatarUploading}
                          className="neon-btn neon-btn-sm text-[var(--status-error)] hover:bg-[var(--status-error-bg)] flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove Photo
                        </button>
                      )}
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        JPEG, PNG or WebP. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Display Name & Username */}
              <div className="neon-card">
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your display name"
                      className="neon-input"
                    />
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                      This is how others will see you in the console.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username (optional)"
                      className="neon-input font-mono"
                    />
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                      3-30 characters. Letters, numbers, hyphens, and underscores only.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Email Address
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        className="neon-input opacity-60 cursor-not-allowed"
                      />
                      <span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">
                        Managed by authentication
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Bio
                    </label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell others about yourself..."
                      rows={3}
                      maxLength={500}
                      className="neon-input resize-none"
                    />
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                      {bio.length}/500 characters
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Personal Information Tab ── */}
          {activeTab === "personal" && (
            <div className="neon-card">
              <div className="p-5 space-y-4">
                <p className="text-[13px] text-[var(--text-secondary)] mb-2">
                  Optional professional information. All fields are optional.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      <Briefcase className="w-3 h-3 inline mr-1" />
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      className="neon-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      <Building className="w-3 h-3 inline mr-1" />
                      Organization
                    </label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Company or team"
                      className="neon-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      <Briefcase className="w-3 h-3 inline mr-1" />
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="Software Engineer"
                      className="neon-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="City, Country"
                      className="neon-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      <Globe className="w-3 h-3 inline mr-1" />
                      Website
                    </label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://example.com"
                      className="neon-input font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Organisation Tab ── */}
          {activeTab === "organisation" && (
            <div className="space-y-5">
              {/* Info banner for non-owners */}
              {!isOwner && (
                <div className="p-3 rounded-lg border text-[12px] flex items-center gap-2" style={{ background: "var(--status-info-bg)", borderColor: "var(--accent-subtle)", color: "var(--text-primary)" }}>
                  <Shield className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                  Organisation details can only be viewed and edited by the super admin (organisation owner). Contact your admin to request changes.
                </div>
              )}

              {/* Organisation info — read-only for members, editable for owner */}
              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <Building className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    Organisation Details
                  </h3>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                    {isOwner
                      ? "Manage the organisation associated with your current workspace."
                      : "View the organisation associated with your current workspace."
                    }
                  </p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Organisation Name
                    </label>
                    {isOwner ? (
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Organisation name"
                        className="neon-input"
                      />
                    ) : (
                      <div className="neon-input flex items-center" style={{ background: "var(--bg-inset)", opacity: 0.8 }}>
                        {orgName || "—"}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Slug
                    </label>
                    {isOwner ? (
                      <input
                        type="text"
                        value={orgSlug}
                        onChange={(e) => setOrgSlug(e.target.value)}
                        placeholder="organisation-slug"
                        className="neon-input font-mono"
                      />
                    ) : (
                      <div className="neon-input flex items-center font-mono text-[var(--text-secondary)]" style={{ background: "var(--bg-inset)", opacity: 0.8 }}>
                        {orgSlug || "—"}
                      </div>
                    )}
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                      URL-friendly identifier.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Description
                    </label>
                    {isOwner ? (
                      <textarea
                        value={orgDescription}
                        onChange={(e) => setOrgDescription(e.target.value)}
                        placeholder="Describe your organisation..."
                        rows={3}
                        className="neon-input resize-none"
                      />
                    ) : (
                      <div className="neon-input flex items-start" style={{ background: "var(--bg-inset)", opacity: 0.8, minHeight: 80 }}>
                        {orgDescription || "No description provided."}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Organisation metadata — always read-only */}
              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    Organisation Information
                  </h3>
                </div>
                <div className="p-5 space-y-0">
                  <InfoRow label="Organisation ID" value={activeOrg?.id || "—"} />
                  <InfoRow label="Your Role" value={activeOrg?.userRole || "—"} badge />
                  <InfoRow label="Created" value={activeOrg?.createdAt ? new Date(activeOrg.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"} />
                </div>
              </div>
            </div>
          )}

          {/* ── Account Tab ── */}
          {activeTab === "account" && (
            <div className="space-y-5">
              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--neon-green)]" />
                    Account Information
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  <InfoRow label="Account ID" value={user.id} />
                  <InfoRow label="Role" value={user.role.charAt(0).toUpperCase() + user.role.slice(1)} badge />
                  <InfoRow label="Email Address" value={user.email} />
                  <InfoRow
                    label="Account Created"
                    value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    }) : "Unknown"}
                  />
                  <InfoRow
                    label="Last Updated"
                    value={profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString("en-US", {
                      year: "numeric", month: "long", day: "numeric",
                    }) : "Never"}
                  />
                </div>
              </div>

              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--neon-green)]" />
                    Session Information
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  <InfoRow label="Session Status" value="Active" badge />
                  <InfoRow
                    label="Authentication Method"
                    value="Password (Demo)"
                  />
                  <InfoRow
                    label="Session Expires"
                    value="7 days from last login"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Security Tab ── */}
          {activeTab === "security" && (
            <div className="space-y-5">
              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--neon-green)]" />
                    Change Password
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  {passwordSuccess && (
                    <div className="p-3 rounded-lg bg-[var(--status-active-bg)] border border-green-200 text-[var(--status-active)] text-[13px] flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Password changed successfully.
                    </div>
                  )}
                  {passwordError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--status-error)" }} />
                      {passwordError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        className="neon-input pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 6 characters)"
                        className="neon-input pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="neon-input"
                    />
                  </div>

                  <button
                    onClick={changePassword}
                    disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                    className="neon-btn neon-btn-primary"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Shield className="w-3.5 h-3.5" />
                    )}
                    {saving ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>

              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[var(--neon-green)]" />
                    Email Address
                  </h3>
                </div>
                <div className="p-5">
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    Your email address is managed by the authentication provider.
                    To change your email, contact your administrator.
                  </p>
                  <div className="mt-3 p-3 rounded-lg bg-[var(--bg-surface-secondary)] border border-[var(--border-default)]">
                    <span className="text-[13px] font-mono text-[var(--text-primary)]">{user.email}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Appearance Tab ── */}
          {activeTab === "appearance" && (
            <div className="space-y-5">
              {/* Theme Mode */}
              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4" style={{ color: "var(--accent)" }} />
                    Theme
                  </h3>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                    Choose how the application appears.
                  </p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: "system" as const, label: "System", desc: "Follow your system settings" },
                      { id: "light" as const, label: "Light", desc: "Light appearance" },
                      { id: "dark" as const, label: "Dark", desc: "Dark appearance" },
                    ]).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setThemeMode(t.id);
                          saveAppearance(t.id, undefined);
                        }}
                        className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl border-2 text-[13px] font-medium transition-all ${
                          themeMode === t.id
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--border-default)] hover:border-[var(--border-hover)]"
                        }`}
                      >
                        <div className={`w-12 h-8 rounded-md border ${
                          t.id === "light" ? "bg-white border-gray-300" :
                          t.id === "dark" ? "bg-gray-800 border-gray-600" :
                          "bg-gradient-to-r from-white from-1/2 to-gray-800 to-1/2 border-gray-400"
                        }`} />
                        <span style={{ color: themeMode === t.id ? "var(--accent)" : "var(--text-primary)" }}>
                          {t.label}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          {t.desc}
                        </span>
                        {themeMode === t.id && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "var(--accent)" }}>
                            <Check className="w-3 h-3" style={{ color: "var(--accent-foreground)" }} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Accent Colour */}
              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: "var(--accent)" }} />
                    Accent Colour
                  </h3>
                  <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                    Choose the primary colour used throughout the application.
                  </p>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-8 gap-3">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => {
                          setThemeAccent(color.id);
                          saveAppearance(undefined, color.id);
                        }}
                        aria-label={`${color.label} accent colour`}
                        className={`relative flex flex-col items-center gap-1.5 group`}
                      >
                        <div
                          className={`w-10 h-10 rounded-full transition-all duration-150 flex items-center justify-center ${
                            themeAccent === color.id
                              ? "ring-2 ring-offset-2 ring-offset-[var(--bg-surface)]"
                              : "hover:scale-110"
                          }`}
                          style={{
                            background: color.hex,
                            ...(themeAccent === color.id ? { ringColor: color.hex } : {}),
                            boxShadow: themeAccent === color.id ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${color.hex}` : undefined,
                          }}
                        >
                          {themeAccent === color.id && (
                            <Check className="w-4 h-4" style={{ color: color.fg }} />
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
                          {color.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reset */}
              <div className="neon-card">
                <div className="p-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-semibold">Reset Appearance</h3>
                    <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                      Restore default theme and accent colour.
                    </p>
                  </div>
                  <button
                    onClick={handleResetAppearance}
                    className="neon-btn neon-btn-secondary flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Preferences Tab ── */}
          {activeTab === "preferences" && (
            <div className="space-y-5">
              <div className="neon-card">
                <div className="px-5 py-3 border-b border-[var(--border-default)]">
                  <h3 className="text-[14px] font-semibold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[var(--neon-green)]" />
                    Defaults
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Default Project
                    </label>
                    <select
                      value={prefDefaultProject}
                      onChange={(e) => {
                        setPrefDefaultProject(e.target.value);
                        setPrefDefaultBranch("");
                      }}
                      className="neon-input"
                    >
                      <option value="">None</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                      The project shown by default when you open the console.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Default Branch
                    </label>
                    <select
                      value={prefDefaultBranch}
                      onChange={(e) => setPrefDefaultBranch(e.target.value)}
                      disabled={!prefDefaultProject}
                      className="neon-input"
                    >
                      <option value="">None</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                      The branch shown by default within the selected project.
                    </p>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Timezone
                    </label>
                    <select
                      value={prefTimezone}
                      onChange={(e) => setPrefTimezone(e.target.value)}
                      className="neon-input"
                    >
                      <option value="">System Default</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Europe/Berlin">Berlin (CET)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Asia/Shanghai">Shanghai (CST)</option>
                      <option value="Asia/Kolkata">India (IST)</option>
                      <option value="Australia/Sydney">Sydney (AEST)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
      {badge ? (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--neon-green)]/10 text-[var(--neon-green)] capitalize">
          {value}
        </span>
      ) : (
        <span className="text-[13px] font-mono text-[var(--text-primary)]">{value}</span>
      )}
    </div>
  );
}
