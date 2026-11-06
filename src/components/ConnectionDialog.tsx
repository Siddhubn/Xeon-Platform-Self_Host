"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ChevronDown,
  Wifi,
  WifiOff,
  AlertCircle,
  Database,
  GitBranch,
  User,
  Shield,
  Server,
  Globe,
  Loader2,
} from "lucide-react";
import { SkeletonBlock } from "@/components/Skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionNetworkMode = "auto" | "tailscale" | "local" | "private" | "public";
type SslMode = "disable" | "allow" | "prefer" | "require" | "verify-ca" | "verify-full";
type ConnectionTab =
  | "postgresql"
  | "psql"
  | "env"
  | "libpq"
  | "jdbc"
  | "nodejs"
  | "python"
  | "go"
  | "java"
  | "dotnet"
  | "prisma"
  | "drizzle"
  | "params"
  | "neon";

interface ConnectionDetails {
  host: string;
  port: number;
  database: string;
  user: string;
  sslMode: SslMode;
  networkMode: ConnectionNetworkMode;
  connectionType: string;
  formats: Record<string, any>;
  poolerAvailable: boolean;
  poolerHost?: string;
  poolerPort?: number;
  resolvedHost?: {
    host: string;
    port: number;
    source: string;
  };
}

interface ConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  initialProjectId?: string;
  initialBranchId?: string;
}

interface Project {
  id: string;
  name: string;
  branchCount: number;
}

interface Branch {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface DatabaseEntry {
  name: string;
  ownerName: string;
}

interface RoleEntry {
  name: string;
  isDefault: boolean;
}

interface TailscaleStatus {
  installed: boolean;
  running: boolean;
  connected: boolean;
  ipv4: string;
  ipv6: string;
  dnsName: string;
  magicDnsName: string;
  tailscaleIp: string;
}

// ---------------------------------------------------------------------------
// Tab configuration
// ---------------------------------------------------------------------------

const TABS: { id: ConnectionTab; label: string; icon: string }[] = [
  { id: "postgresql", label: "PostgreSQL", icon: "🐘" },
  { id: "psql", label: "psql", icon: ">" },
  { id: "params", label: "Parameters", icon: "⚙" },
  { id: "env", label: "Env Variable", icon: "$" },
  { id: "libpq", label: "libpq", icon: "📦" },
  { id: "jdbc", label: "JDBC", icon: "☕" },
  { id: "nodejs", label: "Node.js", icon: "🟢" },
  { id: "python", label: "Python", icon: "🐍" },
  { id: "go", label: "Go", icon: "🔵" },
  { id: "java", label: "Java", icon: "☕" },
  { id: "dotnet", label: ".NET", icon: "🟣" },
  { id: "prisma", label: "Prisma", icon: "◆" },
  { id: "drizzle", label: "Drizzle", icon: "💧" },
  { id: "neon", label: "Neon Serverless", icon: "⚡" },
];

const NETWORK_MODES: { value: ConnectionNetworkMode; label: string; description: string }[] = [
  { value: "auto", label: "Auto", description: "Automatically detect the best host" },
  { value: "tailscale", label: "Tailscale", description: "Use Tailscale network address" },
  { value: "local", label: "Local", description: "Connect via localhost" },
  { value: "private", label: "Private Network", description: "Use private network address" },
  { value: "public", label: "Public", description: "Use public internet address" },
];

const SSL_MODES: { value: SslMode; label: string }[] = [
  { value: "disable", label: "Disable" },
  { value: "allow", label: "Allow" },
  { value: "prefer", label: "Prefer" },
  { value: "require", label: "Require" },
  { value: "verify-ca", label: "Verify CA" },
  { value: "verify-full", label: "Verify Full" },
];

// ---------------------------------------------------------------------------
// Code Block Component
// ---------------------------------------------------------------------------

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--bg-surface-secondary)] border-b border-[var(--border)]">
        {language && (
          <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--neon-green)] transition-colors"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[12px] font-mono text-[var(--text-primary)] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dropdown Component
// ---------------------------------------------------------------------------

