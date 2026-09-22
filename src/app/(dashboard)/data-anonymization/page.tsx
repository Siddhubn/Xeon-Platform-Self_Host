"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Play,
  Clock,
  RefreshCw,
  Info,
  Settings,
  Lock,
  Unlock,
  Search,
  Zap,
  ArrowRight,
} from "lucide-react";
import {
  useProjects,
  useBranches,
} from "@/components/ProjectBranchSelector";
import CustomSelect from "@/components/CustomSelect";

interface SchemaColumn {
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable?: boolean;
}

interface MaskingRule {
  id?: string;
  tableName: string;
  columnName: string;
  schemaName: string;
  ruleType: string;
  configuration?: Record<string, unknown>;
  customExpression?: string;
  enabled: boolean;
}

interface MaskingPreviewRow {
  original: unknown;
  masked: unknown;
}

interface MaskingOperation {
  id: string;
  status: string;
  progress: number;
  currentStep: string;
  rulesApplied: number;
  rowsAffected: number;
  error?: string;
  targetBranchId?: string;
}

const MASKING_RULES = [
  { value: "preserve", label: "Preserve (No Change)", category: "Generic" },
  { value: "null_value", label: "Set to NULL", category: "Generic" },
  { value: "fixed_value", label: "Fixed Value", category: "Generic" },
  { value: "random_first_name", label: "Random First Name", category: "Names" },
  { value: "random_last_name", label: "Random Last Name", category: "Names" },
  { value: "random_full_name", label: "Random Full Name", category: "Names" },
  { value: "consistent_pseudonym", label: "Consistent Pseudonym", category: "Names" },
  { value: "random_email", label: "Random Email", category: "Email Addresses" },
  { value: "synthetic_email", label: "Synthetic Email", category: "Email Addresses" },
  { value: "hashed_email", label: "Hashed Email", category: "Email Addresses" },
  { value: "redacted_email", label: "Redacted Email", category: "Email Addresses" },
  { value: "random_phone", label: "Random Phone Number", category: "Phone Numbers" },
  { value: "redacted_phone", label: "Redacted Number", category: "Phone Numbers" },
  { value: "hashed_phone", label: "Hashed Number", category: "Phone Numbers" },
  { value: "random_address", label: "Random Street Address", category: "Addresses" },
  { value: "random_city", label: "Random City", category: "Addresses" },
  { value: "random_postal_code", label: "Random Postal Code", category: "Addresses" },
  { value: "synthetic_address", label: "Synthetic Address", category: "Addresses" },
  { value: "redacted_address", label: "Redacted Address", category: "Addresses" },
  { value: "random_date", label: "Random Date", category: "Dates" },
  { value: "date_shift", label: "Date Shift", category: "Dates" },
  { value: "random_uuid", label: "Random UUID", category: "Identifiers" },
  { value: "consistent_hash", label: "Consistent Hash", category: "Identifiers" },
  { value: "sequential_replacement", label: "Sequential Replacement", category: "Identifiers" },
  { value: "random_int", label: "Random Integer", category: "Identifiers" },
  { value: "redacted", label: "Fully Redacted", category: "Generic" },
  { value: "custom_sql", label: "Custom SQL Expression", category: "Custom" },
];

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; rule: string; confidence: number }> = [
  { pattern: /email|e_mail|mail/i, rule: "synthetic_email", confidence: 0.95 },
  { pattern: /phone|mobile|cell|fax/i, rule: "random_phone", confidence: 0.9 },
  { pattern: /first_?name|given_?name/i, rule: "random_first_name", confidence: 0.9 },
  { pattern: /last_?name|surname|family/i, rule: "random_last_name", confidence: 0.9 },
  { pattern: /full_?name|display_?name|username/i, rule: "random_full_name", confidence: 0.85 },
  { pattern: /address|street|addr/i, rule: "random_address", confidence: 0.85 },
  { pattern: /city|town/i, rule: "random_city", confidence: 0.8 },
  { pattern: /postal_?code|zip/i, rule: "random_postal_code", confidence: 0.85 },
  { pattern: /password|secret|token/i, rule: "redacted", confidence: 0.95 },
  { pattern: /dob|birth/i, rule: "random_date", confidence: 0.9 },
];

