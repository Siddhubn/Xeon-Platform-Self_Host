"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import {
  Database,
  GitBranch,
  Server,
  Settings,
  Users,
  ChevronDown,
  HardDrive,
  Code2,
  LayoutGrid,
  Cpu,
  PanelLeftClose,
  HelpCircle,
  Table,
  Plus,
  Link as LinkIcon,
  Shield,
  Building2,
  Activity as ActivityIcon,
  Globe,
  Lock,
  EyeOff,
  Download,
} from "lucide-react";
import { useState } from "react";
import ConnectionDialog from "@/components/ConnectionDialog";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
  showConnectButton?: boolean;
}

const navSections: NavSection[] = [
  {
    title: "PROJECT",
    items: [
      { label: "Dashboard", href: "/projects", icon: LayoutGrid },
      { label: "Branches", href: "/branches", icon: GitBranch },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
    defaultOpen: true,
    showConnectButton: true,
  },
  {
    title: "BRANCH",
    items: [],
    defaultOpen: true,
  },
  {
    title: "Postgres database",
    items: [
      { label: "Tables", href: "/data", icon: Table },
      { label: "SQL Editor", href: "/sql-editor", icon: Code2 },
      { label: "Compute", href: "/compute", icon: Cpu },
      { label: "Roles", href: "/roles", icon: Users },
      { label: "Databases", href: "/databases", icon: HardDrive },
      { label: "Backup & Restore", href: "/backups", icon: Shield },
      { label: "Import Data", href: "/import-data", icon: Download },
      { label: "Data API", href: "/data-api", icon: Globe },
      { label: "Data Anonymization", href: "/data-anonymization", icon: Lock },
      { label: "Security Advisor", href: "/security-advisor", icon: EyeOff },
      { label: "Nodes", href: "/nodes", icon: Server },
    ],
    defaultOpen: true,
  },
];

const adminSection: NavSection = {
  title: "ADMINISTRATION",
  items: [
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Organisations", href: "/admin/organizations", icon: Building2 },
    { label: "Activity Log", href: "/admin/activity", icon: ActivityIcon },
  ],
  defaultOpen: true,
};

function BranchSelector({ collapsed }: { collapsed: boolean }) {
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const branches = ["main", "dev", "staging"];

  if (collapsed) {
    return (
      <div className="px-2">
        <Link
          href="/branches"
          className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)] transition-all duration-150"
          title={selectedBranch}
        >
          <GitBranch className="w-[18px] h-[18px]" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 mb-1.5">
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full flex items-center gap-2 px-3 py-[7px] rounded-lg text-[13px] font-medium text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)] transition-all duration-150"
        >
          <GitBranch className="w-[16px] h-[16px] flex-shrink-0" />
          <span className="flex-1 text-left truncate">{selectedBranch}</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-150 ${
              dropdownOpen ? "" : "-rotate-90"
            }`}
          />
        </button>
        {dropdownOpen && (
          <div className="absolute left-0 right-0 mt-1 rounded-lg z-50 py-1 dropdown-menu">
            {branches.map((branch) => (
              <button
                key={branch}
                onClick={() => {
                  setSelectedBranch(branch);
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-[6px] text-[12px] transition-colors ${
                  selectedBranch === branch
                    ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)]"
                }`}
              >
                <GitBranch className="w-3 h-3" />
                <span>{branch}</span>
                {selectedBranch === branch && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarSection({
  section,
  pathname,
  collapsed,
  onConnect,
}: {
  section: NavSection;
  pathname: string;
  collapsed: boolean;
  onConnect?: () => void;
}) {
  const [open, setOpen] = useState(section.defaultOpen ?? true);

  const isActive = (href: string) => {
    if (href === "/projects") {
      return pathname === "/projects" || pathname.startsWith("/projects/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Special handling for BRANCH section with branch selector
  if (section.title === "BRANCH") {
    return (
      <div className="mb-1.5">
        {!collapsed && (
          <div className="px-5 py-2">
            <span className="text-[10px] font-semibold tracking-[0.08em] text-[var(--sidebar-text)] uppercase select-none">
              {section.title}
            </span>
          </div>
        )}
        <BranchSelector collapsed={collapsed} />
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="space-y-0.5 px-2">
        {section.items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150 ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                  : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)]"
              }`}
              title={item.label}
            >
              <Icon className="w-[18px] h-[18px]" />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-1.5">
      {/* Section header with optional Connect button */}
      <div className="flex items-center justify-between px-5 py-2">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 group"
        >
          <span className="text-[10px] font-semibold tracking-[0.08em] text-[var(--sidebar-text)] uppercase select-none">
            {section.title}
          </span>
          <ChevronDown
            className={`w-3 h-3 text-[var(--sidebar-text)] transition-transform duration-150 ${
              open ? "" : "-rotate-90"
            }`}
          />
        </button>
        {section.showConnectButton && (
          <button
            onClick={onConnect}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--neon-green)] text-[var(--accent-foreground)] text-[11px] font-semibold hover:bg-[var(--neon-green-hover)] transition-colors"
          >
            <LinkIcon className="w-3 h-3" />
            <span>Connect</span>
          </button>
        )}
      </div>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-0.5 px-2">
          {section.items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)]"
                }`}
              >
                <Icon
                  className={`w-[16px] h-[16px] flex-shrink-0 transition-colors duration-150 ${
                    active ? "text-[var(--neon-green)]" : ""
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {active && (
                  <div className="w-1 h-1 rounded-full bg-[var(--neon-green)]" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { isAdmin } = useOrganization();
  const [collapsed, setCollapsed] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);

  return (
    <>
    <ConnectionDialog open={connectionOpen} onClose={() => setConnectionOpen(false)} />
    <aside
      className={`${
        collapsed ? "w-[52px]" : "w-[var(--sidebar-width)]"
      } flex-shrink-0 h-screen sticky top-0 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col transition-all duration-[var(--motion-normal)] ease-[var(--ease-standard)]`}
    >
      {/* ── Logo + Brand ── */}
      <div
        className={`flex items-center ${
          collapsed ? "justify-center px-2" : "px-5"
        } py-5`}
      >
        <Link href="/projects" className="flex items-center gap-3">
          {/* Neon logo mark */}
          <div className="w-8 h-8 rounded-lg bg-[var(--neon-green)] flex items-center justify-center flex-shrink-0">
            <Database className="w-4 h-4" style={{ color: "var(--accent-foreground)" }} strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-[14px] font-bold text-[var(--text-primary)] leading-none tracking-tight">
                neon
              </span>
              <span className="text-[9px] text-[var(--sidebar-text)] font-medium tracking-[0.04em] leading-none mt-0.5">
                platform
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {navSections.map((section) => (
          <SidebarSection
            key={section.title}
            section={section}
            pathname={pathname}
            collapsed={collapsed}
            onConnect={() => setConnectionOpen(true)}
          />
        ))}
        {isAdmin && (
          <SidebarSection
            section={adminSection}
            pathname={pathname}
            collapsed={collapsed}
            onConnect={() => setConnectionOpen(true)}
          />
        )}
      </nav>

      {/* ── Footer ── */}
      <div
        className={`border-t border-[var(--sidebar-border)] ${
          collapsed ? "px-2 py-3" : "px-3 py-3"
        }`}
      >
        {/* Help link */}
        {!collapsed && (
          <Link
            href="/docs"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)] transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Help & Support</span>
          </Link>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center ${
            collapsed ? "justify-center" : "justify-between"
          } px-3 py-2 rounded-lg text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)] transition-colors`}
        >
          {!collapsed && (
            <span className="flex items-center gap-2 text-[11px]">
              <PanelLeftClose className="w-4 h-4" />
              Collapse menu
            </span>
          )}
          <PanelLeftClose
            className={`w-4 h-4 transition-transform duration-150 ${
              collapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </aside>
    </>
  );
}
