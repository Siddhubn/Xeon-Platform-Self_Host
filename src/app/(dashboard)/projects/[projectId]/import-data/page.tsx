"use client";

import { useState, useEffect, useCallback } from "react";
import { useOrganization } from "@/lib/org-context";
import { useProject } from "@/lib/project-context";
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
  version: string;
  schemas: string[];
}

interface SourceSchemaInfo {
  tables: Array<{ name: string; schema: string; estimatedRows: number }>;
  totalEstimatedRows: number;
  totalEstimatedSize: string;
}

interface SchemaComparisonResult {
  compatible: boolean;
  compatibleTables: string[];
  incompatibleTables: string[];
  differences: Array<{ table: string; type: string; message: string }>;
  warnings: string[];
}

interface ImportJob {
  id: string;
  status: string;
  sourceHost: string;
  sourceDatabase: string;
  tablesSelected: string[];
  tablesCompleted: string[];
  rowsImported: number;
  totalEstimatedRows: number | null;
  errorSummary: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface TableResult {
  jobId: string;
  tableName: string;
  sourceRowCount: number;
  importedRowCount: number;
  status: string;
  errorMessage: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
  isPrimary: boolean;
}

interface DatabaseEntry {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImportDataPage() {
  const { organization } = useOrganization();
  const { projectId, project, branches: contextBranches, selectedBranchId } = useProject();

  const [currentStep, setCurrentStep] = useState(1);
  const [showHistory, setShowHistory] = useState(false);

  // Step 1: Source connection
  const [connectionString, setConnectionString] = useState("");
  const [showConnectionString, setShowConnectionString] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    info?: SourceDatabaseInfo;
    error?: string;
  } | null>(null);

  // Step 2: Destination
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

  // Sync context branch selection
  useEffect(() => {
    if (selectedBranchId) {
      setSelectedBranch(selectedBranchId);
    }
  }, [selectedBranchId]);

  // Sync context branches
  useEffect(() => {
    if (contextBranches.length > 0) {
      setBranches(contextBranches.map(b => ({ ...b })));
    }
  }, [contextBranches]);

  // Load databases for selected branch
  const loadDatabases = useCallback(async (pid: string, bid: string) => {
    try {
      const res = await fetch(`/api/projects/${pid}/databases?branchId=${bid}`);
      const data = await res.json();
      if (data.databases) setDatabases(data.databases);
    } catch {}
  }, []);