export default function DataAnonymizationPage() {
  const { projects, loading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { branches, loading: branchesLoading } = useBranches(selectedProjectId);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("postgres");

  // Schema data
  const [schemaTables, setSchemaTables] = useState<string[]>([]);
  const [schemaColumns, setSchemaColumns] = useState<SchemaColumn[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Masking rules
  const [rules, setRules] = useState<MaskingRule[]>([]);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  // Preview
  const [previewColumn, setPreviewColumn] = useState<{ table: string; column: string; rule: string } | null>(null);
  const [previewData, setPreviewData] = useState<MaskingPreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Anonymization
  const [targetBranchName, setTargetBranchName] = useState("");
  const [anonymizing, setAnonymizing] = useState(false);
  const [operation, setOperation] = useState<MaskingOperation | null>(null);

  // Existing saved rules
  const [savedRules, setSavedRules] = useState<MaskingRule[]>([]);

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Auto-select
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId && !selectedBranchId && branches.length > 0) setSelectedBranchId(branches[0].id);
  }, [selectedProjectId, branches, selectedBranchId]);

  // Fetch databases
  const fetchDatabases = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId) return;
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/databases?branchId=${selectedBranchId}`);
      const data = await res.json();
      const dbNames = (data.databases || []).map((d: any) => d.name);
      const allDbs = [...new Set(["postgres", ...dbNames])];
      setDatabases(allDbs);
      if (!allDbs.includes(selectedDatabase)) setSelectedDatabase(allDbs[0]);
    } catch {
      setDatabases(["postgres"]);
    }
  }, [selectedProjectId, selectedBranchId]);

  // Fetch schema
  const fetchSchema = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId) return;
    setSchemaLoading(true);
    try {
      const res = await fetch(
        `/api/data-api/schema?projectId=${selectedProjectId}&branchId=${selectedBranchId}&databaseName=${selectedDatabase}`
      );
      const data = await res.json();
      const tables = (data.tables || [])
        .filter((t: any) => t.tableType === "BASE TABLE" && t.schemaName === "public")
        .map((t: any) => t.tableName);
      const columns = (data.columns || [])
        .filter((c: any) => c.schemaName === "public")
        .map((c: any) => ({
          tableName: c.tableName,
          columnName: c.columnName,
          dataType: c.dataType,
          isNullable: c.isNullable,
        }));
      setSchemaTables(tables);
      setSchemaColumns(columns);
    } catch {
      setSchemaTables([]);
      setSchemaColumns([]);
    } finally {
      setSchemaLoading(false);
    }
  }, [selectedProjectId, selectedBranchId, selectedDatabase]);

  // Fetch saved rules
  const fetchSavedRules = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId) return;
    try {
      const res = await fetch(
        `/api/masking/rules?projectId=${selectedProjectId}&branchId=${selectedBranchId}&databaseName=${selectedDatabase}`
      );
      const data = await res.json();
      setSavedRules(data.rules || []);
      setRules(data.rules || []);
    } catch {
      // ignore
    }
  }, [selectedProjectId, selectedBranchId, selectedDatabase]);

  useEffect(() => { fetchDatabases(); }, [fetchDatabases]);
  useEffect(() => { fetchSchema(); }, [fetchSchema]);
  useEffect(() => { fetchSavedRules(); }, [fetchSavedRules]);

  // Suggest rules for sensitive columns
  const autoSuggestRules = () => {
    const newRules: MaskingRule[] = [];
    for (const col of schemaColumns) {
      // Skip ID columns, timestamps, booleans
      if (/^(id|_id|uuid|created_at|updated_at|deleted_at|is_|has_)/i.test(col.columnName)) continue;
      if (col.dataType === "boolean") continue;

      for (const { pattern, rule, confidence } of SENSITIVE_PATTERNS) {
        if (pattern.test(col.columnName) && confidence >= 0.8) {
          // Don't add if rule already exists
          if (!rules.find((r) => r.tableName === col.tableName && r.columnName === col.columnName)) {
            newRules.push({
              tableName: col.tableName,
              columnName: col.columnName,
              schemaName: "public",
              ruleType: rule,
              enabled: true,
            });
          }
          break;
        }
      }
    }
    if (newRules.length > 0) {
      setRules([...rules, ...newRules]);
      setSuccess(`Suggested ${newRules.length} masking rule(s) for sensitive columns`);
    } else {
      setError("No new sensitive columns detected for automatic masking suggestions");
    }
  };

  // Add/update rule for a column
  const updateRule = (tableName: string, columnName: string, ruleType: string) => {
    const existing = rules.find((r) => r.tableName === tableName && r.columnName === columnName);
    if (existing) {
      setRules(
        rules.map((r) =>
          r.tableName === tableName && r.columnName === columnName ? { ...r, ruleType } : r
        )
      );
    } else {
      setRules([
        ...rules,
        { tableName, columnName, schemaName: "public", ruleType, enabled: true },
      ]);
    }
  };

  // Remove rule
  const removeRule = (tableName: string, columnName: string) => {
    setRules(rules.filter((r) => !(r.tableName === tableName && r.columnName === columnName)));
  };

  // Preview masking
  const handlePreview = async (tableName: string, columnName: string, ruleType: string) => {
    setPreviewColumn({ table: tableName, column: columnName, rule: ruleType });
    setPreviewLoading(true);
    setPreviewData([]);
    try {
      const res = await fetch("/api/masking/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          branchId: selectedBranchId,
          databaseName: selectedDatabase,
          schemaName: "public",
          tableName,
          columnName,
          ruleType,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreviewData(data.preview || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Save all rules
  const handleSaveRules = async () => {
    try {
      for (const rule of rules) {
        await fetch("/api/masking/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: rule.id,
            projectId: selectedProjectId,
            branchId: selectedBranchId,
            databaseName: selectedDatabase,
            schemaName: rule.schemaName,
            tableName: rule.tableName,
            columnName: rule.columnName,
            ruleType: rule.ruleType,
            configuration: rule.configuration,
            customExpression: rule.customExpression,
            enabled: rule.enabled,
            createdBy: "1",
          }),
        });
      }
      setSuccess("Masking rules saved successfully");
      fetchSavedRules();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Create anonymized branch
  const handleAnonymize = async () => {
    if (!targetBranchName.trim()) {
      setError("Please enter a target branch name");
      return;
    }
    if (rules.filter((r) => r.ruleType !== "preserve").length === 0) {
      setError("Please configure at least one masking rule");
      return;
    }

    setAnonymizing(true);
    setError("");
    setOperation(null);

    try {
      const res = await fetch("/api/masking/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          sourceBranchId: selectedBranchId,
          targetBranchName: targetBranchName.trim(),
          databaseName: selectedDatabase,
          rules: rules.filter((r) => r.ruleType !== "preserve"),
          createdBy: "1",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setOperation(data);
      if (data.success) {
        setSuccess(`Anonymized branch "${targetBranchName}" created successfully! ${data.rulesApplied} rules applied, ${data.rowsAffected} rows transformed.`);
        setTargetBranchName("");
      } else {
        setError(`Anonymization completed with errors: ${data.errors?.join("; ")}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnonymizing(false);
    }
  };

  // Filtered columns
  const filteredColumns = schemaColumns.filter(
    (c) =>
      !searchTerm ||
      c.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.columnName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group columns by table
  const columnsByTable = new Map<string, SchemaColumn[]>();
  for (const col of filteredColumns) {
    const existing = columnsByTable.get(col.tableName) || [];
    existing.push(col);
    columnsByTable.set(col.tableName, existing);
  }

  if (projectsLoading) {
    return (
      <div className="animate-page-enter">
        <div className="space-y-4">
          <div className="h-8 w-48 rounded-lg bg-[var(--bg-inset)] animate-pulse" />
          <div className="h-64 rounded-xl bg-[var(--bg-inset)] animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-enter max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">Data Anonymization</h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
          Create safe copies of production data for development, testing, and debugging
        </p>
      </div>

      {/* Selectors */}
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
            <label className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase">Source Branch</label>
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
          <button onClick={() => setError("")} className="ml-auto hover:opacity-70">✕</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-active-bg)] text-[var(--status-active)] text-[13px] flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          {success}
          <button onClick={() => setSuccess("")} className="ml-auto hover:opacity-70">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main: Column rules */}
        <div className="lg:col-span-2">
          <div className="border border-[var(--border-default)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-inset)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tables and columns..."
                  className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                />
              </div>
              <button onClick={autoSuggestRules} className="neon-btn neon-btn-ghost neon-btn-sm">
                <Zap className="w-3.5 h-3.5" />
                Auto-detect
              </button>
              <button onClick={fetchSchema} disabled={schemaLoading} className="neon-btn neon-btn-ghost neon-btn-sm">
                <RefreshCw className={`w-3.5 h-3.5 ${schemaLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Column list */}
            <div className="max-h-[600px] overflow-y-auto">
              {schemaLoading ? (
                <div className="p-8 text-center text-[var(--text-tertiary)] text-[13px]">
                  Loading schema...
                </div>
              ) : columnsByTable.size === 0 ? (
                <div className="p-8 text-center text-[var(--text-tertiary)] text-[13px]">
                  No tables found. Ensure PostgreSQL is running and has tables in the public schema.
                </div>
              ) : (
                Array.from(columnsByTable.entries()).map(([tableName, columns]) => {
                  const isExpanded = expandedTable === tableName;
                  const ruleCount = rules.filter((r) => r.tableName === tableName && r.ruleType !== "preserve").length;
                  return (
                    <div key={tableName} className="border-b border-[var(--border-default)] last:border-b-0">
                      <button
                        onClick={() => setExpandedTable(isExpanded ? null : tableName)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span className="text-[13px] font-medium font-mono">{tableName}</span>
                        <span className="text-[11px] text-[var(--text-tertiary)]">{columns.length} columns</span>
                        {ruleCount > 0 && (
                          <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--text-primary)]">
                            {ruleCount} rules
                          </span>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3">
                          <table className="neon-table w-full">
                            <thead>
                              <tr>
                                <th className="text-left">Column</th>
                                <th className="text-left">Type</th>
                                <th className="text-left">Masking Rule</th>
                                <th className="text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {columns.map((col) => {
                                const rule = rules.find(
                                  (r) => r.tableName === col.tableName && r.columnName === col.columnName
                                );
                                const isPK = /^id$/i.test(col.columnName);
                                const isFK = /\_id$/i.test(col.columnName) && !isPK;
                                const isTimestamp = /created_at|updated_at|deleted_at|timestamp/i.test(col.columnName);
                                return (
                                  <tr key={col.columnName}>
                                    <td className="font-mono text-[12px]">
                                      <span>{col.columnName}</span>
                                      {isPK && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-[var(--status-idle-bg)] text-[var(--status-idle)]">PK</span>}
                                      {isFK && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--text-secondary)]">FK</span>}
                                    </td>
                                    <td className="text-[12px] text-[var(--text-tertiary)]">{col.dataType}</td>
                                    <td>
                                      <CustomSelect
                                        value={rule?.ruleType || "preserve"}
                                        options={MASKING_RULES.map((r) => ({ value: r.value, label: r.label }))}
                                        onChange={(val) => updateRule(col.tableName, col.columnName, val)}
                                        searchable
                                        className="w-[200px]"
                                      />
                                    </td>
                                    <td className="text-right">
                                      {rule && rule.ruleType !== "preserve" && (
                                        <div className="flex items-center justify-end gap-1">
                                          <button
                                            onClick={() => handlePreview(col.tableName, col.columnName, rule.ruleType)}
                                            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                                            title="Preview"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => removeRule(col.tableName, col.columnName)}
                                            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
                                            title="Remove rule"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-[var(--border-default)] bg-[var(--bg-inset)] flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-tertiary)]">
                {rules.filter((r) => r.ruleType !== "preserve").length} masking rule(s) configured
              </span>
              <button onClick={handleSaveRules} className="neon-btn neon-btn-primary neon-btn-sm">
                Save Rules
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar: Preview + Create */}
        <div className="space-y-6">
          {/* Preview Panel */}
          {previewColumn && (
            <div className="border border-[var(--border-default)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-inset)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold">Preview</h3>
                  <button onClick={() => { setPreviewColumn(null); setPreviewData([]); }} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">✕</button>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {previewColumn.table}.{previewColumn.column} → {MASKING_RULES.find((r) => r.value === previewColumn.rule)?.label}
                </p>
              </div>
              <div className="p-4">
                {previewLoading ? (
                  <div className="text-center py-4 text-[12px] text-[var(--text-tertiary)]">
                    Generating preview...
                  </div>
                ) : previewData.length === 0 ? (
                  <div className="text-center py-4 text-[12px] text-[var(--text-tertiary)]">
                    No data to preview (column may be empty or table may not exist)
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] font-medium uppercase">
                      <span className="flex-1">Original</span>
                      <ArrowRight className="w-3 h-3" />
                      <span className="flex-1">Masked</span>
                    </div>
                    {previewData.map((row, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <span className="flex-1 font-mono truncate px-2 py-1 rounded bg-[var(--bg-inset)]">
                          {String(row.original ?? "NULL")}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0" />
                        <span className="flex-1 font-mono truncate px-2 py-1 rounded bg-[var(--accent-soft)] text-[var(--text-primary)]">
                          {String(row.masked ?? "NULL")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create Anonymized Branch */}
          <div className="border border-[var(--border-default)] rounded-xl bg-[var(--bg-surface)] overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-inset)]">
              <h3 className="text-[13px] font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Create Anonymized Branch
              </h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="p-3 rounded-lg bg-[var(--status-info-bg)] text-[12px] text-[var(--text-secondary)]">
                <Info className="w-4 h-4 inline mr-1.5" />
                Create a new branch with anonymized data. The source branch will not be modified.
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1.5 block">Target Branch Name</label>
                <input
                  type="text"
                  value={targetBranchName}
                  onChange={(e) => setTargetBranchName(e.target.value)}
                  placeholder="production-anonymized"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>

              <div className="text-[12px] text-[var(--text-tertiary)]">
                <p>{rules.filter((r) => r.ruleType !== "preserve").length} masking rule(s) will be applied</p>
              </div>

              {/* Operation Progress */}
              {operation && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[var(--text-secondary)]">{operation.currentStep || "Processing..."}</span>
                    <span className="text-[var(--text-tertiary)]">{operation.progress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--bg-inset)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${operation.progress}%`,
                        backgroundColor: operation.status === "failed" ? "var(--status-error)" : "var(--neon-green)",
                      }}
                    />
                  </div>
                  {operation.status === "completed" && (
                    <p className="text-[12px] text-[var(--status-active)] flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      {operation.rulesApplied} rules applied, {operation.rowsAffected} rows transformed
                    </p>
                  )}
                  {operation.status === "failed" && (
                    <p className="text-[12px] text-[var(--status-error)]">
                      {operation.error}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleAnonymize}
                disabled={anonymizing || !targetBranchName.trim() || rules.filter((r) => r.ruleType !== "preserve").length === 0}
                className="neon-btn neon-btn-primary w-full justify-center"
              >
                {anonymizing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Creating Anonymized Branch...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Create Anonymized Branch
                  </>
                )}
              </button>

              <div className="p-3 rounded-lg bg-[var(--status-idle-bg)] text-[12px] text-[var(--text-secondary)]">
                <Lock className="w-4 h-4 inline mr-1.5" />
                <strong className="text-[var(--text-primary)]">Safety:</strong> The source branch remains untouched.
                All masking is applied to the new branch only.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