function Dropdown({
  value,
  options,
  onChange,
  placeholder,
  icon: Icon,
}: {
  value: string;
  options: { value: string; label: string; description?: string }[];
  onChange: (value: any) => void;
  placeholder: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] hover:border-[var(--neon-green)] transition-colors"
      >
        {Icon && <Icon className="w-4 h-4 text-[var(--text-secondary)]" />}
        <span className="flex-1 text-left truncate">
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex flex-col px-3 py-2 text-left transition-colors ${
                value === opt.value
                  ? "bg-[var(--neon-green)]/10 text-[var(--neon-green)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-surface-secondary)]"
              }`}
            >
              <span className="text-[13px] font-medium">{opt.label}</span>
              {opt.description && (
                <span className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {opt.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ConnectionDialog({
  open,
  onClose,
  initialProjectId,
  initialBranchId,
}: ConnectionDialogProps) {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [databases, setDatabases] = useState<DatabaseEntry[]>([]);
  const [roles, setRoles] = useState<RoleEntry[]>([]);

  const [selectedProject, setSelectedProject] = useState(initialProjectId || "");
  const [selectedBranch, setSelectedBranch] = useState(initialBranchId || "");
  const [selectedDatabase, setSelectedDatabase] = useState("neondb");
  const [selectedRole, setSelectedRole] = useState("cloud_admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [networkMode, setNetworkMode] = useState<ConnectionNetworkMode>("auto");
  // SSL mode: an explicit user choice, otherwise the sensible default for the
  // selected network mode. "auto" defers to the server, which resolves TLS
  // based on where the host actually lands (proxy / Funnel => require).
  const [sslModeOverride, setSslModeOverride] = useState<SslMode | null>(null);
  const sslMode: SslMode =
    sslModeOverride ??
    (networkMode === "local" || networkMode === "private" ? "disable" : "require");
  // What is actually sent to the API for this mode
  const sslParam: SslMode | undefined =
    sslModeOverride ?? (networkMode === "auto" ? undefined : sslMode);

  // Switching network mode restores that mode's default SSL setting
  useEffect(() => {
    setSslModeOverride(null);
  }, [networkMode]);

  const [connectionType, setConnectionType] = useState<"direct" | "pooled">("direct");
  const [activeTab, setActiveTab] = useState<ConnectionTab>("postgresql");
  const [details, setDetails] = useState<ConnectionDetails | null>(null);
  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus | null>(null);

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState("");

  // Load projects
  useEffect(() => {
    if (!open) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects || []);
        if (data.projects?.length > 0 && !selectedProject) {
          setSelectedProject(data.projects[0].id);
        }
      })
      .catch(() => {});
  }, [open]);

  // Load branches when project changes
  useEffect(() => {
    if (!selectedProject) return;
    fetch(`/api/projects/${selectedProject}/branches`)
      .then((r) => r.json())
      .then((data) => {
        setBranches(data.branches || []);
        if (data.branches?.length > 0) {
          const primary = data.branches.find((b: Branch) => b.isPrimary);
          setSelectedBranch(primary?.id || data.branches[0].id);
        }
      })
      .catch(() => {});
  }, [selectedProject]);

  // Load connection details when selections change
  const loadDetails = useCallback(async () => {
    if (!selectedProject || !selectedBranch) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        networkMode,
        connectionType,
      });
      if (selectedDatabase) params.set("database", selectedDatabase);
      if (selectedRole) params.set("role", selectedRole);
      if (password) params.set("password", password);
      if (sslParam) params.set("sslMode", sslParam);

      const res = await fetch(
        `/api/projects/${selectedProject}/branches/${selectedBranch}/connection?${params}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load connection details");
        return;
      }

      setDetails(data.details);
      setDatabases(data.databases || []);
      setRoles(data.roles || []);
      setTailscaleStatus(data.tailscaleStatus || null);

      // Auto-select first database/role if current selection doesn't exist in the list
      if (data.databases?.length > 0 && !data.databases.find((d: DatabaseEntry) => d.name === selectedDatabase)) {
        setSelectedDatabase(data.databases[0].name);
      }
      if (data.roles?.length > 0 && !data.roles.find((r: RoleEntry) => r.name === selectedRole)) {
        setSelectedRole(data.roles[0].name);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load connection details");
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedBranch, selectedDatabase, selectedRole, password, networkMode, connectionType, sslMode]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Test connection
  const handleTestConnection = async () => {
    if (!selectedProject || !selectedBranch || !password) {
      setTestResult({ success: false, message: "Password is required to test the connection" });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(
        `/api/projects/${selectedProject}/branches/${selectedBranch}/connection/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            databaseName: selectedDatabase,
            roleName: selectedRole,
            password,
            networkMode,
            sslMode: sslParam,
          }),
        }
      );
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Connection test failed" });
    } finally {
      setTesting(false);
    }
  };

  // Get current connection string for display
  const getConnectionString = (): string => {
    if (!details) return "";
    switch (activeTab) {
      case "postgresql":
        return details.formats.postgresqlUriSsl || details.formats.postgresqlUri;
      case "psql":
        return details.formats.psqlCommand;
      case "env":
        return details.formats.environmentVariable;
      case "libpq":
        return details.formats.libpqKeyValue;
      case "jdbc":
        return details.formats.jdbcString;
      case "nodejs":
        return details.formats.nodeJs;
      case "python":
        return details.formats.pythonPsycopg;
      case "go":
        return details.formats.goPgx;
      case "java":
        return details.formats.javaJdbc;
      case "dotnet":
        return details.formats.dotnetNpgsql;
      case "prisma":
        return details.formats.prismaEnv;
      case "drizzle":
        return details.formats.drizzleEnv;
      case "neon":
        return details.formats.neonServerless;
      case "params":
        return Object.entries(details.formats.individualParams || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
      default:
        return details.formats.postgresqlUriSsl || details.formats.postgresqlUri;
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    const text = getConnectionString();
    await navigator.clipboard.writeText(text);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col animate-modal-enter">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--neon-green)]/10 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-[var(--neon-green)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Connection Details
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Connect to your PostgreSQL database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Selectors */}
            <div className="space-y-4">
              {/* Project */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Project
                </label>
                <Dropdown
                  value={selectedProject}
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                    description: `${p.branchCount} branch(es)`,
                  }))}
                  onChange={setSelectedProject}
                  placeholder="Select project"
                  icon={Database}
                />
              </div>

              {/* Branch */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Branch
                </label>
                <Dropdown
                  value={selectedBranch}
                  options={branches.map((b) => ({
                    value: b.id,
                    label: b.name,
                    description: b.isPrimary ? "Primary" : undefined,
                  }))}
                  onChange={setSelectedBranch}
                  placeholder="Select branch"
                  icon={GitBranch}
                />
              </div>

              {/* Database */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Database
                </label>
                <Dropdown
                  value={selectedDatabase}
                  options={databases.map((d) => ({
                    value: d.name,
                    label: d.name,
                    description: `Owner: ${d.ownerName}`,
                  }))}
                  onChange={setSelectedDatabase}
                  placeholder="Select database"
                  icon={Server}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Role
                </label>
                <Dropdown
                  value={selectedRole}
                  options={roles.map((r) => ({
                    value: r.name,
                    label: r.name,
                    description: r.isDefault ? "Default" : undefined,
                  }))}
                  onChange={setSelectedRole}
                  placeholder="Select role"
                  icon={User}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter role password"
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--neon-green)] transition-colors"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Connection Type */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Connection Type
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConnectionType("direct")}
                    className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                      connectionType === "direct"
                        ? "bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--neon-green)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]"
                    }`}
                  >
                    Direct
                  </button>
                  <button
                    onClick={() => setConnectionType("pooled")}
                    className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                      connectionType === "pooled"
                        ? "bg-[var(--neon-green)]/10 border-[var(--neon-green)] text-[var(--neon-green)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]"
                    }`}
                  >
                    Pooled
                  </button>
                </div>
              </div>

              {/* Network Mode */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Network
                </label>
                <Dropdown
                  value={networkMode}
                  options={NETWORK_MODES}
                  onChange={setNetworkMode}
                  placeholder="Select network"
                  icon={Globe}
                />
              </div>

              {/* SSL Mode */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  SSL Mode
                </label>
                <Dropdown
                  value={sslMode}
                  options={SSL_MODES}
                  onChange={setSslModeOverride}
                  placeholder="Select SSL mode"
                  icon={Shield}
                />
              </div>

              {/* Tailscale Status */}
              {tailscaleStatus && (
                <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-secondary)]">
                  <div className="flex items-center gap-2 mb-2">
                    {tailscaleStatus.connected ? (
                      <Wifi className="w-4 h-4 text-green-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-[var(--text-secondary)]" />
                    )}
                    <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                      Tailscale
                    </span>
                    <span
                      className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        tailscaleStatus.connected
                          ? "bg-green-500/10 text-green-400"
                          : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {tailscaleStatus.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  {tailscaleStatus.ipv4 && (
                    <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5">
                      <div>IPv4: {tailscaleStatus.ipv4}</div>
                      {tailscaleStatus.magicDnsName && (
                        <div>DNS: {tailscaleStatus.magicDnsName}</div>
                      )}
                    </div>
                  )}
                  {!tailscaleStatus.installed && (
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      Tailscale not detected. Install or configure via environment variables.
                    </div>
                  )}
                </div>
              )}

              {/* Test Connection Button */}
              <button
                onClick={handleTestConnection}
                disabled={testing || !password}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--neon-green)] text-[var(--accent-foreground)] text-[13px] font-semibold hover:bg-[var(--neon-green-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
                {testing ? "Testing..." : "Test Connection"}
              </button>

              {/* Test Result */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg text-[12px] flex items-start gap-2 ${
                    testResult.success
                      ? "bg-green-500/10 border border-green-500/20"
                      : "bg-red-500/10 border border-red-500/20"
                  }`}
                  style={{ color: "var(--text-primary)" }}
                >
                  {testResult.success ? (
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Right: Connection String */}
            <div className="lg:col-span-2 space-y-4">
              {/* ── Prominent Connection URI ── */}
              {details && (
                <div className="rounded-xl border border-[var(--neon-green)]/30 bg-[var(--neon-green)]/5 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--neon-green)]/10 border-b border-[var(--neon-green)]/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--neon-green)] animate-pulse" />
                      <span className="text-[12px] font-semibold text-[var(--neon-green)] uppercase tracking-wider">
                        Connection URI
                      </span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--neon-green)] text-[var(--accent-foreground)] text-[12px] font-semibold hover:bg-[var(--neon-green-hover)] transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <code className="block text-[13px] font-mono text-[var(--text-primary)] leading-relaxed break-all select-all">
                      {details.formats.postgresqlUriSsl || details.formats.postgresqlUri}
                    </code>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-[var(--bg-surface-secondary)]">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-[var(--bg-surface)] text-[var(--neon-green)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <span className="mr-1">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Connection String Display */}
              {loading ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonBlock key={i} className="rounded-lg" style={{ height: 36, animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : details ? (
                <div className="space-y-4">
                  {/* Code Display */}
                  <CodeBlock
                    code={getConnectionString()}
                    language={
                      activeTab === "nodejs"
                        ? "javascript"
                        : activeTab === "python"
                        ? "python"
                        : activeTab === "go"
                        ? "go"
                        : activeTab === "java"
                        ? "java"
                        : activeTab === "prisma" || activeTab === "drizzle"
                        ? "prisma"
                        : activeTab === "env" || activeTab === "neon"
                        ? "bash"
                        : "text"
                    }
                  />

                  {/* Sub-tabs for Python */}
                  {activeTab === "python" && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        {[
                          { id: "psycopg", label: "psycopg" },
                          { id: "asyncpg", label: "asyncpg" },
                          { id: "sqlalchemy", label: "SQLAlchemy" },
                        ].map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => {
                              // Switch Python sub-tab
                            }}
                            className="px-3 py-1 rounded-md text-[11px] font-medium bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-tabs for Go */}
                  {activeTab === "go" && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        {[
                          { id: "pgx", label: "pgx" },
                          { id: "dbsql", label: "database/sql" },
                        ].map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => {}}
                            className="px-3 py-1 rounded-md text-[11px] font-medium bg-[var(--bg-surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Connection Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-secondary)] border border-[var(--border)]">
                      <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                        Host
                      </div>
                      <div className="text-[13px] font-mono text-[var(--text-primary)] truncate">
                        {details.host}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-secondary)] border border-[var(--border)]">
                      <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                        Port
                      </div>
                      <div className="text-[13px] font-mono text-[var(--text-primary)]">
                        {details.port}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-secondary)] border border-[var(--border)]">
                      <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                        Database
                      </div>
                      <div className="text-[13px] font-mono text-[var(--text-primary)] truncate">
                        {details.database}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-surface-secondary)] border border-[var(--border)]">
                      <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                        User
                      </div>
                      <div className="text-[13px] font-mono text-[var(--text-primary)] truncate">
                        {details.user}
                      </div>
                    </div>
                  </div>

                  {/* Endpoint Information */}
                  {networkMode === "public" && (
                    <div className="rounded-xl border border-[var(--neon-green)]/20 bg-[var(--bg-surface-secondary)] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-[var(--neon-green)]" />
                        <span className="text-[12px] font-semibold text-[var(--neon-green)] uppercase tracking-wider">
                          Public Remote Access
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                            Endpoint
                          </div>
                          <div className="text-[13px] font-mono text-[var(--text-primary)]">
                            {details.formats?.postgresqlUriSsl?.match(/@([^:]+):/)?.[1]?.split(".")?.[0] || "—"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                            SSL
                          </div>
                          <div className="text-[13px] font-mono text-green-400">
                            Required
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                            Protocol
                          </div>
                          <div className="text-[13px] font-mono text-[var(--text-primary)]">
                            PostgreSQL (TLS)
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] text-[var(--text-secondary)]">
                        Connect from anywhere using the public connection string above.
                        The Neon Proxy handles routing to the correct compute endpoint.
                        Routed through the Tailscale Funnel — clients must support
                        direct TLS negotiation (<span className="font-mono">sslnegotiation=direct</span>,
                        libpq/psql 17+).
                      </div>
                    </div>
                  )}

                  {networkMode === "public" && details !== null && !details.host && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[12px] flex items-start gap-2" style={{ color: "var(--text-primary)" }}>
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-400" />
                      <div>
                        <div className="font-semibold">Public access not configured</div>
                        <div className="text-[var(--text-secondary)] mt-1">
                          Set NEON_PUBLIC_DOMAIN in proxy.env to enable remote database connections.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12 text-[var(--text-secondary)] text-[13px]">
                  Select a project and branch to view connection details
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
