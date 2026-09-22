"use client";

import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { useProject } from "@/lib/project-context";
import { GitBranch } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  User,
  Search,
  Check,
  Plus,
  ExternalLink,
  Database,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationPanel";
import { useState, useRef, useEffect, useCallback } from "react";


const breadcrumbs: Record<string, string> = {
  projects: "Projects",
  roles: "Roles",
  databases: "Databases",
  compute: "Compute",
  nodes: "Nodes",
  branches: "Branches",
  settings: "Settings",
  "sql-editor": "SQL Editor",
  data: "Data",
  docs: "Documentation",
  people: "People",
  account: "Account",
  dashboard: "Dashboard",
  backups: "Backups",
  "data-api": "Data API",
  "data-anonymization": "Data Anonymization",
  "security-advisor": "Security Advisor",
  "import-data": "Import Data",
};

export default function Topbar({ onSearchOpen }: { onSearchOpen?: () => void }) {
  const { user, logout } = useAuth();
  const { organization, organizations, switchOrganization, isAdmin } = useOrganization();
  const { project, selectedBranch } = useProject();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const orgMenuRef = useRef<HTMLDivElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);


  const segments = pathname.split("/").filter(Boolean);
  const mainSection = segments[0] || "projects";
  const isProjectDetail = mainSection === "projects" && segments.length > 1;

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Load avatar
  const loadAvatar = useCallback(async () => {
    try {
      const res = await fetch("/api/account/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile?.avatarUrl) {
          setAvatarUrl(data.profile.avatarUrl);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) {
        setOrgMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      {/* Left: Breadcrumb Navigation */}
      <div className="flex items-center gap-3 text-[13px] min-w-0">
        {/* Organization breadcrumb + switcher */}
        <div className="relative" ref={orgMenuRef}>
          <button
            onClick={() => setOrgMenuOpen(!orgMenuOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
          >
            <span className="font-semibold text-[var(--text-primary)]">
              {organization?.name || "My Organisation"}
            </span>
            <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" />
          </button>

          {orgMenuOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded-xl z-50 overflow-hidden animate-dropdown-enter dropdown-menu">
              <div className="px-3 py-2 border-b border-[var(--border-hover)]">
                <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Organisations
                </p>
              </div>
              <div className="py-1">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      switchOrganization(org.id);
                      setOrgMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--bg-hover-strong)] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>
                        {org.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {org.name}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)] capitalize">
                        {org.userRole}
                      </p>
                    </div>
                    {org.id === organization?.id && (
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent)" }} />
                    )}
                  </button>
                ))}
              </div>
              {isAdmin && (
                <div className="border-t border-[var(--border-hover)] py-1">
                  <button
                    onClick={() => {
                      router.push("/admin/organizations");
                      setOrgMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover-strong)] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Manage Organisations
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <span className="text-[var(--text-tertiary)]">/</span>

        {/* Section breadcrumb */}
        {isProjectDetail && project ? (
          <>
            <button
              onClick={() => router.push("/projects")}
              className="font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
            >
              Projects
            </button>
            <span className="text-[var(--text-tertiary)]">/</span>
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <Database className="w-3.5 h-3.5 text-[var(--neon-green)]" />
              {project.name}
            </span>
            {selectedBranch && (
              <>
                <span className="text-[var(--text-tertiary)]">/</span>
                <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                  <GitBranch className="w-3 h-3" />
                  {selectedBranch.name}
                </span>
              </>
            )}
            {segments.length > 2 && (
              <>
                <span className="text-[var(--text-tertiary)]">/</span>
                <span className="font-medium text-[var(--text-secondary)]">
                  {breadcrumbs[segments[segments.length - 1]] || segments[segments.length - 1]}
                </span>
              </>
            )}
          </>
        ) : (
          <span className="font-medium text-[var(--text-primary)]">
            {breadcrumbs[mainSection] || mainSection}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button
          className="search-button"
          onClick={() => onSearchOpen?.()}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <kbd className="ml-auto text-[10px] bg-[var(--bg-inset)] border border-[var(--border-default)] rounded px-1 py-0.5 font-mono">
            ⌘K
          </kbd>
        </button>


        {/* Notifications */}
        <NotificationBell />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[var(--neon-green)] flex items-center justify-center text-[var(--accent-foreground)] text-[11px] font-bold overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{user?.name?.[0]?.toUpperCase() || "U"}</span>
              )}
            </div>
            <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" />
          </button>

          {menuOpen && (
            <div className="dropdown-menu">
              {/* User info */}
              <div className="px-3 py-2 border-b border-[var(--border-default)]">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">
                  {user?.name}
                </p>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {user?.email}
                </p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <a
                  href="/account"
                  className="dropdown-item"
                  onClick={() => setMenuOpen(false)}
                >
                  <User className="w-4 h-4 text-[var(--text-tertiary)]" />
                  Account Settings
                </a>
                <a
                  href="/docs"
                  className="dropdown-item"
                >
                  <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />
                  Documentation
                </a>
              </div>

              <div className="border-t border-[var(--border-default)] pt-1">
                <button
                  onClick={handleLogout}
                  className="dropdown-item text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
