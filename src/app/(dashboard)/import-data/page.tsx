"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/lib/org-context";
import {
  Database,
  GitBranch,
  Check,
  AlertTriangle,
  X,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Play,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
  Copy,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Table,
  AlertCircle,
  RotateCw,
  History,
  FileDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SourceDatabaseInfo {
  host: string;
  port: number;
  database: string;
  postgresVersion: string;
  schemas: string[];
}

interface SourceColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  foreignKeyColumn?: string;
}

interface SourceTableInfo {
  schemaName: string;
  tableName: string;
  columns: SourceColumnInfo[];
  rowCount: number;
}

interface SourceSchemaInfo {
  tables: SourceTableInfo[];
  totalTables: number;
  totalEstimatedRows: number;
}

interface SchemaComparisonResult {
  compatible: boolean;
  compatibleTables: string[];
  incompatibleTables: string[];
  warnings: { table: string; message: string }[];
  differences: {
    table: string;
    column?: string;
    type: string;
    source?: string;
    destination?: string;
    message: string;
  }[];
}

interface Project {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

interface DatabaseEntry {
  id: string;
  name: string;
}

interface ImportJob {
  id: string;
  status: string;
  sourceHost: string;
  sourceDatabase: string;
  databaseName: string;
  tablesTotal: number;
  tablesCompleted: number;
  rowsImported: number;
  totalEstimatedRows: number | null;
  errorSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface TableResult {
  id: string;
  tableName: string;
  schemaName: string;
  sourceRowCount: number | null;
  importedRowCount: number | null;
  status: string;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, label: "Source", description: "Connect to source database" },
  { id: 2, label: "Destination", description: "Choose target database" },
  { id: 3, label: "Compatibility", description: "Compare schemas" },
  { id: 4, label: "Select Tables", description: "Choose what to import" },
  { id: 5, label: "Review", description: "Confirm import details" },
  { id: 6, label: "Import", description: "Running import" },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ImportDataPage() {
  const { organization } = useOrganization();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [showHistory, setShowHistory] = useState(false);

  // Step 1: Source
  const [connectionString, setConnectionString] = useState("");
  const [showConnectionString, setShowConnectionString] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    info?: SourceDatabaseInfo;
    error?: string;
  } | null>(null);

  // Step 2: Destination
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [databases, setDatabases] = useState<DatabaseEntry[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("");

  // Step 3: Schema comparison
  const [sourceSchema, setSourceSchema] = useState<SourceSchemaInfo | null>(null);
  const [comparison, setComparison] = useState<SchemaComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);

  // Step 4: Table selection
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [tableSearch, setTableSearch] = useState("");

  // Step 5: Review
  const [conflictStrategy, setConflictStrategy] = useState("fail");

  // Step 6: Import progress
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [tableResults, setTableResults] = useState<TableResult[]>([]);
  const [startingImport, setStartingImport] = useState(false);

