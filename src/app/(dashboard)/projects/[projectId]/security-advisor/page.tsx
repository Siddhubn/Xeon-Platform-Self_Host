"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Lock,
  Unlock,
  Eye,
  Code2,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import CustomSelect from "@/components/CustomSelect";

interface SecurityFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  description: string;
  tableName: string | null;
  columnName: string | null;
  resolution: string;
  autoResolvable: boolean;
}

interface SecuritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

const SEVERITY_CONFIG = {
  critical: { color: "var(--status-error)", bg: "var(--status-error-bg)", icon: AlertTriangle, label: "Critical" },
  high: { color: "#f97316", bg: "rgba(249, 115, 22, 0.15)", icon: AlertCircle, label: "High" },
  medium: { color: "var(--status-idle)", bg: "var(--status-idle-bg)", icon: AlertCircle, label: "Medium" },
  low: { color: "var(--text-secondary)", bg: "var(--bg-inset)", icon: Info, label: "Low" },
  info: { color: "var(--status-info)", bg: "var(--status-info-bg)", icon: Info, label: "Info" },
} as const;

export default function SecurityAdvisorPage() {
  const { projectId, selectedBranchId } = useProject();

  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("postgres");

  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);

  const fetchDatabases = useCallback(async () => {
    if (!projectId || !selectedBranchId) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/databases?branchId=${selectedBranchId}`);
      const data = await res.json();
      const dbNames = (data.databases || []).map((d: any) => d.name);
      const allDbs = [...new Set(["postgres", ...dbNames])];
      setDatabases(allDbs);
      if (!allDbs.includes(selectedDatabase)) setSelectedDatabase(allDbs[0]);
    } catch {
      setDatabases(["postgres"]);
    }
  }, [projectId, selectedBranchId]);

  const runScan = useCallback(async () => {
    if (!projectId || !selectedBranchId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/data-api/security-advisor?projectId=${projectId}&branchId=${selectedBranchId}&databaseName=${selectedDatabase}`
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFindings(data.findings || []);
      setSummary(data.summary);
      setScannedAt(data.scannedAt);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedBranchId, selectedDatabase]);

  useEffect(() => { fetchDatabases(); }, [fetchDatabases]);
  useEffect(() => {
    if (projectId && selectedBranchId) runScan();
  }, [projectId, selectedBranchId, selectedDatabase]);

  const filteredFindings = severityFilter
    ? findings.filter((f) => f.severity === severityFilter)
    : findings;

  if (!projectId) {
    return (
      <div className="animate-page-enter px-4 py-3">
        <div className="space-y-4">
          <div className="h-8 w-48 rounded-lg bg-[var(--bg-inset)] animate-pulse" />
          <div className="h-64 rounded-xl bg-[var(--bg-inset)] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter px-4 py-3">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">Data API Security</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
          Security analysis and recommendations for your Data API configuration
        </p>
      </div>

      {/* Database Selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">Database</label>
            <CustomSelect
              value={selectedDatabase}
              options={databases.map((d) => ({ value: d, label: d }))}
              onChange={setSelectedDatabase}
              searchable
              className="w-[150px]"
            />
          </div>
          <button onClick={runScan} disabled={loading} className="neon-btn neon-btn-ghost neon-btn-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Re-scan
          </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-error-bg)] text-[var(--status-error)] text-[13px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-3 mb-6">
          {(["critical", "high", "medium", "low", "info"] as const).map((sev) => {
            const cfg = SEVERITY_CONFIG[sev];
            const Icon = cfg.icon;
            const count = summary[sev];
            return (
              <button
                key={sev}
                onClick={() => setSeverityFilter(severityFilter === sev ? null : sev)}
                className={`p-4 rounded-xl border transition-all ${
                  severityFilter === sev
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  <span className="text-[11px] font-medium uppercase" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
                <div className="text-[24px] font-bold" style={{ color: cfg.color }}>
                  {count}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Scan info */}
      {scannedAt && (
        <p className="text-[12px] text-[var(--text-tertiary)] mb-4">
          Last scanned: {new Date(scannedAt).toLocaleString()} · {summary?.total || 0} finding(s) detected
        </p>
      )}

      {/* Findings List */}
      <div className="space-y-3">
        {loading ? (
          <div className="border border-[var(--border-default)] rounded-xl bg-[var(--bg-surface)] p-8 text-center">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[var(--text-tertiary)]" />
            <p className="text-[13px] text-[var(--text-tertiary)]">Running security scan...</p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="border border-[var(--border-default)] rounded-xl bg-[var(--bg-surface)] p-8 text-center">
            <Shield className="w-8 h-8 mx-auto mb-2 text-[var(--status-active)]" />
            <p className="text-[14px] font-medium text-[var(--text-primary)]">
              {summary?.total === 0 ? "No security issues found" : "No findings match the selected filter"}
            </p>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-1">
              {summary?.total === 0
                ? "Your database appears to be well-configured for Data API access."
                : "Try selecting a different severity filter."}
            </p>
          </div>
        ) : (
          filteredFindings.map((finding) => {
            const cfg = SEVERITY_CONFIG[finding.severity];
            const Icon = cfg.icon;
            const isExpanded = expandedFinding === finding.id;

            return (
              <div
                key={finding.id}
                className="border border-[var(--border-default)] rounded-xl bg-[var(--bg-surface)] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-[12px] text-[var(--text-tertiary)]">{finding.category}</span>
                    </div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)] mt-1 truncate">
                      {finding.title}
                    </p>
                  </div>
                  {finding.tableName && (
                    <span className="text-[11px] font-mono text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-2 py-1 rounded hidden md:block">
                      {finding.tableName}
                      {finding.columnName ? `.${finding.columnName}` : ""}
                    </span>
                  )}
                  <ChevronRight className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--border-default)] pt-3">
                    <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-3">
                      {finding.description}
                    </p>
                    {finding.resolution && (
                      <div className="p-3 rounded-lg bg-[var(--bg-inset)]">
                        <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase mb-1">
                          Recommended Resolution
                        </p>
                        <pre className="text-[12px] font-mono text-[var(--text-primary)] whitespace-pre-wrap">
                          {finding.resolution}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
