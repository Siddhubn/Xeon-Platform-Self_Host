"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Code2,
  Trash2,
  Square,
} from "lucide-react";
import { SqlEditorSkeleton } from "@/components/Skeleton";
import {
  useProjects,
  useBranches,
} from "@/components/ProjectBranchSelector";
import CustomSelect from "@/components/CustomSelect";

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
  demoMode?: boolean;
}

interface HistoryEntry {
  query: string;
  time: string;
  duration: number;
  rowCount: number;
  error?: string;
}

export default function SQLEditorPage() {
  const { projects, loading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { branches, loading: branchesLoading } = useBranches(selectedProjectId);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("postgres");
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("cloud_admin");

  const [query, setQuery] = useState("SELECT version();");
  const [results, setResults] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-select first project
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Auto-select first branch
  useEffect(() => {
    if (selectedProjectId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedProjectId, branches, selectedBranchId]);

  // Fetch databases for current branch
  const fetchDatabases = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId) return;
    try {
      const res = await fetch(
        `/api/projects/${selectedProjectId}/databases?branchId=${selectedBranchId}`
      );
      const data = await res.json();
      const dbNames = (data.databases || []).map((d: any) => d.name);
      // Always include 'postgres' as it's the default database on the running endpoint
      const allDbs = [...new Set(["postgres", ...dbNames])];
      setDatabases(allDbs);
      if (!allDbs.includes(selectedDatabase)) {
        setSelectedDatabase(allDbs[0]);
      }
    } catch {
      setDatabases(["postgres"]);
    }
  }, [selectedProjectId, selectedBranchId, selectedDatabase]);

  // Fetch roles for current branch
  const fetchRoles = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId) return;
    try {
      const res = await fetch(
        `/api/projects/${selectedProjectId}/roles?branchId=${selectedBranchId}`
      );
      const data = await res.json();
      const roleNames = (data.roles || []).map((r: any) => r.name);
      // Always include 'cloud_admin' as it's the default role on the running endpoint
      const allRoles = [...new Set(["cloud_admin", ...roleNames])];
      setRoles(allRoles);
      if (!allRoles.includes(selectedRole)) {
        setSelectedRole(allRoles[0]);
      }
    } catch {
      setRoles(["cloud_admin"]);
    }
  }, [selectedProjectId, selectedBranchId, selectedRole]);

  useEffect(() => {
    fetchDatabases();
    fetchRoles();
  }, [fetchDatabases, fetchRoles]);

  const runQuery = async () => {
    if (!query.trim() || !selectedProjectId || !selectedBranchId) return;
    setRunning(true);
    setError("");
    setResults(null);

    try {
      const res = await fetch("/api/sql/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          branchId: selectedBranchId,
          database: selectedDatabase,
          role: selectedRole,
          sql: query,
        }),
      });
      const data = await res.json();

      if (data.error && (!data.columns || data.columns.length === 0)) {
        setError(data.error);
        setResults(null);
      } else {
        setResults(data);
        if (data.error) setError(data.error);
        // Check if this is demo mode
        if (data.error && data.error.includes("Demo Mode")) {
          setResults({ ...data, demoMode: true });
        }
      }

      setHistory([
        {
          query: query.substring(0, 200),
          time: new Date().toLocaleTimeString(),
          duration: data.executionTimeMs || 0,
          rowCount: data.rowCount || 0,
          error: data.error,
        },
        ...history.slice(0, 49),
      ]);
    } catch {
      setError("Failed to execute query. Check your connection settings.");
    } finally {
      setRunning(false);
    }
  };

  // Ctrl+Enter to run
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runQuery();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [query, selectedProjectId, selectedBranchId, selectedDatabase, selectedRole]);

  if (projectsLoading) {
    return <SqlEditorSkeleton />;
  }

  return (
    <div
      className="animate-page-enter flex flex-col"
      style={{ height: "calc(100vh - 8rem)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">SQL Editor</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Run queries against your PostgreSQL database
          </p>
        </div>
        <span className="text-[11px] text-[var(--text-tertiary)]">
          Press{" "}
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--border-default)] bg-[var(--bg-inset)] font-mono text-[10px]">
            ⌘ Enter
          </kbd>{" "}
          to run
        </span>
      </div>

      {/* Connection Settings Bar */}
      {projects.length > 0 && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {/* Project */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">
              Project
            </label>
            <CustomSelect
              value={selectedProjectId || ""}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(val) => { setSelectedProjectId(val); setSelectedBranchId(null); }}
              searchable
              className="w-[180px]"
            />
          </div>

          {/* Branch */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">
              Branch
            </label>
            <CustomSelect
              value={selectedBranchId || ""}
              options={branches.map((b) => ({ value: b.id, label: `${b.name}${b.isPrimary ? " (main)" : ""}` }))}
              onChange={setSelectedBranchId}
              disabled={branchesLoading}
              searchable
              className="w-[180px]"
            />
          </div>

          {/* Database */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">
              Database
            </label>
            <CustomSelect
              value={selectedDatabase}
              options={databases.map((d) => ({ value: d, label: d }))}
              onChange={setSelectedDatabase}
              searchable
              className="w-[150px]"
            />
          </div>

          {/* Role */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">
              Role
            </label>
            <CustomSelect
              value={selectedRole}
              options={roles.map((r) => ({ value: r, label: r }))}
              onChange={setSelectedRole}
              searchable
              className="w-[150px]"
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-0 min-h-0">
        {/* Main editor area */}
        <div className="flex-1 flex flex-col min-w-0 border border-[var(--border-default)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-default)] bg-[var(--bg-inset)]">
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
              <Code2 className="w-3.5 h-3.5" />
              Query Editor
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(query);
                }}
                className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                title="Copy query"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {running ? (
                <button
                  onClick={() => setRunning(false)}
                  className="neon-btn neon-btn-danger neon-btn-sm"
                >
                  <Square className="w-3 h-3" />
                  Cancel
                </button>
              ) : (
                <button
                  onClick={runQuery}
                  disabled={!query.trim() || !selectedBranchId}
                  className="neon-btn neon-btn-primary neon-btn-sm"
                >
                  <Play className="w-3 h-3" />
                  Run
                </button>
              )}
            </div>
          </div>

          {/* Query textarea */}
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 w-full p-4 bg-transparent text-[13px] font-mono resize-none focus:outline-none leading-relaxed text-[var(--text-primary)]"
            placeholder="Enter your SQL query..."
            spellCheck={false}
          />

          {/* Results area */}
          <div
            className="border-t border-[var(--border-default)]"
            style={{ height: results || error ? "40%" : "0" }}
          >
            {error && !results ? (
              <div className="p-4 flex items-center gap-2 text-[13px] text-[var(--status-error)] bg-[var(--status-error-bg)]">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            ) : results ? (
              <div className="h-full flex flex-col">
                {results.demoMode && (
                  <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-[12px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      <strong>Demo Mode:</strong> PostgreSQL is unreachable. Queries run against metadata only. Start the database server with <code className="bg-amber-100 px-1 rounded">neon_local endpoint start</code> for full functionality.
                    </span>
                  </div>
                )}
                <div className="px-4 py-2 border-b border-[var(--border-default)] flex items-center gap-4 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-inset)]">
                  <span className="font-medium">
                    {results.rowCount} row{results.rowCount !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {results.executionTimeMs}ms
                  </span>
                  {results.error && (
                    <span className="text-[var(--status-error)]">{results.error}</span>
                  )}
                </div>
                <div className="flex-1 overflow-auto">
                  {results.columns.length > 0 ? (
                    <table className="neon-table">
                      <thead>
                        <tr>
                          {results.columns.map((col) => (
                            <th key={col} className="text-left font-mono text-[11px]">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.rows.map((row, ri) => (
                          <tr key={ri}>
                            {results.columns.map((col) => (
                              <td key={col} className="font-mono text-[12px]">
                                {String(row[col] ?? "NULL")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-4 text-[13px] text-[var(--text-secondary)]">
                      Query executed successfully. {results.rowCount} row(s) affected.
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* History sidebar */}
        <div className="w-[240px] flex-shrink-0 ml-0 border border-[var(--border-default)] border-l-0 rounded-r-xl overflow-hidden bg-[var(--bg-surface)] hidden lg:flex flex-col">
          <div className="px-4 py-2.5 border-b border-[var(--border-default)] bg-[var(--bg-inset)] flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
              History
            </span>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {history.length === 0 ? (
              <p className="text-[12px] text-[var(--text-tertiary)] text-center py-8">
                No queries yet
              </p>
            ) : (
              history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(h.query)}
                  className="w-full text-left p-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group"
                >
                  <p
                    className={`text-[11px] font-mono truncate ${
                      h.error
                        ? "text-[var(--status-error)]"
                        : "text-[var(--text-primary)] group-hover:text-[var(--neon-green)]"
                    }`}
                  >
                    {h.query}
                  </p>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                    {h.time} · {h.duration}ms · {h.rowCount} rows
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
