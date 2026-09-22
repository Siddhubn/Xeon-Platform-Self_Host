"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  Shield,
  Key,
  RefreshCw,
  Copy,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Zap,
  Code2,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Copy as CopyIcon,
  BookOpen,
  Settings,
} from "lucide-react";
import {
  useProjects,
  useBranches,
} from "@/components/ProjectBranchSelector";
import CustomSelect from "@/components/CustomSelect";

interface DataApiConfig {
  id: string;
  projectId: string;
  branchId: string;
  databaseName: string;
  enabled: boolean;
  baseUrl: string | null;
  authMode: string;
  jwtSecret: string | null;
  jwksUrl: string | null;
  anonymousAccess: boolean;
  allowedSchemas: string | null;
  defaultSchema: string | null;
  apiRoles: string | null;
  corsOrigins: string | null;
  publicSchemaAccess: boolean;
  schemaCacheLastRefreshed: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SchemaInfo {
  tables: Array<{ schemaName: string; tableName: string; tableType: string }>;
  columns: Array<{ schemaName: string; tableName: string; columnName: string; dataType: string; isNullable?: boolean }>;
  functions: Array<{ functionName: string; returnType: string }>;
  refreshedAt: string;
}

export default function DataApiPage() {
  const { projects, loading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { branches, loading: branchesLoading } = useBranches(selectedProjectId);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("postgres");

  const [config, setConfig] = useState<DataApiConfig | null>(null);
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Config form state
  const [authMode, setAuthMode] = useState("jwt");
  const [jwtSecret, setJwtSecret] = useState("");
  const [jwksUrl, setJwksUrl] = useState("");
  const [anonymousAccess, setAnonymousAccess] = useState(false);
  const [allowedSchemas, setAllowedSchemas] = useState("public");
  const [defaultSchema, setDefaultSchema] = useState("public");
  const [corsOrigins, setCorsOrigins] = useState("*");

  // Docs tab state
  const [activeTab, setActiveTab] = useState<"overview" | "docs" | "schema" | "settings">("overview");
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

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

  // Fetch databases
  const fetchDatabases = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId) return;
    try {
      const res = await fetch(
        `/api/projects/${selectedProjectId}/databases?branchId=${selectedBranchId}`
      );
      const data = await res.json();
      const dbNames = (data.databases || []).map((d: any) => d.name);
      const allDbs = [...new Set(["postgres", ...dbNames])];
      setDatabases(allDbs);
      if (!allDbs.includes(selectedDatabase)) {
        setSelectedDatabase(allDbs[0]);
      }
    } catch {
      setDatabases(["postgres"]);
    }
  }, [selectedProjectId, selectedBranchId]);

  // Fetch Data API config
  const fetchConfig = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId || !selectedDatabase) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/data-api/config?projectId=${selectedProjectId}&branchId=${selectedBranchId}`
      );
      const data = await res.json();
      const cfg = data.configs?.find(
        (c: DataApiConfig) => c.databaseName === selectedDatabase
      );
      setConfig(cfg || null);
      if (cfg) {
        setAuthMode(cfg.authMode);
        setJwksUrl(cfg.jwksUrl || "");
        setAnonymousAccess(cfg.anonymousAccess);
        setAllowedSchemas(cfg.allowedSchemas || "public");
        setDefaultSchema(cfg.defaultSchema || "public");
        setCorsOrigins(cfg.corsOrigins || "*");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, selectedBranchId, selectedDatabase]);

  // Fetch schema
  const fetchSchema = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId || !config?.enabled) return;
    try {
      const res = await fetch(
        `/api/data-api/schema?projectId=${selectedProjectId}&branchId=${selectedBranchId}&databaseName=${selectedDatabase}`
      );
      const data = await res.json();
      setSchema(data);
    } catch {
      // ignore
    }
  }, [selectedProjectId, selectedBranchId, selectedDatabase, config?.enabled]);

  useEffect(() => { fetchDatabases(); }, [fetchDatabases]);
  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => { fetchSchema(); }, [fetchSchema]);

  // Enable Data API
  const handleEnable = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/data-api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          branchId: selectedBranchId,
          databaseName: selectedDatabase,
          enabled: true,
          authMode,
          jwtSecret: jwtSecret || undefined,
          jwksUrl: jwksUrl || undefined,
          anonymousAccess,
          allowedSchemas,
          defaultSchema,
          corsOrigins,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(data.config);
      setSuccess("Data API enabled successfully");
      fetchSchema();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Disable Data API
  const handleDisable = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await fetch(`/api/data-api/config?id=${config.id}`, { method: "DELETE" });
      setConfig({ ...config, enabled: false });
      setSuccess("Data API disabled");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Update config
  const handleUpdateConfig = async () => {
    if (!config) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/data-api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          branchId: selectedBranchId,
          databaseName: selectedDatabase,
          authMode,
          jwtSecret: jwtSecret || undefined,
          jwksUrl: jwksUrl || undefined,
          anonymousAccess,
          allowedSchemas,
          defaultSchema,
          corsOrigins,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(data.config);
      setSuccess("Configuration updated");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Refresh schema cache
  const handleRefreshSchema = async () => {
    setSaving(true);
    try {
      await fetchSchema();
      // Update the last refreshed timestamp
      if (config) {
        const res = await fetch("/api/data-api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: selectedProjectId,
            branchId: selectedBranchId,
            databaseName: selectedDatabase,
          }),
        });
        const data = await res.json();
        if (data.config) setConfig(data.config);
      }
      setSuccess("Schema cache refreshed");
    } catch {
      setError("Failed to refresh schema cache");
    } finally {
      setSaving(false);
    }
  };

  const getApiUrl = () => {
    if (typeof window === "undefined") return "";
    const host = window.location.origin;
    return `${host}/api/data-api/proxy/${selectedProjectId}/${selectedBranchId}/${selectedDatabase}`;
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(getApiUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (projectsLoading) {
    return (
      <div className="animate-page-enter">
        <div className="space-y-4">
          <div className="h-8 w-48 rounded-lg bg-[var(--bg-inset)] animate-pulse" />
          <div className="h-4 w-96 rounded bg-[var(--bg-inset)] animate-pulse" />
          <div className="h-64 rounded-xl bg-[var(--bg-inset)] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">Data API</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
          Access your PostgreSQL database through a REST-compatible HTTP API
        </p>
      </div>

      {/* Selector Bar */}
      {projects.length > 0 && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">Project</label>
            <CustomSelect
              value={selectedProjectId || ""}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              onChange={(val) => { setSelectedProjectId(val); setSelectedBranchId(null); }}
              searchable
              className="w-[180px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">Branch</label>
            <CustomSelect
              value={selectedBranchId || ""}
              options={branches.map((b) => ({ value: b.id, label: `${b.name}${b.isPrimary ? " (main)" : ""}` }))}
              onChange={setSelectedBranchId}
              disabled={branchesLoading}
              searchable
              className="w-[180px]"
            />
          </div>
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
        </div>
      )}

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-error-bg)] text-[var(--status-error)] text-[13px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto text-[var(--status-error)] hover:opacity-70">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-active-bg)] text-[var(--status-active)] text-[13px] flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess("")} className="ml-auto text-[var(--status-active)] hover:opacity-70">✕</button>
        </div>
      )}

      {/* Status Card */}
      <div className="border border-[var(--border-default)] rounded-xl bg-[var(--bg-surface)] overflow-hidden mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${config?.enabled ? "bg-[var(--status-active)]" : "bg-[var(--text-tertiary)]"}`} />
              <div>
                <h2 className="text-[15px] font-semibold">Status</h2>
                <p className="text-[13px] text-[var(--text-secondary)]">
                  {config?.enabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {config?.enabled ? (
                <button
                  onClick={handleDisable}
                  disabled={saving}
                  className="neon-btn neon-btn-danger neon-btn-sm"
                >
                  <ToggleRight className="w-3.5 h-3.5" />
                  Disable Data API
                </button>
              ) : (
                <button
                  onClick={handleEnable}
                  disabled={saving}
                  className="neon-btn neon-btn-primary"
                >
                  <ToggleLeft className="w-3.5 h-3.5" />
                  Enable Data API
                </button>
              )}
            </div>
          </div>

          {!config?.enabled && (
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              The Data API allows authorized applications to access your PostgreSQL database through a
              REST-compatible HTTP API. When enabled, you can query tables, views, and functions using
              standard HTTP methods (GET, POST, PATCH, DELETE).
            </p>
          )}
        </div>

        {/* Enabled state details */}
        {config?.enabled && (
          <div className="border-t border-[var(--border-default)]">
            {/* Tabs */}
            <div className="flex border-b border-[var(--border-default)]">
              {[
                { key: "overview", label: "Overview", icon: Globe },
                { key: "docs", label: "API Docs", icon: BookOpen },
                { key: "schema", label: "Schema", icon: Code2 },
                { key: "settings", label: "Settings", icon: Settings },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                    activeTab === key
                      ? "border-[var(--accent)] text-[var(--text-primary)]"
                      : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* API URL */}
                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase mb-2 block">
                      API URL
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-inset)] text-[13px] font-mono text-[var(--text-primary)] truncate border border-[var(--border-default)]">
                        {getApiUrl()}
                      </code>
                      <button
                        onClick={copyUrl}
                        className="neon-btn neon-btn-ghost neon-btn-sm"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Quick example */}
                  <div>
                    <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase mb-2 block">
                      Quick Example
                    </label>
                    <pre className="px-4 py-3 rounded-lg bg-[var(--bg-inset)] text-[12px] font-mono text-[var(--text-primary)] overflow-x-auto border border-[var(--border-default)]">
{`curl -H "Authorization: Bearer YOUR_TOKEN" \\
  "${getApiUrl()}/your_table?select=*"`}
                    </pre>
                  </div>

                  {/* Info boxes */}
                  <div className="p-4 rounded-lg bg-[var(--status-info-bg)] text-[13px] flex items-start gap-3">
                    <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--status-info)]" />
                    <div className="text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">Security:</strong> Data API security depends on PostgreSQL
                      permissions and Row Level Security policies. Enabling the Data API does not automatically
                      make a database safe for public access.
                    </div>
                  </div>

                  {/* Schema cache */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[13px] font-medium">Schema Cache</h3>
                      <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
                        Last refreshed: {schema?.refreshedAt
                          ? new Date(schema.refreshedAt).toLocaleString()
                          : "Never"}
                      </p>
                    </div>
                    <button
                      onClick={handleRefreshSchema}
                      disabled={saving}
                      className="neon-btn neon-btn-ghost neon-btn-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${saving ? "animate-spin" : ""}`} />
                      Refresh Schema Cache
                    </button>
                  </div>
                </div>
              )}

              {/* Docs Tab */}
              {activeTab === "docs" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[14px] font-semibold mb-2">Authentication</h3>
                    <p className="text-[13px] text-[var(--text-secondary)] mb-3">
                      Include a Bearer token in the Authorization header:
                    </p>
                    <pre className="px-4 py-3 rounded-lg bg-[var(--bg-inset)] text-[12px] font-mono text-[var(--text-primary)] border border-[var(--border-default)]">
{`Authorization: Bearer <your-jwt-token>`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold mb-2">Available Methods</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { method: "GET", desc: "Read data from a table or view", color: "text-emerald-400" },
                        { method: "POST", desc: "Insert new rows into a table", color: "text-blue-400" },
                        { method: "PATCH", desc: "Update existing rows", color: "text-amber-400" },
                        { method: "DELETE", desc: "Delete rows from a table", color: "text-red-400" },
                      ].map(({ method, desc, color }) => (
                        <div key={method} className="p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-inset)]">
                          <code className={`text-[13px] font-bold ${color}`}>{method}</code>
                          <p className="text-[12px] text-[var(--text-tertiary)] mt-1">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold mb-2">Query Parameters</h3>
                    <div className="space-y-2">
                      {[
                        { param: "select", desc: "Columns to return (e.g., ?select=id,name)" },
                        { param: "order", desc: "Order results (e.g., ?order=name.asc)" },
                        { param: "limit", desc: "Limit rows returned (e.g., ?limit=10)" },
                        { param: "offset", desc: "Offset for pagination (e.g., ?offset=20)" },
                        { param: "column=eq.value", desc: "Filter by equality" },
                        { param: "column=gt.value", desc: "Filter greater than" },
                        { param: "column=like.value", desc: "Filter with LIKE pattern" },
                        { param: "column=in.(v1,v2)", desc: "Filter with IN list" },
                      ].map(({ param, desc }) => (
                        <div key={param} className="flex items-center gap-3 text-[12px]">
                          <code className="font-mono text-[var(--text-primary)] bg-[var(--bg-inset)] px-2 py-0.5 rounded">{param}</code>
                          <span className="text-[var(--text-tertiary)]">{desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold mb-2">Code Examples</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[12px] text-[var(--text-tertiary)] mb-1">cURL</p>
                        <pre className="px-4 py-3 rounded-lg bg-[var(--bg-inset)] text-[12px] font-mono text-[var(--text-primary)] overflow-x-auto border border-[var(--border-default)]">
{`curl -H "Authorization: Bearer TOKEN" \\
  "${getApiUrl()}/users?select=id,name,email"`}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[12px] text-[var(--text-tertiary)] mb-1">JavaScript / TypeScript</p>
                        <pre className="px-4 py-3 rounded-lg bg-[var(--bg-inset)] text-[12px] font-mono text-[var(--text-primary)] overflow-x-auto border border-[var(--border-default)]">
{`const res = await fetch(
  "${getApiUrl()}/users?select=id,name,email",
  { headers: { Authorization: "Bearer TOKEN" } }
);
const data = await res.json();
console.log(data);`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Schema Tab */}
              {activeTab === "schema" && (
                <div className="space-y-4">
                  {!schema ? (
                    <div className="text-center py-8 text-[var(--text-tertiary)] text-[13px]">
                      <Code2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Loading schema information...
                    </div>
                  ) : schema.tables.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-tertiary)] text-[13px]">
                      <Code2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No tables found. The database may be empty or PostgreSQL may be unreachable.
                    </div>
                  ) : (
                    <>
                      <p className="text-[12px] text-[var(--text-tertiary)]">
                        {schema.tables.length} table(s)/view(s) · {schema.columns.length} columns · {schema.functions?.length || 0} functions
                      </p>
                      {schema.tables.map((t) => {
                        const tableColumns = schema.columns.filter(
                          (c) => c.tableName === t.tableName && c.schemaName === t.schemaName
                        );
                        const isExpanded = expandedTable === `${t.schemaName}.${t.tableName}`;
                        return (
                          <div key={`${t.schemaName}.${t.tableName}`} className="border border-[var(--border-default)] rounded-lg overflow-hidden">
                            <button
                              onClick={() =>
                                setExpandedTable(isExpanded ? null : `${t.schemaName}.${t.tableName}`)
                              }
                              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              <span className="text-[13px] font-medium font-mono">{t.tableName}</span>
                              <span className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-inset)] px-2 py-0.5 rounded">
                                {t.tableType}
                              </span>
                              <span className="text-[11px] text-[var(--text-tertiary)] ml-auto">
                                {tableColumns.length} columns
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="border-t border-[var(--border-default)]">
                                <table className="neon-table">
                                  <thead>
                                    <tr>
                                      <th className="text-left">Column</th>
                                      <th className="text-left">Type</th>
                                      <th className="text-left">Nullable</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tableColumns.map((col) => (
                                      <tr key={col.columnName}>
                                        <td className="font-mono text-[12px]">{col.columnName}</td>
                                        <td className="text-[12px] text-[var(--text-secondary)]">{col.dataType}</td>
                                        <td className="text-[12px]">{col.isNullable ? "Yes" : "No"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && (
                <div className="space-y-6 max-w-xl">
                  <div>
                    <label className="text-[13px] font-medium mb-2 block">Authentication Mode</label>
                    <CustomSelect
                      value={authMode}
                      options={[
                        { value: "jwt", label: "JWT Authentication" },
                        { value: "api_key", label: "API Key" },
                      ]}
                      onChange={setAuthMode}
                      className="w-full"
                    />
                  </div>

                  {authMode === "jwt" && (
                    <div>
                      <label className="text-[13px] font-medium mb-2 block">JWT Secret</label>
                      <div className="flex items-center gap-2">
                        <input
                          type={showSecret ? "text" : "password"}
                          value={jwtSecret}
                          onChange={(e) => setJwtSecret(e.target.value)}
                          placeholder="Enter JWT secret (leave empty to auto-generate)"
                          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                        />
                        <button
                          onClick={() => setShowSecret(!showSecret)}
                          className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[13px] font-medium mb-2 block">JWKS URL (optional)</label>
                    <input
                      type="url"
                      value={jwksUrl}
                      onChange={(e) => setJwksUrl(e.target.value)}
                      placeholder="https://your-auth-provider/.well-known/jwks.json"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[13px] font-medium">Anonymous Access</p>
                      <p className="text-[12px] text-[var(--text-tertiary)]">Allow unauthenticated requests</p>
                    </div>
                    <button
                      onClick={() => setAnonymousAccess(!anonymousAccess)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${anonymousAccess ? "bg-[var(--neon-green)]" : "bg-[var(--border-default)]"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${anonymousAccess ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>

                  <div>
                    <label className="text-[13px] font-medium mb-2 block">Allowed Schemas</label>
                    <input
                      type="text"
                      value={allowedSchemas}
                      onChange={(e) => setAllowedSchemas(e.target.value)}
                      placeholder="public"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Comma-separated list of schemas</p>
                  </div>

                  <div>
                    <label className="text-[13px] font-medium mb-2 block">Default Schema</label>
                    <input
                      type="text"
                      value={defaultSchema}
                      onChange={(e) => setDefaultSchema(e.target.value)}
                      placeholder="public"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </div>

                  <div>
                    <label className="text-[13px] font-medium mb-2 block">CORS Origins</label>
                    <input
                      type="text"
                      value={corsOrigins}
                      onChange={(e) => setCorsOrigins(e.target.value)}
                      placeholder="*"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                    />
                  </div>

                  <button
                    onClick={handleUpdateConfig}
                    disabled={saving}
                    className="neon-btn neon-btn-primary"
                  >
                    {saving ? "Saving..." : "Save Configuration"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