  // Load databases when branch changes
  useEffect(() => {
    if (projectId && selectedBranch) {
      loadDatabases(projectId, selectedBranch);
    }
  }, [projectId, selectedBranch, loadDatabases]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/import-data/history");
      const data = await res.json();
      if (data.jobs) setHistory(data.jobs);
    } catch {}
  }, []);

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
      setConnectionResult({ success: false, error: "Failed to test connection" });
    } finally {
      setTestingConnection(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step 3: Compare Schemas
  // ---------------------------------------------------------------------------

  const handleCompareSchemas = async () => {
    if (!connectionString.trim() || !projectId || !selectedBranch || !selectedDatabase) return;
    setComparing(true);
    setComparison(null);

    try {
      // Get source schema
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
          projectId,
          branchId: selectedBranch,
          databaseName: selectedDatabase,
        }),
      });
      const cmpData = await cmpRes.json();
      if (cmpData.comparison) {
        setComparison(cmpData.comparison);
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
          projectId,
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
      case 2: return !!projectId && !!selectedBranch && !!selectedDatabase;
      case 3: return comparison?.compatible === true;
      case 4: return selectedTables.size > 0;
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
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

  const toggleTable = (tableName: string) => {
    setSelectedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const toggleAllTables = () => {
    if (!comparison) return;
    if (selectedTables.size === comparison.compatibleTables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(comparison.compatibleTables));
    }
  };

  const filteredTables = comparison
    ? [...comparison.compatibleTables, ...comparison.incompatibleTables].filter(
        (t) => !tableSearch || t.toLowerCase().includes(tableSearch.toLowerCase())
      )
    : [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (showHistory) {
    return (
      <div className="animate-page-enter px-4 py-3">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Import History</h1>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Previous data imports</p>
          </div>
          <button
            onClick={() => setShowHistory(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Import
          </button>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <History className="w-12 h-12 text-[var(--text-secondary)] mb-4" />
            <h3 className="text-[var(--text-primary)] font-semibold text-[15px]">No import history</h3>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">Import data to see history here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((job) => (
              <div key={job.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">{job.sourceHost} / {job.sourceDatabase}</p>
                    <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                      {job.tablesSelected.length} tables · {job.rowsImported.toLocaleString()} rows · {new Date(job.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                    job.status === "completed" ? "bg-green-500/15 text-green-400" :
                    job.status === "failed" ? "bg-red-500/15 text-red-400" :
                    "bg-yellow-500/15 text-yellow-400"
                  }`}>
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-page-enter px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Import Data</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Import data from an external PostgreSQL database into {project?.name || "this project"}
          </p>
        </div>
        <button
          onClick={() => { setShowHistory(true); loadHistory(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {["Source", "Destination", "Schema", "Tables", "Review", "Import"].map((step, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;
          return (
            <div key={step} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-semibold ${
                isActive ? "bg-[var(--accent)] text-white" :
                isCompleted ? "bg-green-500/20 text-green-400" :
                "bg-[var(--bg-inset)] text-[var(--text-secondary)]"
              }`}>
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNum}
              </div>
              <span className={`text-[12px] font-medium whitespace-nowrap ${
                isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              }`}>{step}</span>
              {i < 5 && <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] mx-1" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Source Connection */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">Source Database</h3>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              Enter the connection string for the database you want to import data from.
            </p>

            <div className="relative">
              <input
                type={showConnectionString ? "text" : "password"}
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="postgresql://username:password@hostname:5432/database"
                className="w-full px-4 py-3 pr-24 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[13px] font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  onClick={() => setShowConnectionString(!showConnectionString)}
                  className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {showConnectionString ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(connectionString)}
                  className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={!connectionString.trim() || testingConnection}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50"
            >
              {testingConnection ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Test Connection
            </button>
          </div>

          {connectionResult && (
            <div className={`p-4 rounded-xl border ${
              connectionResult.success
                ? "border-green-500/30 bg-green-500/10"
                : "border-red-500/30 bg-red-500/10"
            }`}>
              {connectionResult.success ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">Connection successful</p>
                    {connectionResult.info && (
                      <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                        Database: {connectionResult.info.database} · PostgreSQL: {connectionResult.info.version}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">Connection failed</p>
                    <p className="text-[12px] text-[var(--text-secondary)] mt-1">{connectionResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Destination */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">Destination</h3>
            <p className="text-[13px] text-[var(--text-secondary)] mb-4">
              Select the branch and database to import data into.
            </p>

            {connectionResult?.success && connectionResult.info && (
              <div className="mb-4 flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <span>Source:</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {connectionResult.info.host} / {connectionResult.info.database}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    if (e.target.value && projectId) loadDatabases(projectId, e.target.value);
                  }}
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
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

            {selectedDatabase && (
              <div className="mt-6 flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-[13px] text-[var(--text-secondary)]">
                  <strong className="text-[var(--text-primary)]">Important:</strong> This operation will copy data from the source database into the selected destination. Existing data may be affected.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Schema Comparison */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">Schema Compatibility</h3>
            {comparing ? (
              <div className="flex items-center gap-3 py-8">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
                <span className="text-[13px] text-[var(--text-secondary)]">Comparing schemas...</span>
              </div>
            ) : comparison ? (
              <div>
                <div className={`flex items-center gap-2 mb-4 p-3 rounded-lg ${
                  comparison.compatible ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                }`}>
                  {comparison.compatible ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  <span className="text-[13px] font-medium">
                    {comparison.compatible ? "Schemas are compatible" : "Schemas have incompatible differences"}
                  </span>
                </div>

                {comparison.warnings.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {comparison.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12px] text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                {comparison.differences.length > 0 && (
                  <div className="space-y-2">
                    {comparison.differences.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-[var(--bg-inset)] text-[12px]">
                        <span className={`font-mono ${
                          d.type === "missing_table" || d.type === "type_mismatch" ? "text-red-400" : "text-amber-400"
                        }`}>
                          {d.table ? `${d.table}: ` : ""}{d.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-[var(--text-secondary)]">No comparison data available.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Table Selection */}
      {currentStep === 4 && comparison && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                Tables to Import ({selectedTables.size} / {comparison.compatibleTables.length})
              </h3>
              <button onClick={toggleAllTables} className="text-[12px] text-[var(--accent)] hover:underline">
                {selectedTables.size === comparison.compatibleTables.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search tables..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredTables.map((table) => {
                const isCompatible = comparison.compatibleTables.includes(table);
                const isSelected = selectedTables.has(table);
                return (
                  <label
                    key={table}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                      isCompatible ? "hover:bg-[var(--bg-hover)]" : "opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!isCompatible}
                      onChange={() => toggleTable(table)}
                      className="rounded border-[var(--border)]"
                    />
                    <span className="text-[13px] font-mono text-[var(--text-primary)]">{table}</span>
                    {!isCompatible && (
                      <span className="text-[11px] text-red-400 ml-auto">Incompatible</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-4">Review Import</h3>

            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <span className="text-[var(--text-secondary)]">Source</span>
                <p className="font-medium text-[var(--text-primary)]">{connectionResult?.info?.host} / {connectionResult?.info?.database}</p>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Destination</span>
                <p className="font-medium text-[var(--text-primary)]">{project?.name} / {selectedDatabase}</p>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Tables</span>
                <p className="font-medium text-[var(--text-primary)]">{selectedTables.size}</p>
              </div>
              <div>
                <span className="text-[var(--text-secondary)]">Estimated Rows</span>
                <p className="font-medium text-[var(--text-primary)]">{sourceSchema?.totalEstimatedRows?.toLocaleString() || "Unknown"}</p>
              </div>
            </div>

            <div className="mt-6">
              <label className="text-[13px] font-medium text-[var(--text-primary)] mb-2 block">Conflict Strategy</label>
              <select
                value={conflictStrategy}
                onChange={(e) => setConflictStrategy(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                <option value="fail">Fail on conflict</option>
                <option value="skip">Skip conflicting rows</option>
                <option value="upsert">Upsert existing rows</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Import Progress */}
      {currentStep === 6 && importJob && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
            <div className="flex items-center gap-3 mb-4">
              {importJob.status === "completed" ? (
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              ) : importJob.status === "failed" ? (
                <XCircle className="w-6 h-6 text-red-400" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
              )}
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  {importJob.status === "completed" ? "Import Complete" :
                   importJob.status === "failed" ? "Import Failed" : "Importing..."}
                </h3>
                <p className="text-[12px] text-[var(--text-secondary)]">
                  {importJob.rowsImported.toLocaleString()} rows imported
                </p>
              </div>
            </div>

            {tableResults.length > 0 && (
              <div className="space-y-2">
                {tableResults.map((tr) => (
                  <div key={tr.tableName} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-inset)]">
                    {tr.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    ) : tr.status === "failed" ? (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)] flex-shrink-0" />
                    )}
                    <span className="text-[13px] font-mono text-[var(--text-primary)]">{tr.tableName}</span>
                    <span className="text-[12px] text-[var(--text-secondary)] ml-auto">
                      {tr.importedRowCount.toLocaleString()} / {tr.sourceRowCount.toLocaleString()} rows
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      {currentStep < 6 && (
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border)] text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={currentStep === 5 ? handleStartImport : handleNext}
            disabled={!canGoNext() || startingImport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {currentStep === 5 ? (
              startingImport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {currentStep === 5 ? "Start Import" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}
