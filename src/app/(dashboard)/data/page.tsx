"use client";

import { useState, useCallback, useEffect } from "react";
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

interface ProjectOption {
  id: string;
  name: string;
}

interface BranchOption {
  id: string;
  name: string;
  isPrimary: boolean;
}

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
  // Project/Branch/Database selection
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState("postgres");

  // Loading states
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);
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
  // Fetch projects
  // -----------------------------------------------------------------------

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // -----------------------------------------------------------------------
  // Fetch branches
  // -----------------------------------------------------------------------

  const fetchBranches = useCallback(async () => {
    if (!selectedProjectId) { setBranches([]); return; }
    setBranchesLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/branches`);
      const data = await res.json();
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  useEffect(() => {
    if (selectedProjectId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedProjectId, branches, selectedBranchId]);

  // -----------------------------------------------------------------------
  // Fetch databases
  // -----------------------------------------------------------------------

  const fetchDatabases = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId) { setDatabases([]); return; }
    setDbLoading(true);
    try {
      const res = await fetch(`/api/data/databases?projectId=${selectedProjectId}&branchId=${selectedBranchId}`);
      const data = await res.json();
      const dbs = data.databases || ["postgres"];
      setDatabases(dbs);
      if (!dbs.includes(selectedDatabase)) setSelectedDatabase(dbs[0] || "postgres");
    } catch {
      setDatabases(["postgres"]);
    } finally {
      setDbLoading(false);
    }
  }, [selectedProjectId, selectedBranchId, selectedDatabase]);

  useEffect(() => { fetchDatabases(); }, [fetchDatabases]);

  // -----------------------------------------------------------------------
  // Fetch schemas
  // -----------------------------------------------------------------------

  const fetchSchemas = useCallback(async () => {
    if (!selectedProjectId || !selectedBranchId || !selectedDatabase) return;
    setSchemasLoading(true);
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
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
        // Auto-expand first schema
        if (groups.length > 0) {
          setExpandedSchemas(new Set([groups[0].name]));
        }
      }
    } catch {
      setSchemas([]);
    } finally {
      setSchemasLoading(false);
    }
  }, [selectedProjectId, selectedBranchId, selectedDatabase]);

  useEffect(() => { fetchSchemas(); }, [fetchSchemas]);

  // Auto-select first table
  useEffect(() => {
    if (schemas.length > 0 && !selectedTable) {
      const firstTable = schemas[0]?.tables[0];
      if (firstTable) {
        setSelectedSchema(firstTable.schema);
        setSelectedTable(firstTable.name);
      }
    }
  }, [schemas, selectedTable]);

  // -----------------------------------------------------------------------
  // Fetch table data
  // -----------------------------------------------------------------------

  const fetchTableData = useCallback(async () => {
    if (!selectedSchema || !selectedTable || !selectedProjectId || !selectedBranchId) return;
    setDataLoading(true);
    setDataError(null);
    const start = Date.now();
    try {
      const params = new URLSearchParams({
        projectId: selectedProjectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
        schema: selectedSchema,
        table: selectedTable,
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
        setColumns(
          (data.columns || []).map((c: any) => ({
            name: c.name,
            type: c.type,
            nullable: c.nullable,
            defaultValue: c.defaultValue,
          }))
        );
        setPrimaryKeys(data.primaryKeys || []);
        setTotalCount(data.totalCount || 0);
      }
    } catch {
      setDataError("Failed to fetch table data");
      setRows([]);
      setColumns([]);
      setPrimaryKeys([]);
      setTotalCount(0);
    } finally {
      setDataLoading(false);
      setQueryTimeMs(Date.now() - start);
    }
  }, [selectedProjectId, selectedBranchId, selectedDatabase, selectedSchema, selectedTable, offset, limit, sortColumn, sortDirection]);

  useEffect(() => { fetchTableData(); }, [fetchTableData]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSelectTable = (schema: string, table: string) => {
    setSelectedSchema(schema);
    setSelectedTable(table);
    setOffset(0);
    setSortColumn(null);
    setSortDirection("asc");
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((p) => (p === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setOffset(0);
  };

  const handlePageChange = (newOffset: number) => {
    setOffset(Math.max(0, newOffset));
  };

  const handleInsert = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/data/row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: selectedProjectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
        schema: selectedSchema,
        table: selectedTable,
        data,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Insert failed");
    await fetchTableData();
  };

  const handleUpdate = async (primaryKey: Record<string, unknown>, data: Record<string, unknown>) => {
    const res = await fetch("/api/data/row", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: selectedProjectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
        schema: selectedSchema,
        table: selectedTable,
        primaryKey,
        data,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Update failed");
    await fetchTableData();
  };

  const handleDelete = async (primaryKey: Record<string, unknown>) => {
    const res = await fetch("/api/data/row", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: selectedProjectId,
        branchId: selectedBranchId,
        databaseName: selectedDatabase,
        schema: selectedSchema,
        table: selectedTable,
        primaryKey,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Delete failed");
    await fetchTableData();
  };

  // -----------------------------------------------------------------------
  // Context reset
  // -----------------------------------------------------------------------

  useEffect(() => { setSelectedBranchId(null); }, [selectedProjectId]);
  useEffect(() => { setSelectedDatabase("postgres"); }, [selectedBranchId]);
  useEffect(() => {
    setSelectedSchema(null);
    setSelectedTable(null);
    setSchemas([]);
  }, [selectedDatabase]);

  // -----------------------------------------------------------------------
  // Filtered tables for sidebar search
  // -----------------------------------------------------------------------

  const filteredSchemas = schemas.map((s) => ({
    ...s,
    tables: s.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        s.name.toLowerCase().includes(tableSearch.toLowerCase())
    ),
  })).filter((s) => s.tables.length > 0 || tableSearch === "");

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (projectsLoading) {
    return <DataPageSkeleton />;
  }

  // -----------------------------------------------------------------------
  // Render — full-height layout with sidebar + grid
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Top context bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex-shrink-0">
        {/* Project */}
        <CustomSelect
          value={selectedProjectId || ""}
          options={projects.map((p) => ({ value: p.id, label: p.name, icon: <Database className="w-3.5 h-3.5 text-[var(--neon-green)]" /> }))}
          onChange={(val) => setSelectedProjectId(val)}
          searchable
          className="w-[200px]"
        />

        <div className="w-px h-4 bg-[var(--border-default)]" />

        {/* Branch */}
        {branchesLoading ? (
          <SkeletonBlock className="rounded-lg" style={{ height: 34, width: 160 }} />
        ) : (
          <CustomSelect
            value={selectedBranchId || ""}
            options={branches.map((b) => ({ value: b.id, label: `${b.name}${b.isPrimary ? " (main)" : ""}`, icon: <GitBranch className="w-3.5 h-3.5 text-[var(--neon-green)]" /> }))}
            onChange={(val) => setSelectedBranchId(val)}
            searchable
            className="w-[180px]"
          />
        )}

        <div className="w-px h-4 bg-[var(--border-default)]" />

        {/* Database */}
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
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search tables..."
                className="w-full h-[28px] pl-7 pr-2 text-[11px] bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--neon-green)] transition-colors"
              />
            </div>
          </div>

          {/* Schema tree */}
          <div className="flex-1 overflow-y-auto py-1">
            {schemasLoading && schemas.length === 0 ? (
              <div className="px-3 py-2 space-y-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                    <SkeletonBlock style={{ height: 10, width: 10 }} />
                    <SkeletonBlock className="rounded" style={{ height: 10, width: 50 + (i * 7), opacity: 0.35 }} />
                  </div>
                ))}
              </div>
            ) : schemas.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-[11px] text-[var(--text-tertiary)]">No schemas found</p>
              </div>
            ) : (
              filteredSchemas.map((schema) => {
                const isExpanded = expandedSchemas.has(schema.name);
                return (
                  <div key={schema.name}>
                    <button
                      onClick={() => {
                        setExpandedSchemas((prev) => {
                          const next = new Set(prev);
                          if (next.has(schema.name)) next.delete(schema.name);
                          else next.add(schema.name);
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-1.5 px-3 py-1 text-left hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0" />
                      )}
                      <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                        {schema.name}
                      </span>
                      <span className="text-[9px] text-[var(--text-tertiary)] ml-auto">
                        {schema.tables.length}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="ml-2">
                        {schema.tables.map((table) => {
                          const isSelected = selectedSchema === schema.name && selectedTable === table.name;
                          return (
                            <button
                              key={`${schema.name}.${table.name}`}
                              onClick={() => handleSelectTable(schema.name, table.name)}
                              className={`w-[calc(100%-8px)] ml-1 flex items-center gap-2 px-2 py-[5px] text-left rounded transition-colors text-[11px] ${
                                isSelected
                                  ? "bg-[var(--neon-green-bg)] text-[var(--neon-green)] font-medium"
                                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              <Table className="w-3 h-3 flex-shrink-0 opacity-50" />
                              <span className="truncate font-mono">{table.name}</span>
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

          {/* Footer */}
          {schemas.length > 0 && (
            <div className="px-3 py-1.5 border-t border-[var(--border-default)] text-[9px] text-[var(--text-tertiary)]">
              {schemas.reduce((a, s) => a + s.tables.length, 0)} tables
            </div>
          )}
        </div>

        {/* Main content: Drizzle Studio grid */}
        <div className="flex-1 min-w-0 overflow-hidden bg-[var(--bg-surface)]">
          {selectedTable ? (
            <DrizzleStudioGrid
              key={`${selectedSchema}-${selectedTable}`}
              schemaName={selectedSchema || "public"}
              tableName={selectedTable}
              columns={columns}
              primaryKeys={primaryKeys}
              rows={rows}
              totalCount={totalCount}
              loading={dataLoading}
              error={dataError}
              offset={offset}
              limit={limit}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              queryTimeMs={queryTimeMs}
              onSort={handleSort}
              onPageChange={handlePageChange}
              onRefresh={fetchTableData}
              onInsert={handleInsert}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-center">
                <Table className="w-12 h-12 text-[var(--text-tertiary)]" />
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Select a Table
                </h3>
                <p className="text-[12px] text-[var(--text-tertiary)] max-w-[260px]">
                  Choose a table from the sidebar to browse and manage its data
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
