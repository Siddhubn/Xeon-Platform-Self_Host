"use client";

import { useState, useCallback, useEffect } from "react";
import { useProject } from "@/lib/project-context";
import {
  Database,
  GitBranch,
  HardDrive,
  RefreshCw,
  Table,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import DrizzleStudioGrid from "@/components/DataBrowser/DrizzleStudioGrid";
import { DataPageSkeleton, SkeletonBlock } from "@/components/Skeleton";
import CustomSelect from "@/components/CustomSelect";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface ColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey?: boolean;
  isAutoIncrement?: boolean;
}

interface SchemaTable {
  schema: string;
  name: string;
  type: "table" | "view";
  columns: ColumnMeta[];
}

interface SchemaGroup {
  name: string;
  tables: SchemaTable[];
}

interface RowData {
  [key: string]: unknown;
}

// -----------------------------------------------------------------------
// Data Page
// -----------------------------------------------------------------------

export default function DataPage() {
  // Global context
  const { projectId, selectedBranchId, selectedBranch } = useProject();

  // Database selection (still needed — multiple databases per branch)
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("postgres");
  const [dbLoading, setDbLoading] = useState(false);

  // Schema/Table selection
  const [schemas, setSchemas] = useState<SchemaGroup[]>([]);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [tableSearch, setTableSearch] = useState("");

  // Table data
  const [rows, setRows] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [queryTimeMs, setQueryTimeMs] = useState(0);

  // Pagination & sorting
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // -----------------------------------------------------------------------
  // Fetch databases for current branch
  // -----------------------------------------------------------------------

  const fetchDatabases = useCallback(async () => {
    if (!projectId || !selectedBranchId) { setDatabases([]); return; }
    setDbLoading(true);
    try {
      const res = await fetch(`/api/data/databases?projectId=${projectId}&branchId=${selectedBranchId}`);
      const data = await res.json();
      const dbs = data.databases || ["postgres"];
      setDatabases(dbs);
      if (!dbs.includes(selectedDatabase)) setSelectedDatabase(dbs[0] || "postgres");
    } catch {
      setDatabases(["postgres"]);
    } finally {
      setDbLoading(false);
    }
  }, [projectId, selectedBranchId, selectedDatabase]);

  useEffect(() => { fetchDatabases(); }, [fetchDatabases]);

  // -----------------------------------------------------------------------
  // Fetch schemas
  // -----------------------------------------------------------------------

  const fetchSchemas = useCallback(async () => {
    if (!projectId || !selectedBranchId || !selectedDatabase) return;
    setSchemasLoading(true);
    try {
      const params = new URLSearchParams({
        projectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
      });
      const res = await fetch(`/api/data/metadata?${params}`);
      const data = await res.json();
      if (data.error) {
        setSchemas([]);
      } else {
        const groups: SchemaGroup[] = (data.schemas || []).map((s: any) => ({
          name: s.name,
          tables: (s.tables || []).map((t: any) => ({
            schema: s.name,
            name: t.name,
            type: t.type,
            columns: (t.columns || []).map((c: any) => ({
              name: c.name,
              type: c.type,
              nullable: c.nullable,
              defaultValue: c.defaultValue,
              isPrimaryKey: c.isPrimaryKey,
              isAutoIncrement: c.isAutoIncrement,
            })),
          })),
        }));
        setSchemas(groups);
        // Auto-expand public schema
        const publicSchema = groups.find((g) => g.name === "public");
        if (publicSchema) {
          setExpandedSchemas(new Set(["public"]));
          setSelectedSchema("public");
        } else if (groups.length > 0) {
          setExpandedSchemas(new Set([groups[0].name]));
          setSelectedSchema(groups[0].name);
        }
      }
    } catch {
      setSchemas([]);
    } finally {
      setSchemasLoading(false);
    }
  }, [projectId, selectedBranchId, selectedDatabase]);

  useEffect(() => {
    fetchSchemas();
    setSelectedTable(null);
    setRows([]);
    setColumns([]);
    setPrimaryKeys([]);
    setTotalCount(0);
    setOffset(0);
  }, [fetchSchemas]);

  // -----------------------------------------------------------------------
  // Fetch table data
  // -----------------------------------------------------------------------

  const fetchTableData = useCallback(async () => {
    if (!selectedSchema || !selectedTable || !projectId || !selectedBranchId) return;
    setDataLoading(true);
    setDataError(null);
    try {
      const params = new URLSearchParams({
        projectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
        schemaName: selectedSchema,
        tableName: selectedTable,
        offset: String(offset),
        limit: String(limit),
      });
      if (sortColumn) {
        params.set("sortColumn", sortColumn);
        params.set("sortDirection", sortDirection);
      }
      const res = await fetch(`/api/data/rows?${params}`);
      const data = await res.json();
      if (data.error) {
        setDataError(data.error);
        setRows([]);
        setColumns([]);
        setPrimaryKeys([]);
        setTotalCount(0);
      } else {
        setRows(data.rows || []);
        setColumns(data.columns || []);
        setPrimaryKeys(data.primaryKeys || []);
        setTotalCount(data.totalCount || 0);
        setQueryTimeMs(data.queryTimeMs || 0);
      }
    } catch (err: any) {
      setDataError(err.message || "Failed to load data");
      setRows([]);
    } finally {
      setDataLoading(false);
    }
  }, [projectId, selectedBranchId, selectedDatabase, selectedSchema, selectedTable, offset, limit, sortColumn, sortDirection]);

  useEffect(() => { fetchTableData(); }, [fetchTableData]);

  // -----------------------------------------------------------------------
  // Row mutations
  // -----------------------------------------------------------------------

  const insertRow = async (rowData: Record<string, unknown>) => {
    const res = await fetch("/api/data/rows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
        schemaName: selectedSchema,
        tableName: selectedTable,
        data: rowData,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    fetchTableData();
  };

  const updateRow = async (primaryKeyValues: Record<string, unknown>, rowData: Record<string, unknown>) => {
    const res = await fetch("/api/data/rows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
        schemaName: selectedSchema,
        tableName: selectedTable,
        primaryKeyValues,
        data: rowData,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    fetchTableData();
  };

  const deleteRow = async (primaryKeyValues: Record<string, unknown>) => {
    const res = await fetch("/api/data/rows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
        schemaName: selectedSchema,
        tableName: selectedTable,
        primaryKeyValues,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    fetchTableData();
  };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const allTables = schemas.flatMap((s) => s.tables);
  const filteredSchemas = schemas.map((s) => ({
    ...s,
    tables: s.tables.filter(
      (t) => !tableSearch || t.name.toLowerCase().includes(tableSearch.toLowerCase())
    ),
  })).filter((s) => s.tables.length > 0);

  const handleSchemaToggle = (name: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleTableSelect = (schema: string, table: string) => {
    setSelectedSchema(schema);
    setSelectedTable(table);
    setOffset(0);
    setSortColumn(null);
    setSortDirection("asc");
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!projectId || !selectedBranchId) {
    return <DataPageSkeleton />;
  }

  return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      {/* Top context bar — only Database selector, project/branch from global context */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex-shrink-0">
        {/* Project indicator (read-only) */}
        <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
          <Database className="w-3.5 h-3.5" />
          {selectedBranch?.name || "—"}
        </span>

        <div className="w-px h-4 bg-[var(--border-default)]" />

        {/* Database selector */}
        {dbLoading ? (
          <SkeletonBlock className="rounded-lg" style={{ height: 34, width: 140 }} />
        ) : (
          <CustomSelect
            value={selectedDatabase}
            options={databases.map((d) => ({ value: d, label: d, icon: <HardDrive className="w-3.5 h-3.5 text-[var(--neon-green)]" /> }))}
            onChange={setSelectedDatabase}
            searchable
            className="w-[160px]"
          />
        )}

        <div className="flex-1" />

        {/* Active table indicator */}
        {selectedTable && (
          <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
            {selectedSchema}.{selectedTable}
          </span>
        )}
      </div>

      {/* Main area: sidebar + grid */}
      <div className="flex flex-1 min-h-0">
        {/* Schema sidebar */}
        <div className="w-[220px] flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col overflow-hidden">
          {/* Search */}
          <div className="px-3 py-2 border-b border-[var(--border-default)]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search tables..."
                className="w-full pl-7 pr-3 py-1.5 rounded-md bg-[var(--bg-inset)] border border-[var(--border-default)] text-[12px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Schema tree */}
          <div className="flex-1 overflow-y-auto">
            {schemasLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <SkeletonBlock key={i} className="rounded" style={{ height: 28 }} />
                ))}
              </div>
            ) : filteredSchemas.length === 0 ? (
              <div className="p-4 text-center">
                <Table className="w-6 h-6 text-[var(--text-tertiary)] mx-auto mb-2" />
                <p className="text-[11px] text-[var(--text-tertiary)]">No tables found</p>
              </div>
            ) : (
              filteredSchemas.map((schema) => {
                const isExpanded = expandedSchemas.has(schema.name);
                return (
                  <div key={schema.name}>
                    <button
                      onClick={() => handleSchemaToggle(schema.name)}
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      <Database className="w-3 h-3" />
                      <span>{schema.name}</span>
                      <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{schema.tables.length}</span>
                    </button>
                    {isExpanded && (
                      <div>
                        {schema.tables.map((table) => {
                          const isSelected = selectedSchema === schema.name && selectedTable === table.name;
                          return (
                            <button
                              key={table.name}
                              onClick={() => handleTableSelect(schema.name, table.name)}
                              className={`w-full flex items-center gap-2 pl-7 pr-3 py-1 text-[12px] transition-colors ${
                                isSelected
                                  ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                              }`}
                            >
                              <Table className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{table.name}</span>
                              <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">{table.columns.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Data grid */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedTable ? (
            <DrizzleStudioGrid
              schemaName={selectedSchema || "public"}
              tableName={selectedTable}
              rows={rows}
              columns={columns}
              primaryKeys={primaryKeys}
              loading={dataLoading}
              error={dataError}
              totalCount={totalCount}
              queryTimeMs={queryTimeMs}
              offset={offset}
              limit={limit}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={(col) => { if (sortColumn === col) { setSortDirection(d => d === "asc" ? "desc" : "asc"); } else { setSortColumn(col); setSortDirection("asc"); } setOffset(0); }}
              onPageChange={setOffset}
              onRefresh={fetchTableData}
              onInsert={insertRow}
              onUpdate={updateRow}
              onDelete={deleteRow}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Table className="w-10 h-10 text-[var(--text-tertiary)] mb-3" />
              <p className="text-[13px] text-[var(--text-secondary)]">Select a table to view its data</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                {allTables.length} table{allTables.length !== 1 ? "s" : ""} in {schemas.length} schema{schemas.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
