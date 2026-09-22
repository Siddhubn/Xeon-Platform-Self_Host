"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/lib/org-context";
import { Activity, Shield, User, Building2, Database, GitBranch, Key, LogIn, LogOut } from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  resourceName: string | null;
  details: string | null;
  createdAt: string | null;
  userId: string;
  userName: string;
  userEmail: string;
}

function getActionIcon(action: string) {
  if (action.includes("user")) return <User className="w-3.5 h-3.5" />;
  if (action.includes("organization")) return <Building2 className="w-3.5 h-3.5" />;
  if (action.includes("project")) return <Database className="w-3.5 h-3.5" />;
  if (action.includes("branch")) return <GitBranch className="w-3.5 h-3.5" />;
  if (action.includes("login") || action.includes("session")) return <LogIn className="w-3.5 h-3.5" />;
  if (action.includes("role")) return <Key className="w-3.5 h-3.5" />;
  return <Activity className="w-3.5 h-3.5" />;
}

function formatAction(action: string): string {
  return action.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDetails(details: string | null): string {
  if (!details) return "";
  try {
    const parsed = JSON.parse(details);
    const parts: string[] = [];
    if (parsed.email) parts.push(parsed.email);
    if (parsed.role) parts.push(`Role: ${parsed.role}`);
    if (parsed.orgRole) parts.push(`Org Role: ${parsed.orgRole}`);
    return parts.join(" · ") || details;
  } catch {
    return details;
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminActivityPage() {
  const { organization, isAdmin } = useOrganization();
  const [logs, setLogs] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!organization) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/activity");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [organization]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (!isAdmin) {
    return (
      <div className="animate-page-enter max-w-[1200px]">
        <div className="neon-card p-12 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="text-[16px] font-semibold mb-1">Access Denied</h3>
          <p className="text-[13px] text-[var(--text-secondary)]">
            You need administrator privileges to view activity logs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter max-w-[1200px]">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">Activity Log</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
          Track user and system activity in {organization?.name}
        </p>
      </div>

      <div className="neon-card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin-slow mx-auto" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-[13px] text-[var(--text-secondary)]">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-default)]">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-4 hover:bg-[var(--bg-hover)] transition-colors">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] flex items-center justify-center flex-shrink-0" style={{ color: "var(--accent)" }}>
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px]">
                    <span className="font-medium">{log.userName}</span>{" "}
                    <span className="text-[var(--text-secondary)]">{formatAction(log.action)}</span>
                    {log.resourceName && (
                      <span className="font-medium"> {log.resourceName}</span>
                    )}
                  </p>
                  {log.details && formatDetails(log.details) && (
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {formatDetails(log.details)}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap flex-shrink-0">
                  {timeAgo(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
