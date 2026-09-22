"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Users, Settings, HelpCircle, PanelLeftClose, Building2 } from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Projects", href: "/projects", icon: Database },
  { label: "Organisations", href: "/organisations", icon: Building2 },
  { label: "People", href: "/people", icon: Users },
  { label: "Account Settings", href: "/account", icon: Settings },
];

export default function GlobalSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) => {
    if (href === "/projects") {
      return pathname === "/projects" || pathname.startsWith("/projects");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      className={`${
        collapsed ? "w-[52px]" : "w-[var(--sidebar-width)]"
      } flex-shrink-0 h-screen sticky top-0 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col transition-all duration-[var(--motion-normal)] ease-[var(--ease-standard)]`}
    >
      {/* Logo */}
      <div
        className={`flex items-center ${
          collapsed ? "justify-center px-2" : "px-5"
        } py-5`}
      >
        <Link href="/projects" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--neon-green)] flex items-center justify-center flex-shrink-0">
            <Database
              className="w-4 h-4"
              style={{ color: "var(--accent-foreground)" }}
              strokeWidth={2.5}
            />
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                  : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text-hover)]"
              }`}
            >
              <Icon
                className={`w-[16px] h-[16px] flex-shrink-0 ${
                  active ? "text-[var(--neon-green)]" : ""
                }`}
              />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {active && !collapsed && (
                <div className="w-1 h-1 rounded-full bg-[var(--neon-green)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={`border-t border-[var(--sidebar-border)] ${
          collapsed ? "px-2 py-3" : "px-3 py-3"
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
  );
}
