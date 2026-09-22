"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "@/lib/project-context";
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
  Link as LinkIcon,
  Shield,
  Globe,
  Lock,
  EyeOff,
  Download,
  BarChart3,
  ArrowLeft,
  Search,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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

function getNavSections(projectId: string): NavSection[] {
  const p = `/projects/${projectId}`;
  return [
    {
      title: "PROJECT",
      items: [
        { label: "Dashboard", href: `${p}/dashboard`, icon: LayoutGrid },
        { label: "Branches", href: `${p}/branches`, icon: GitBranch },
        { label: "Monitoring", href: `${p}/monitoring`, icon: BarChart3 },
        { label: "Resources", href: `${p}/resources`, icon: Server },
        { label: "Settings", href: `${p}/settings`, icon: Settings },
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
        { label: "Tables", href: `${p}/data`, icon: Table },
        { label: "SQL Editor", href: `${p}/sql-editor`, icon: Code2 },
        { label: "Compute", href: `${p}/compute`, icon: Cpu },
        { label: "Roles", href: `${p}/roles`, icon: Users },
        { label: "Databases", href: `${p}/databases`, icon: HardDrive },
        { label: "Backup & Restore", href: `${p}/backups`, icon: Shield },
        { label: "Import Data", href: `${p}/import-data`, icon: Download },
        { label: "Data API", href: `${p}/data-api`, icon: Globe },
        { label: "Data Anonymization", href: `${p}/data-anonymization`, icon: Lock },
        { label: "Security Advisor", href: `${p}/security-advisor`, icon: EyeOff },
        { label: "Nodes", href: `${p}/nodes`, icon: Server },
      ],
      defaultOpen: true,
    },
  ];
}

function BranchSelector({ collapsed }: { collapsed: boolean }) {
  const { branches, branchesLoading, selectedBranch, selectBranch } = useProject();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-branch-dropdown]")) {
        closeDropdown();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dropdownOpen, closeDropdown]);

  const openDropdown = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
    setDropdownOpen(true);
  };

  if (collapsed) {
    return (
      <div className="px-2">
        <Link
          href={`/projects/${""}branches`}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)] transition-all duration-150"
          title={selectedBranch?.name || "Branches"}
        >
          <GitBranch className="w-[18px] h-[18px]" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 mb-1.5" data-branch-dropdown>
      <button
        ref={buttonRef}
        onClick={() => dropdownOpen ? setDropdownOpen(false) : openDropdown()}
        className="w-full flex items-center gap-2 px-3 py-[7px] rounded-lg text-[13px] font-medium text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)] transition-all duration-150"
      >
        <GitBranch className="w-[16px] h-[16px] flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {branchesLoading ? "Loading..." : selectedBranch?.name || "Select branch"}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 ${
            dropdownOpen ? "" : "-rotate-90"
          }`}
        />
      </button>
      {dropdownOpen && typeof document !== "undefined" && createPortal(
        <div
          className="rounded-lg py-1 bg-[var(--bg-surface)] border border-[var(--border-default)] max-h-[250px] overflow-y-auto shadow-lg"
          data-branch-dropdown
          style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }}
        >
          {branchesLoading ? (
            <div className="px-3 py-2 text-[12px] text-[var(--text-tertiary)] text-center">
              Loading branches...
            </div>
          ) : branches.length === 0 ? (
            <div className="px-3 py-2 text-[12px] text-[var(--text-tertiary)] text-center">
              No branches found
            </div>
          ) : (
            branches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => {
                  selectBranch(branch.id);
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-[6px] text-[12px] transition-colors ${
                  selectedBranch?.id === branch.id
                    ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                    : "text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)]"
                }`}
              >
                <GitBranch className="w-3 h-3" />
                <span className="flex-1 text-left truncate">{branch.name}</span>
                {branch.isPrimary && (
                  <span className="text-[10px] text-[var(--text-tertiary)] font-medium">default</span>
                )}
                {selectedBranch?.id === branch.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)] flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
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
    return pathname === href || pathname.startsWith(href + "/");
  };

  if (section.title === "BRANCH") {
    return (
      <div className="mb-1.5">
        {!collapsed && (
          <div className="px-3 py-1.5">
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
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 ${
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
    <div>
      <div className="flex items-center justify-between px-3 py-1.5">
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
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--neon-green)] text-[var(--accent-foreground)] text-[10px] font-semibold hover:bg-[var(--neon-green-hover)] transition-colors"
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
                className={`flex items-center gap-2.5 px-3 py-[5px] rounded-lg text-[12px] font-medium transition-all duration-150 group ${
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

export default function ProjectSidebar() {
  const pathname = usePathname();
  const { project, projectId } = useProject();
  const [collapsed, setCollapsed] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);

  if (!projectId) return null;

  const navSections = getNavSections(projectId);

  return (
    <>
      <ConnectionDialog
        open={connectionOpen}
        onClose={() => setConnectionOpen(false)}
      />
      <aside
        className={`${
          collapsed ? "w-[52px]" : "w-[var(--sidebar-width)]"
        } flex-shrink-0 h-screen sticky top-0 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col transition-all duration-[var(--motion-normal)] ease-[var(--ease-standard)]`}
      >
        {/* Back to Projects + Project Name */}
        <div className={`${collapsed ? "px-2 pt-2 pb-1" : "px-3 pt-2.5 pb-2"}`}>
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors px-2 py-1 rounded hover:bg-[var(--sidebar-hover)] w-fit mb-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {!collapsed && <span>Projects</span>}
          </Link>
          {!collapsed && project && (
            <div className="flex items-center gap-2 px-2">
              <div className="w-5 h-5 rounded bg-[var(--neon-green)] flex items-center justify-center flex-shrink-0">
                <Database
                  className="w-2.5 h-2.5"
                  style={{ color: "var(--accent-foreground)" }}
                  strokeWidth={2.5}
                />
              </div>
              <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                {project.name}
              </p>
            </div>
          )}
          {collapsed && (
            <Link
              href="/projects"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-all"
              title="Back to Projects"
            >
              <Database className="w-[18px] h-[18px]" />
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-1 space-y-px">
          {navSections.map((section) => (
            <SidebarSection
              key={section.title}
              section={section}
              pathname={pathname}
              collapsed={collapsed}
              onConnect={() => setConnectionOpen(true)}
            />
          ))}
        </nav>

        {/* Footer */}
        <div
          className={`border-t border-[var(--sidebar-border)] ${
            collapsed ? "px-2 py-2" : "px-3 py-2"
          }`}
        >
          {!collapsed && (
            <Link
              href="/docs"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)] transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Help & Support</span>
            </Link>
          )}
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