  // History
  const [history, setHistory] = useState<ImportJob[]>([]);

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.projects) setProjects(data.projects);
    } catch {}
  }, []);

  const loadBranches = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/branches`);
      const data = await res.json();
      if (data.branches) setBranches(data.branches);
    } catch {}
  }, []);

  const loadDatabases = useCallback(async (projectId: string, branchId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/databases?branchId=${branchId}`);
      const data = await res.json();
      if (data.databases) setDatabases(data.databases);
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/import-data/history");
      const data = await res.json();
      if (data.jobs) setHistory(data.jobs);
    } catch {}
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // ---------------------------------------------------------------------------
  // Step 1: Test Connection
  // ---------------------------------------------------------------------------

  const handleTestConnection = async () => {
    if (!connectionString.trim()) return;
    setTestingConnection(true);
    setConnectionResult(null);

    try {
      const res = await fetch("/api/import-data/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: connectionString.trim() }),
      });
      const data = await res.json();
      setConnectionResult(data);
    } catch (err) {
      setConnectionResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setTestingConnection(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 3: Compare Schemas
  // ---------------------------------------------------------------------------

  const handleCompareSchemas = async () => {
    setComparing(true);
    try {
      // First introspect source
      const srcRes = await fetch("/api/import-data/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: connectionString.trim() }),
      });
      const srcData = await srcRes.json();
      if (srcData.schema) setSourceSchema(srcData.schema);

      // Then compare
      const cmpRes = await fetch("/api/import-data/compare-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionString: connectionString.trim(),
          projectId: selectedProject,
          branchId: selectedBranch,
          databaseName: selectedDatabase,
        }),
      });
      const cmpData = await cmpRes.json();
      if (cmpData.comparison) {
        setComparison(cmpData.comparison);
        // Auto-select compatible tables
        const compatible = new Set<string>(cmpData.comparison.compatibleTables);
        setSelectedTables(compatible);
      }
    } catch (err) {
      setComparison({
        compatible: false,
        compatibleTables: [],
        incompatibleTables: [],
        warnings: [],
        differences: [{ table: "", type: "missing_table", message: "Failed to compare schemas" }],
      });
    } finally {
      setComparing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 6: Start Import
  // ---------------------------------------------------------------------------

  const handleStartImport = async () => {
    setStartingImport(true);
    try {
      const res = await fetch("/api/import-data/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionString: connectionString.trim(),
          projectId: selectedProject,
          branchId: selectedBranch,
          databaseName: selectedDatabase,
          tablesSelected: Array.from(selectedTables),
          conflictStrategy,
          totalEstimatedRows: sourceSchema?.totalEstimatedRows,
        }),
      });
      const data = await res.json();
      if (data.job) {
        setImportJob(data.job);
        setCurrentStep(6);
      }
    } catch (err) {
      // Handle error
    } finally {
      setStartingImport(false);
    }
  };

  // Poll for job status
  useEffect(() => {
    if (!importJob || !["pending", "running", "validating", "preparing"].includes(importJob.status)) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/import-data/jobs/${importJob.id}`);
        const data = await res.json();
        if (data.job) setImportJob(data.job);
        if (data.tableResults) setTableResults(data.tableResults);
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [importJob?.id, importJob?.status]);

  // Poll history when showing history view
  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 1: return connectionResult?.success === true;
      case 2: return !!selectedProject && !!selectedBranch && !!selectedDatabase;
      case 3: return comparison?.compatible === true;
      case 4: return selectedTables.size > 0;
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      // When moving from destination to compatibility, run comparison
      setCurrentStep(3);
      setTimeout(() => handleCompareSchemas(), 100);
    } else if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1 && currentStep < 6) {
      setCurrentStep(currentStep - 1);
    }
  };

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  const formatRows = (n: number | null) => {
    if (n === null || n === undefined) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const formatDuration = (start: string, end?: string | null) => {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diff = Math.floor((e - s) / 1000);
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m ${diff % 60}s`;
  };

  const maskedConnectionString = connectionString.replace(
    /:\/\/([^:]+):([^@]+)@/,
    "://$1:****@"
  );

  // Filter tables by search
  const filteredTables = sourceSchema?.tables.filter(
    (t) =>
      !tableSearch ||
      t.tableName.toLowerCase().includes(tableSearch.toLowerCase()) ||
      t.schemaName.toLowerCase().includes(tableSearch.toLowerCase())
  ) || [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-[calc(100vh-56px)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Import Data</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Import data from an external PostgreSQL or Neon database
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <History className="w-4 h-4" />
          Import History
        </button>
      </div>

      {/* History View */}
      {showHistory && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Import History</h2>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>
          {history.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">
              <FileDown className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No imports yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Source</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Destination</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Tables</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Rows</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((job) => (
                    <tr key={job.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {job.sourceHost}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)]">
                        {job.databaseName}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {job.tablesCompleted}/{job.tablesTotal}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {formatRows(job.rowsImported)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Main Wizard */}
      {!showHistory && (
        <>
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                  disabled={step.id > currentStep}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    step.id === currentStep
                      ? "bg-[var(--accent-soft)] text-[var(--text-primary)] border border-[var(--accent-border)]"
                      : step.id < currentStep
                      ? "bg-[var(--neon-green-soft)] text-[var(--neon-green)] cursor-pointer hover:opacity-80"
                      : "text-[var(--text-tertiary)] opacity-50"
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center text-xs font-bold">
                      {step.id}
                    </span>
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] mx-1 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] overflow-hidden">
            {/* Step 1: Source Connection */}
            {currentStep === 1 && (
              <div className="p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  Connect to Source Database
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  Enter the connection string for the database you want to import data from.
                </p>

                {/* Security Warning */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning-border)] mb-6">
                  <AlertCircle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">Security Notice</strong>
                    <p className="mt-1">
                      Your source connection string is encrypted in memory and never stored in logs.
                      The source database will not be modified.
                    </p>
                  </div>
                </div>

                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Connection String
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={showConnectionString ? "text" : "password"}
                      value={connectionString}
                      onChange={(e) => {
                        setConnectionString(e.target.value);
                        setConnectionResult(null);
                      }}
                      placeholder="postgresql://username:password@hostname:5432/database"
                      className="w-full px-4 py-2.5 pr-20 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-mono"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        onClick={() => setShowConnectionString(!showConnectionString)}
                        className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                        title={showConnectionString ? "Hide" : "Show"}
                      >
                        {showConnectionString ? (
                          <EyeOff className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        )}
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(connectionString)}
                        className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                        title="Copy"
                      >
                        <Copy className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={!connectionString.trim() || testingConnection}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingConnection ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    Test Connection
                  </button>
                </div>

                {/* Connection Result */}
                {connectionResult && (
                  <div
                    className={`mt-4 p-4 rounded-lg border ${
                      connectionResult.success
                        ? "bg-[var(--success-bg)] border-[var(--success-border)]"
                        : "bg-[var(--error-bg)] border-[var(--error-border)]"
                    }`}
                  >
                    {connectionResult.success && connectionResult.info ? (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            Connection successful
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm mt-3">
                          <div>
                            <span className="text-[var(--text-tertiary)]">Database:</span>{" "}
                            <span className="text-[var(--text-primary)] font-medium">
                              {connectionResult.info.database}
                            </span>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)]">PostgreSQL:</span>{" "}
                            <span className="text-[var(--text-primary)]">
                              {connectionResult.info.postgresVersion.split(" ")[0] || connectionResult.info.postgresVersion}
                            </span>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)]">Host:</span>{" "}
                            <span className="text-[var(--text-primary)]">
                              {connectionResult.info.host}:{connectionResult.info.port}
                            </span>
                          </div>
                          <div>
                            <span className="text-[var(--text-tertiary)]">Schemas:</span>{" "}
                            <span className="text-[var(--text-primary)]">
                              {connectionResult.info.schemas.join(", ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <XCircle className="w-5 h-5 text-[var(--error)] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">
                            Unable to connect
                          </p>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">
                            {connectionResult.error}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Example connection strings */}
                <div className="mt-6 p-4 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                    Supported formats
                  </p>
                  <div className="space-y-1 text-xs font-mono text-[var(--text-tertiary)]">
                    <p>postgresql://user:password@host:5432/database</p>
                    <p>postgres://user:password@host:5432/database?sslmode=require</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Destination Selection */}
            {currentStep === 2 && (
              <div className="p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  Choose Destination
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  Select the target project, branch, and database to import data into.
                </p>

                {/* Source Summary */}
                {connectionResult?.info && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] mb-6">
                    <Database className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-sm text-[var(--text-secondary)]">Source:</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {connectionResult.info.host} / {connectionResult.info.database}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Project */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Project
                    </label>
                    <select
                      value={selectedProject}
                      onChange={(e) => {
                        setSelectedProject(e.target.value);
                        setSelectedBranch("");
                        setSelectedDatabase("");
                        setBranches([]);
                        setDatabases([]);
                        if (e.target.value) loadBranches(e.target.value);
                      }}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="">Select project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Branch */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Branch
                    </label>
                    <select
                      value={selectedBranch}
                      onChange={(e) => {
                        setSelectedBranch(e.target.value);
                        setSelectedDatabase("");
                        setDatabases([]);
                        if (e.target.value && selectedProject)
                          loadDatabases(selectedProject, e.target.value);
                      }}
                      disabled={!selectedProject}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                    >
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Database */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                      Database
                    </label>
                    <select
                      value={selectedDatabase}
                      onChange={(e) => setSelectedDatabase(e.target.value)}
                      disabled={!selectedBranch}
                      className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
                    >
                      <option value="">Select database</option>
                      {databases.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Destination warning */}
                {selectedDatabase && (
                  <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning-border)]">
                    <AlertTriangle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-[var(--text-secondary)]">
                      <strong className="text-[var(--text-primary)]">Important</strong>
                      <p className="mt-1">
                        This operation will copy data from the source database into the selected
                        destination. Make sure you have selected the correct target database.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Schema Compatibility */}
            {currentStep === 3 && (
              <div className="p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  Schema Compatibility
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  Comparing source and destination schemas...
                </p>

                {comparing ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)] mb-4" />
                    <p className="text-sm text-[var(--text-secondary)]">
                      Analyzing schemas and comparing structures...
                    </p>
                  </div>
                ) : comparison ? (
                  <div>
                    {/* Compatibility Status */}
                    <div
                      className={`p-4 rounded-lg border mb-6 ${
                        comparison.compatible
                          ? "bg-[var(--success-bg)] border-[var(--success-border)]"
                          : "bg-[var(--error-bg)] border-[var(--error-border)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {comparison.compatible ? (
                          <CheckCircle2 className="w-5 h-5 text-[var(--neon-green)]" />
                        ) : (
                          <XCircle className="w-5 h-5 text-[var(--error)]" />
                        )}
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          {comparison.compatible
                            ? "Source and destination schemas are compatible"
                            : "Schema incompatibilities detected"}
                        </span>
                      </div>
                      {sourceSchema && (
                        <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-secondary)]">
                          <span>{sourceSchema.totalTables} tables</span>
                          <span>{formatRows(sourceSchema.totalEstimatedRows)} estimated rows</span>
                        </div>
                      )}
                    </div>

                    {/* Differences */}
                    {comparison.differences.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                          Differences
                        </h3>
                        <div className="space-y-2">
                          {comparison.differences.map((diff, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)]"
                            >
                              <XCircle className="w-4 h-4 text-[var(--error)] flex-shrink-0 mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium text-[var(--text-primary)]">
                                  {diff.table}
                                  {diff.column ? `.${diff.column}` : ""}
                                </span>
                                <p className="text-[var(--text-secondary)] mt-0.5">{diff.message}</p>
                                {diff.source && diff.destination && (
                                  <p className="text-xs text-[var(--text-tertiary)] mt-1 font-mono">
                                    Source: {diff.source} → Destination: {diff.destination}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {comparison.warnings.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                          Warnings
                        </h3>
                        <div className="space-y-2">
                          {comparison.warnings.map((warn, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning-border)]"
                            >
                              <AlertTriangle className="w-4 h-4 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                              <div className="text-sm">
                                <span className="font-medium text-[var(--text-primary)]">{warn.table}</span>
                                <p className="text-[var(--text-secondary)] mt-0.5">{warn.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <button
                      onClick={handleCompareSchemas}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Run Schema Comparison
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Table Selection */}
            {currentStep === 4 && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                      Select Tables
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      Choose which tables to import ({selectedTables.size} of {sourceSchema?.totalTables || 0} selected)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const all = new Set(filteredTables.map((t) => `${t.schemaName}.${t.tableName}`));
                        setSelectedTables(all);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedTables(new Set())}
                      className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Search tables..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                {/* Table List */}
                <div className="border border-[var(--border)] rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                  {filteredTables.map((table) => {
                    const key = `${table.schemaName}.${table.tableName}`;
                    const isSelected = selectedTables.has(key);
                    return (
                      <label
                        key={key}
                        className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] cursor-pointer transition-colors ${
                          isSelected ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedTables);
                            if (next.has(key)) next.delete(key);
                            else next.add(key);
                            setSelectedTables(next);
                          }}
                          className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
                        />
                        <Table className="w-4 h-4 text-[var(--text-tertiary)]" />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {table.tableName}
                          </span>
                          {table.schemaName !== "public" && (
                            <span className="text-xs text-[var(--text-tertiary)] ml-2">
                              {table.schemaName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {table.columns.length} columns
                        </span>
                        <span className="text-xs text-[var(--text-secondary)]">
                          {formatRows(table.rowCount)} rows
                        </span>
                      </label>
                    );
                  })}
                  {filteredTables.length === 0 && (
                    <div className="p-8 text-center text-[var(--text-secondary)]">
                      <p className="text-sm">No tables match your search</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div className="p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  Review Import
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  Confirm the import details before starting.
                </p>

                {/* Security Warning */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--warning-bg)] border border-[var(--warning-border)] mb-6">
                  <AlertCircle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">Important</strong>
                    <p className="mt-1">
                      This operation will copy data from the selected source database into the
                      destination database. The source database will not be modified.
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Source
                    </h3>
                    <div className="p-4 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)]">
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="text-[var(--text-tertiary)]">Host:</span>{" "}
                          <span className="text-[var(--text-primary)] font-medium">
                            {connectionResult?.info?.host || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Database:</span>{" "}
                          <span className="text-[var(--text-primary)]">
                            {connectionResult?.info?.database || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Tables:</span>{" "}
                          <span className="text-[var(--text-primary)]">
                            {sourceSchema?.totalTables || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Selected:</span>{" "}
                          <span className="text-[var(--text-primary)]">
                            {selectedTables.size} tables
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Destination
                    </h3>
                    <div className="p-4 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)]">
                      <div className="text-sm space-y-2">
                        <div>
                          <span className="text-[var(--text-tertiary)]">Database:</span>{" "}
                          <span className="text-[var(--text-primary)] font-medium">
                            {selectedDatabase || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Estimated Rows:</span>{" "}
                          <span className="text-[var(--text-primary)]">
                            {formatRows(sourceSchema?.totalEstimatedRows || null)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--text-tertiary)]">Mode:</span>{" "}
                          <span className="text-[var(--text-primary)]">Data Only</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conflict Strategy */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                    Conflict Strategy
                  </h3>
                  <div className="space-y-2">
                    {[
                      { value: "fail", label: "Fail on conflict", desc: "Stop if a primary key or unique constraint conflict is detected" },
                      { value: "skip", label: "Skip conflicting rows", desc: "Skip rows that would cause conflicts" },
                      { value: "upsert", label: "Upsert (merge)", desc: "Insert new rows, update existing rows on conflict" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          conflictStrategy === opt.value
                            ? "bg-[var(--accent-soft)] border-[var(--accent-border)]"
                            : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="conflict"
                          value={opt.value}
                          checked={conflictStrategy === opt.value}
                          onChange={() => setConflictStrategy(opt.value)}
                          className="mt-1 accent-[var(--accent)]"
                        />
                        <div>
                          <span className="text-sm font-medium text-[var(--text-primary)]">{opt.label}</span>
                          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 6: Import Progress */}
            {currentStep === 6 && importJob && (
              <div className="p-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  {importJob.status === "completed"
                    ? "Import Complete"
                    : importJob.status === "failed"
                    ? "Import Failed"
                    : importJob.status === "cancelled"
                    ? "Import Cancelled"
                    : "Importing Data"}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  {importJob.status === "completed"
                    ? "All tables have been imported successfully."
                    : importJob.status === "failed"
                    ? "The import encountered errors. Check the details below."
                    : "Data is being transferred from source to destination..."}
                </p>

                {/* Status Card */}
                <div
                  className={`p-4 rounded-lg border mb-6 ${
                    importJob.status === "completed"
                      ? "bg-[var(--success-bg)] border-[var(--success-border)]"
                      : importJob.status === "failed"
                      ? "bg-[var(--error-bg)] border-[var(--error-border)]"
                      : importJob.status === "cancelled"
                      ? "bg-[var(--warning-bg)] border-[var(--warning-border)]"
                      : "bg-[var(--bg-subtle)] border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {importJob.status === "completed" ? (
                      <CheckCircle2 className="w-6 h-6 text-[var(--neon-green)]" />
                    ) : importJob.status === "failed" ? (
                      <XCircle className="w-6 h-6 text-[var(--error)]" />
                    ) : importJob.status === "cancelled" ? (
                      <AlertTriangle className="w-6 h-6 text-[var(--warning)]" />
                    ) : (
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {importJob.tablesCompleted} / {importJob.tablesTotal} tables
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {formatRows(importJob.rowsImported)} rows imported
                        {importJob.totalEstimatedRows
                          ? ` / ${formatRows(importJob.totalEstimatedRows)} estimated`
                          : ""}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {importJob.tablesTotal > 0 && (
                    <div className="mt-3 h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                        style={{
                          width: `${
                            (importJob.tablesCompleted / importJob.tablesTotal) * 100
                          }%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Error Summary */}
                {importJob.errorSummary && (
                  <div className="p-4 rounded-lg bg-[var(--error-bg)] border border-[var(--error-border)] mb-6">
                    <p className="text-sm font-medium text-[var(--text-primary)] mb-1">Errors</p>
                    <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono">
                      {importJob.errorSummary}
                    </pre>
                  </div>
                )}

                {/* Table Results */}
                {tableResults.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                      Table Results
                    </h3>
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]">Table</th>
                            <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]">Rows Imported</th>
                            <th className="text-center px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tableResults.map((r) => (
                            <tr key={r.id} className="border-b border-[var(--border)] last:border-b-0">
                              <td className="px-4 py-2 text-[var(--text-primary)]">
                                {r.schemaName}.{r.tableName}
                              </td>
                              <td className="px-4 py-2 text-right text-[var(--text-secondary)]">
                                {r.importedRowCount !== null ? formatRows(r.importedRowCount) : "—"}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <StatusBadge status={r.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {(importJob.status === "completed" || importJob.status === "failed" || importJob.status === "cancelled") && (
                  <div className="flex items-center gap-3 mt-6">
                    <button
                      onClick={() => {
                        // Reset wizard
                        setCurrentStep(1);
                        setConnectionString("");
                        setConnectionResult(null);
                        setSelectedProject("");
                        setSelectedBranch("");
                        setSelectedDatabase("");
                        setSourceSchema(null);
                        setComparison(null);
                        setSelectedTables(new Set());
                        setImportJob(null);
                        setTableResults([]);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      New Import
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          {currentStep < 6 && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={handleBack}
                disabled={currentStep === 1}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              {currentStep === 5 ? (
                <button
                  onClick={handleStartImport}
                  disabled={startingImport}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-[var(--neon-green)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {startingImport ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Start Import
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status Badge Component
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "Pending", color: "var(--text-secondary)", bg: "var(--bg-subtle)" },
    validating: { label: "Validating", color: "var(--info)", bg: "var(--info-bg)" },
    preparing: { label: "Preparing", color: "var(--info)", bg: "var(--info-bg)" },
    running: { label: "Running", color: "var(--accent)", bg: "var(--accent-soft)" },
    importing: { label: "Importing", color: "var(--accent)", bg: "var(--accent-soft)" },
    completed: { label: "Completed", color: "var(--neon-green)", bg: "var(--success-bg)" },
    failed: { label: "Failed", color: "var(--error)", bg: "var(--error-bg)" },
    cancelled: { label: "Cancelled", color: "var(--warning)", bg: "var(--warning-bg)" },
    skipped: { label: "Skipped", color: "var(--text-tertiary)", bg: "var(--bg-subtle)" },
  };

  const { label, color, bg } = config[status] || config.pending;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color, backgroundColor: bg }}
    >
      {status === "running" || status === "importing" || status === "validating" || status === "preparing" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : status === "completed" ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : status === "failed" ? (
        <XCircle className="w-3 h-3" />
      ) : status === "cancelled" ? (
        <AlertTriangle className="w-3 h-3" />
      ) : null}
      {label}
    </span>
  );
}
