"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Table,
  Columns3,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Check,
  X,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  Copy,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  Download,
  Clipboard,
  Eye,
  EyeOff,
  ArrowRight,
  RotateCcw,
  GitBranch,
} from "lucide-react";
import { SkeletonBlock } from "@/components/Skeleton";

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

interface RowData {
  [key: string]: unknown;
}

interface PendingChange {
  type: "insert" | "update" | "delete";
  rowIndex?: number;
  data?: Record<string, unknown>;
  primaryKey?: Record<string, unknown>;
}

interface FilterCondition {
  column: string;
  operator: "equals" | "not_equals" | "contains" | "starts_with" | "ends_with" | "greater_than" | "less_than" | "is_null" | "is_not_null";
  value: string;
}

interface DrizzleStudioGridProps {
  schemaName: string;
  tableName: string;
  columns: ColumnMeta[];
  primaryKeys: string[];
  rows: RowData[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  offset: number;
  limit: number;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  queryTimeMs: number;
  onSort: (column: string) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onInsert: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (
    primaryKey: Record<string, unknown>,
    data: Record<string, unknown>
  ) => Promise<void>;
  onDelete: (primaryKey: Record<string, unknown>) => Promise<void>;
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isNullValue(value: unknown): boolean {
  return value === null || value === undefined;
}

function isTimestampColumn(colName: string, value: unknown): boolean {
  if (isNullValue(value)) return false;
  const str = String(value);
  return (
    /\d{4}-\d{2}-\d{2}/.test(str) &&
    (colName.includes("date") ||
      colName.includes("time") ||
      colName.includes("created") ||
      colName.includes("updated") ||
      colName.includes("expires"))
  );
}

function getPrimaryKeyForRow(
  row: RowData,
  primaryKeys: string[]
): Record<string, unknown> {
  const pk: Record<string, unknown> = {};
  for (const col of primaryKeys) {
    pk[col] = row[col];
  }
  return pk;
}

function generateSQLWhere(filters: FilterCondition[]): string {
  if (filters.length === 0) return "";
  return filters.map((f) => {
    const value = f.value;
    switch (f.operator) {
      case "equals":
        return `"${f.column}" = '${value}'`;
      case "not_equals":
        return `"${f.column}" != '${value}'`;
      case "contains":
        return `"${f.column}" LIKE '%${value}%'`;
      case "starts_with":
        return `"${f.column}" LIKE '${value}%'`;
      case "ends_with":
        return `"${f.column}" LIKE '%${value}'`;
      case "greater_than":
        return `"${f.column}" > '${value}'`;
      case "less_than":
        return `"${f.column}" < '${value}'`;
      case "is_null":
        return `"${f.column}" IS NULL`;
      case "is_not_null":
        return `"${f.column}" IS NOT NULL`;
      default:
        return `"${f.column}" = '${value}'`;
    }
  }).join(" AND ");
}

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export default function DrizzleStudioGrid({
  schemaName,
  tableName,
  columns,
  primaryKeys,
  rows,
  totalCount,
  loading,
  error,
  offset,
  limit,
  sortColumn,
  sortDirection,
  queryTimeMs,
  onSort,
  onPageChange,
  onRefresh,
  onInsert,
  onUpdate,
  onDelete,
}: DrizzleStudioGridProps) {
  const [activeTab, setActiveTab] = useState<"data" | "structure">("data");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: string;
    primaryKey: Record<string, unknown>;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  // Refs to avoid stale closures in commitEdit
  const editingCellRef = useRef(editingCell);
  const editValueRef = useRef(editValue);
  // Keep refs in sync with state
  editingCellRef.current = editingCell;
  editValueRef.current = editValue;
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [showInsertRow, setShowInsertRow] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<RowData | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<FilterCondition[]>([]);
  const [showSqlPreview, setShowSqlPreview] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowIndex?: number;
  } | null>(null);

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);
  const hasPendingChanges = pendingChanges.length > 0;

  // Reset pending changes when data refreshes
  useEffect(() => {
    setPendingChanges([]);
    setSelectedRows(new Set());
  }, [rows]);

  // -----------------------------------------------------------------------
  // Client-side filtering
  // -----------------------------------------------------------------------

  const matchesFilter = (row: RowData, filter: FilterCondition): boolean => {
    const cellValue = row[filter.column];
    const cellStr = cellValue === null || cellValue === undefined ? "" : String(cellValue);
    const filterValue = filter.value.toLowerCase();
    const cellStrLower = cellStr.toLowerCase();

    switch (filter.operator) {
      case "equals":
        return cellStrLower === filterValue;
      case "not_equals":
        return cellStrLower !== filterValue;
      case "contains":
        return cellStrLower.includes(filterValue);
      case "starts_with":
        return cellStrLower.startsWith(filterValue);
      case "ends_with":
        return cellStrLower.endsWith(filterValue);
      case "greater_than":
        return Number(cellValue) > Number(filter.value);
      case "less_than":
        return Number(cellValue) < Number(filter.value);
      case "is_null":
        return cellValue === null || cellValue === undefined;
      case "is_not_null":
        return cellValue !== null && cellValue !== undefined;
      default:
        return true;
    }
  };

  const matchesSearch = (row: RowData): boolean => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return columns.some((col) => {
      const val = row[col.name];
      if (val === null || val === undefined) return false;
      return String(val).toLowerCase().includes(query);
    });
  };

  const filteredRows = rows.filter((row) => {
    if (!matchesSearch(row)) return false;
    return appliedFilters.every((filter) => matchesFilter(row, filter));
  });

  // Count of active search/filter indicators
  const hasActiveFilters = searchQuery || appliedFilters.length > 0;

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // -----------------------------------------------------------------------
  // Selection
  // -----------------------------------------------------------------------

  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filteredRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredRows.map((_, i) => i)));
    }
  };

  // -----------------------------------------------------------------------
  // Editing
  // -----------------------------------------------------------------------

  const startEdit = (rowIndex: number, colName: string, value: unknown) => {
    const row = filteredRows[rowIndex];
    if (!row) return;
    const pk = getPrimaryKeyForRow(row, primaryKeys);
    setEditingCell({ row: rowIndex, col: colName, primaryKey: pk });
    setEditValue(isNullValue(value) ? "" : String(value));
  };

  // Use refs inside commitEdit to avoid stale closure issues
  const commitEditRef = useCallback(() => {
    const cell = editingCellRef.current;
    const val = editValueRef.current;
    if (!cell) return;
    const { col: colName, primaryKey: pk, row: rowIndex } = cell;
    // Find the row from current filteredRows
    const row = rows.find((r) => {
      const rowPk = getPrimaryKeyForRow(r, primaryKeys);
      return JSON.stringify(rowPk) === JSON.stringify(pk);
    });
    if (!row) {
      setEditingCell(null);
      setEditValue("");
      return;
    }
    const oldValue = row[colName];
    const newValue = val === "" && columns.find((c) => c.name === colName)?.nullable ? null : val;

    if (String(oldValue) !== String(newValue)) {
      setPendingChanges((prev) => [
        ...prev.filter(
          (c) =>
            !(c.type === "update" &&
              JSON.stringify(c.primaryKey) === JSON.stringify(pk) &&
              c.data &&
              colName in c.data)
        ),
        {
          type: "update",
          rowIndex,
          primaryKey: pk,
          data: { [colName]: newValue },
        },
      ]);
    }

    setEditingCell(null);
    setEditValue("");
  }, [rows, columns, primaryKeys]);

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // -----------------------------------------------------------------------
  // Insert
  // -----------------------------------------------------------------------

  const initInsertRow = () => {
    const defaults: Record<string, string> = {};
    for (const col of columns) {
      defaults[col.name] = "";
    }
    setInsertData(defaults);
    setShowInsertRow(true);
  };

  const commitInsert = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const filteredData: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(insertData)) {
        if (val !== "") {
          filteredData[key] = val;
        }
      }
      await onInsert(filteredData);
      setShowInsertRow(false);
      setInsertData({});
    } catch (err: any) {
      setActionError(err.message || "Insert failed");
    } finally {
      setActionLoading(false);
    }
  };

  // Merge changes helper for save
  const getMergedChangesForSave = (): PendingChange[] => {
    const map = new Map<string, PendingChange>();
    for (const c of pendingChanges) {
      if (c.type !== "update" || !c.primaryKey) {
        map.set(JSON.stringify(c) + Math.random(), c);
        continue;
      }
      const key = JSON.stringify(c.primaryKey);
      const existing = map.get(key);
      if (existing && existing.type === "update" && existing.data) {
        map.set(key, {
          ...existing,
          data: { ...existing.data, ...c.data },
        });
      } else {
        map.set(key, { ...c });
      }
    }
    return Array.from(map.values());
  };

  // -----------------------------------------------------------------------
  // Save / Discard
  // -----------------------------------------------------------------------

  const saveChanges = async () => {
    // First commit any active edit
    commitEditRef();
    // Wait a tick for React state to settle, then read merged changes
    await new Promise((r) => setTimeout(r, 0));
    setActionLoading(true);
    setActionError(null);
    try {
      const changes = getMergedChangesForSave();
      for (const change of changes) {
        if (change.type === "update" && change.primaryKey && change.data) {
          await onUpdate(change.primaryKey, change.data);
        } else if (change.type === "delete" && change.primaryKey) {
          await onDelete(change.primaryKey);
        }
      }
      setPendingChanges([]);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || "Save failed");
    } finally {
      setActionLoading(false);
    }
  };

  const discardChanges = () => {
    // Cancel any active edit first
    setEditingCell(null);
    setEditValue("");
    setPendingChanges([]);
    onRefresh();
  };

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const handleDeleteRow = async (row: RowData) => {
    const pk = getPrimaryKeyForRow(row, primaryKeys);
    setActionLoading(true);
    setActionError(null);
    try {
      await onDelete(pk);
      setDeleteConfirm(null);
    } catch (err: any) {
      setActionError(err.message || "Delete failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      for (const rowIndex of selectedRows) {
        const row = filteredRows[rowIndex];
        if (row) {
          const pk = getPrimaryKeyForRow(row, primaryKeys);
          await onDelete(pk);
        }
      }
      setSelectedRows(new Set());
    } catch (err: any) {
      setActionError(err.message || "Delete failed");
    } finally {
      setActionLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Context menu actions
  // -----------------------------------------------------------------------

  const handleContextMenu = (e: React.MouseEvent, rowIndex: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, rowIndex });
  };

  const copyCellValue = (value: unknown) => {
    navigator.clipboard.writeText(formatCellValue(value));
    setContextMenu(null);
  };

  const copyRowAsJson = (row: RowData) => {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setContextMenu(null);
  };

  const copySelectedRows = () => {
    const selectedData = Array.from(selectedRows).map((i) => filteredRows[i]).filter(Boolean);
    navigator.clipboard.writeText(JSON.stringify(selectedData, null, 2));
    setContextMenu(null);
  };

  const duplicateRow = (row: RowData) => {
    const newRow: Record<string, unknown> = {};
    for (const col of columns) {
      if (!col.isAutoIncrement) {
        newRow[col.name] = row[col.name];
      }
    }
    setInsertData(newRow as Record<string, string>);
    setShowInsertRow(true);
    setContextMenu(null);
  };

  // -----------------------------------------------------------------------
  // Filter management
  // -----------------------------------------------------------------------

  const addFilter = () => {
    setFilters([...filters, { column: columns[0]?.name || "", operator: "equals", value: "" }]);
  };

  const updateFilter = (index: number, updates: Partial<FilterCondition>) => {
    setFilters(filters.map((f, i) => (i === index ? { ...f, ...updates } : f)));
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const clearFilters = () => {
    setFilters([]);
    setAppliedFilters([]);
    setSearchQuery("");
  };

  const applyFilters = () => {
    setAppliedFilters([...filters]);
  };

  const removeAppliedFilter = (index: number) => {
    setAppliedFilters(appliedFilters.filter((_, i) => i !== index));
  };

  // -----------------------------------------------------------------------
  // Get cell edit state
  // -----------------------------------------------------------------------

  const getCellDisplayValue = (rowIndex: number, colName: string): string => {
    if (editingCell && editingCell.row === rowIndex && editingCell.col === colName) {
      return editValue;
    }
    return formatCellValue(filteredRows[rowIndex]?.[colName]);
  };

  const isCellNull = (rowIndex: number, colName: string): boolean => {
    if (editingCell && editingCell.row === rowIndex && editingCell.col === colName) {
      return false;
    }
    return isNullValue(filteredRows[rowIndex]?.[colName]);
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Error banner */}
      {actionError && (
        <div className="px-4 py-2 bg-[var(--status-error-bg)] border-b border-[var(--border-default)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-[var(--status-error)]">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {actionError}
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 rounded hover:bg-[var(--bg-hover)]"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Search & Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
        {/* Search input */}
        <div className="relative flex-1 max-w-[300px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records..."
            className="w-full h-[28px] pl-7 pr-7 text-[11px] bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--neon-green)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter button */}
        <button
          onClick={() => setShowFilterBar(!showFilterBar)}
          className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded transition-colors ${
            showFilterBar || appliedFilters.length > 0
              ? "bg-[var(--neon-green-bg)] text-[var(--neon-green)] border border-[var(--neon-green-border)]"
              : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)]"
          }`}
        >
          <Filter className="w-3 h-3" />
          Filters
          {appliedFilters.length > 0 && (
            <span className="ml-0.5 px-1 py-0 text-[9px] font-bold bg-[var(--neon-green)] text-[var(--accent-foreground)] rounded-full">
              {appliedFilters.length}
            </span>
          )}
        </button>

        {/* SQL Preview button */}
        <button
          onClick={() => setShowSqlPreview(!showSqlPreview)}
          className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded transition-colors ${
            showSqlPreview
              ? "bg-[var(--status-info-bg)] text-[var(--status-info)] border border-[var(--status-info)]"
              : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border-default)]"
          }`}
        >
          <span className="font-mono">{"{ }"}</span>
          SQL
        </button>

        {/* Selected rows count */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[11px] text-[var(--neon-green)] font-medium">
              {selectedRows.size} row{selectedRows.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={copySelectedRows}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Applied filters chips */}
      {appliedFilters.length > 0 && !showFilterBar && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex-wrap">
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">Active:</span>
          {appliedFilters.map((filter, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[var(--neon-green-bg)] text-[var(--neon-green)] border border-[var(--neon-green-border)] rounded-full"
            >
              <span className="font-mono">{filter.column}</span>
              <span className="text-[var(--text-tertiary)]">{filter.operator.replace("_", " ")}</span>
              {filter.operator !== "is_null" && filter.operator !== "is_not_null" && (
                <span className="font-mono">{filter.value}</span>
              )}
              <button
                onClick={() => removeAppliedFilter(index)}
                className="ml-0.5 p-0 rounded-full hover:bg-[var(--neon-green-border)] transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <button
            onClick={clearFilters}
            className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--status-error)] transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter conditions bar */}
      {showFilterBar && (
        <div className="px-3 py-2 border-b border-[var(--border-default)] bg-[var(--bg-inset)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              WHERE
            </span>
            <button
              onClick={addFilter}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-[var(--neon-green)] hover:bg-[var(--neon-green-bg)] rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add filter
            </button>
            {filters.length > 0 && (
              <>
                <button
                  onClick={applyFilters}
                  className="flex items-center gap-1 px-3 py-0.5 text-[10px] font-semibold text-[var(--accent-foreground)] bg-[var(--neon-green)] hover:bg-[var(--neon-green-hover)] rounded transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Apply filter
                </button>
                <button
                  onClick={() => setFilters([])}
                  className="text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>

          {/* Filter rows */}
          <div className="flex flex-col gap-1.5">
            {filters.map((filter, index) => (
              <div key={index} className="flex items-center gap-2">
                {index > 0 && (
                  <span className="text-[10px] text-[var(--text-tertiary)] w-12">
                    AND
                  </span>
                )}
                <select
                  value={filter.column}
                  onChange={(e) => updateFilter(index, { column: e.target.value })}
                  className="h-[26px] px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--neon-green)]"
                >
                  {columns.map((col) => (
                    <option key={col.name} value={col.name}>
                      {col.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(index, { operator: e.target.value as FilterCondition["operator"] })}
                  className="h-[26px] px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[var(--text-primary)] outline-none focus:border-[var(--neon-green)]"
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="contains">contains</option>
                  <option value="starts_with">starts with</option>
                  <option value="ends_with">ends with</option>
                  <option value="greater_than">greater than</option>
                  <option value="less_than">less than</option>
                  <option value="is_null">is null</option>
                  <option value="is_not_null">is not null</option>
                </select>

                {filter.operator !== "is_null" && filter.operator !== "is_not_null" && (
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => updateFilter(index, { value: e.target.value })}
                    placeholder="Value..."
                    className="h-[26px] px-2 text-[11px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--neon-green)] w-[120px]"
                  />
                )}

                <button
                  onClick={() => removeFilter(index)}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* SQL preview */}
          {showSqlPreview && (
            <div className="mt-2 p-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded font-mono text-[11px] text-[var(--text-secondary)]">
              <span className="text-[var(--neon-green)]">SELECT</span> * <span className="text-[var(--neon-green)]">FROM</span> {schemaName}.{tableName}
              {appliedFilters.length > 0 && (
                <> {" "}<span className="text-[var(--neon-green)]">WHERE</span> {generateSQLWhere(appliedFilters)}</>
              )}
              {sortColumn && (
                <> {" "}<span className="text-[var(--neon-green)]">ORDER BY</span> {sortColumn} {sortDirection.toUpperCase()}</>
              )}
              {" "}<span className="text-[var(--neon-green)]">LIMIT</span> {limit} <span className="text-[var(--neon-green)]">OFFSET</span> {offset};
            </div>
          )}
        </div>
      )}

      {/* Toolbar — matches Drizzle Studio screenshot */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex-nowrap overflow-x-auto">
        {/* Table icon */}
        <button className="p-1.5 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0">
          <Table className="w-4 h-4" />
        </button>

        {/* DATA / STRUCTURE tabs */}
        <div className="flex items-center border border-[var(--border-default)] rounded-md overflow-hidden ml-1 flex-shrink-0">
          <button
            onClick={() => setActiveTab("data")}
            className={`px-2 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${
              activeTab === "data"
                ? "bg-[var(--bg-surface-secondary)] text-[var(--text-primary)] border-r border-[var(--border-default)]"
                : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] border-r border-[var(--border-default)]"
            }`}
          >
            <Table className="w-3 h-3" />
            DATA
          </button>
          <button
            onClick={() => setActiveTab("structure")}
            className={`px-2 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${
              activeTab === "structure"
                ? "bg-[var(--bg-surface-secondary)] text-[var(--text-primary)]"
                : "text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <Columns3 className="w-3 h-3" />
            STRUCTURE
          </button>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center ml-1 flex-shrink-0">
          <button
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={currentPage <= 1}
            className="p-0.5 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() =>
              onPageChange(Math.min((totalPages - 1) * limit, offset + limit))
            }
            disabled={currentPage >= totalPages}
            className="p-0.5 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-3 bg-[var(--border-default)] mx-1 flex-shrink-0" />

        {/* + Add record */}
        <button
          onClick={initInsertRow}
          disabled={showInsertRow}
          className="px-2 py-1 text-[11px] font-semibold rounded bg-[var(--text-primary)] text-[var(--bg-surface)] hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1 whitespace-nowrap flex-shrink-0"
        >
          <Plus className="w-3 h-3" />
          Add record
        </button>

        {/* Save changes */}
        <button
          onClick={saveChanges}
          disabled={!hasPendingChanges || actionLoading}
          className={`px-2 py-1 text-[11px] font-semibold rounded transition-all flex items-center gap-1 whitespace-nowrap flex-shrink-0 ${
            hasPendingChanges
              ? "bg-[var(--neon-green)] text-[var(--accent-foreground)] hover:opacity-90"
              : "bg-[var(--bg-inset)] text-[var(--text-tertiary)] cursor-not-allowed"
          }`}
        >
          {actionLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          Save changes
        </button>

        {/* Discard changes */}
        <button
          onClick={discardChanges}
          disabled={!hasPendingChanges}
          className="px-2 py-1 text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
        >
          Discard changes
        </button>

        {/* Spacer */}
        <div className="flex-1 min-w-2" />

        {/* Timing */}
        <span className="text-[11px] text-[var(--text-tertiary)] whitespace-nowrap flex-shrink-0">
          {queryTimeMs}ms
        </span>

        {/* Pagination */}
        <span className="text-[11px] text-[var(--text-secondary)] ml-2 whitespace-nowrap flex-shrink-0">
          {hasActiveFilters ? (
            <span className="text-[var(--neon-green)]">
              {filteredRows.length} of {totalCount > 50 ? "50+" : totalCount} rows
            </span>
          ) : (
            totalCount > 0
              ? `${offset + 1} - ${Math.min(offset + limit, totalCount)} of ${totalCount > 50 ? "50+" : totalCount}`
              : "0 rows"
          )}
        </span>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors ml-1 flex-shrink-0"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin-slow" : ""}`}
          />
        </button>

        {/* More menu */}
        <button className="p-1 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      {activeTab === "data" ? (
        <div ref={gridRef} className="flex-1 overflow-auto">
          {loading && rows.length === 0 ? (
            <div className="p-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b" style={{ borderColor: "var(--border-default)", animationDelay: `${i * 40}ms` }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <SkeletonBlock key={j} className="rounded" style={{ height: 10, width: 50 + ((i * 11 + j * 5 + 3) % 70), opacity: 0.3 }} />
                  ))}
                </div>
              ))}
            </div>
          ) : rows.length === 0 && !showInsertRow ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <Table className="w-10 h-10 text-[var(--text-tertiary)]" />
                <p className="text-[13px] text-[var(--text-secondary)]">
                  No data found
                </p>
                <button onClick={initInsertRow} className="neon-btn neon-btn-primary neon-btn-sm">
                  <Plus className="w-3.5 h-3.5" />
                  Add first record
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[var(--border-default)]">
                  {/* Checkbox column */}
                  <th className="w-[36px] px-2 py-1.5 text-center border-r border-[var(--border-default)] bg-[var(--bg-inset)]">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === filteredRows.length && filteredRows.length > 0}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 rounded border-[var(--border-default)] accent-[var(--neon-green)]"
                    />
                  </th>
                  {/* Column headers */}
                  {columns.map((col) => (
                    <th
                      key={col.name}
                      onClick={() => onSort(col.name)}
                      className="px-2.5 py-1.5 text-left font-medium text-[var(--text-secondary)] border-r border-[var(--border-default)] bg-[var(--bg-inset)] cursor-pointer select-none hover:bg-[var(--bg-hover-strong)] transition-colors whitespace-nowrap group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px]">
                          {col.name}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)] font-normal">
                          {col.type}
                        </span>
                        <span className="flex-shrink-0">
                          {sortColumn === col.name ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="w-3 h-3 text-[var(--neon-green)]" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-[var(--neon-green)]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          )}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Insert row */}
                {showInsertRow && (
                  <tr className="border-b border-[var(--border-default)] bg-[var(--neon-green-bg)]">
                    <td className="px-2 py-1 text-center border-r border-[var(--border-default)]">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={commitInsert}
                          disabled={actionLoading}
                          className="p-0.5 rounded text-[var(--neon-green)] hover:bg-[var(--neon-green-border)]"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setShowInsertRow(false);
                            setInsertData({});
                          }}
                          className="p-0.5 rounded text-[var(--status-error)] hover:bg-[var(--status-error-bg)]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    {columns.map((col) => (
                      <td
                        key={col.name}
                        className="px-1 py-0 border-r border-[var(--border-default)]"
                      >
                        <input
                          type="text"
                          value={insertData[col.name] ?? ""}
                          onChange={(e) =>
                            setInsertData({
                              ...insertData,
                              [col.name]: e.target.value,
                            })
                          }
                          placeholder={
                            col.isAutoIncrement
                              ? "auto"
                              : col.nullable
                                ? "NULL"
                                : ""
                          }
                          disabled={col.isAutoIncrement}
                          className="w-full bg-transparent border border-[var(--neon-green-border)] rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:border-[var(--neon-green)] text-[var(--text-primary)]"
                          autoFocus
                        />
                      </td>
                    ))}
                  </tr>
                )}

                {/* Data rows */}
            {filteredRows.map((row, ri) => {
              const pk = getPrimaryKeyForRow(row, primaryKeys);
              const isSelected = selectedRows.has(ri);

                  return (
                    <tr
                      key={ri}
                      onContextMenu={(e) => handleContextMenu(e, ri)}
                      className={`border-b border-[var(--border-default)] transition-colors ${
                        isSelected ? "bg-[var(--neon-green-bg)]" : "hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-2 py-1 text-center border-r border-[var(--border-default)]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelection(ri)}
                          className="w-3.5 h-3.5 rounded border-[var(--border-default)] accent-[var(--neon-green)]"
                        />
                      </td>
                      {/* Data cells */}
                      {columns.map((col) => {
                        const isEditing =
                          editingCell?.row === ri && editingCell?.col === col.name;
                        const rawValue = row[col.name];
                        const isPk = primaryKeys.includes(col.name);
                        const isTimestamp = isTimestampColumn(col.name, rawValue);
                        const cellNull = isCellNull(ri, col.name);

                        return (
                          <td
                            key={col.name}
                            onDoubleClick={() =>
                              startEdit(ri, col.name, rawValue)
                            }
                            className={`px-2.5 py-1 border-r border-[var(--border-default)] font-mono text-[11px] max-w-[200px] truncate cursor-default ${
                              isEditing
                                ? "bg-[var(--bg-inset)] p-0"
                                : cellNull
                                  ? "text-[var(--text-tertiary)] italic"
                                  : isTimestamp
                                    ? "bg-amber-50 text-amber-800"
                                    : isPk
                                      ? "text-[var(--neon-green)] font-semibold"
                                      : "text-[var(--text-primary)]"
                            }`}
                            style={
                              isTimestamp && !cellNull
                                ? { backgroundColor: "rgba(245, 158, 11, 0.08)", color: "#d97706" }
                                : undefined
                            }
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => commitEditRef()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") commitEditRef();
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                className="w-full h-full bg-transparent border border-[var(--neon-green)] rounded-none px-2 py-1 text-[11px] font-mono focus:outline-none text-[var(--text-primary)]"
                                autoFocus
                              />
                            ) : (
                              <span className="block truncate" title={formatCellValue(rawValue)}>
                                {formatCellValue(rawValue)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        /* STRUCTURE tab */
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="px-3 py-2 text-left font-medium text-[var(--text-tertiary)] bg-[var(--bg-inset)]">
                  Name
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-tertiary)] bg-[var(--bg-inset)]">
                  Type
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-tertiary)] bg-[var(--bg-inset)]">
                  Nullable
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-tertiary)] bg-[var(--bg-inset)]">
                  Default
                </th>
                <th className="px-3 py-2 text-left font-medium text-[var(--text-tertiary)] bg-[var(--bg-inset)]">
                  Key
                </th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => (
                <tr
                  key={col.name}
                  className="border-b border-[var(--border-default)] hover:bg-[var(--bg-hover)]"
                >
                  <td className="px-3 py-2 font-mono font-medium text-[var(--text-primary)]">
                    {col.name}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">
                    {col.type}
                  </td>
                  <td className="px-3 py-2">
                    {col.nullable ? (
                      <span className="text-[var(--status-active)]">YES</span>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">NO</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-tertiary)] font-mono">
                    {col.defaultValue || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {col.isPrimaryKey && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--neon-green-bg)] text-[var(--neon-green)]">
                        PK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 rounded-lg py-1 min-w-[180px] dropdown-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              if (contextMenu.rowIndex !== undefined) {
                copyRowAsJson(filteredRows[contextMenu.rowIndex]);
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)] transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            Copy row as JSON
          </button>
          <button
            onClick={() => {
              if (contextMenu.rowIndex !== undefined) {
                duplicateRow(filteredRows[contextMenu.rowIndex]);
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--text-primary)] hover:bg-[var(--bg-hover-strong)] transition-colors"
          >
            <Clipboard className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            Duplicate row
          </button>
          <div className="border-t border-[var(--border-hover)] my-1" />
          <button
            onClick={() => {
              if (contextMenu.rowIndex !== undefined) {
                setDeleteConfirm(filteredRows[contextMenu.rowIndex]);
                setContextMenu(null);
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete row
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          className="neon-modal-overlay"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--status-error-bg)] flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-[var(--status-error)]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold">Delete Row</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)]">
                    This action cannot be undone
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="neon-btn neon-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteRow(deleteConfirm)}
                  disabled={actionLoading}
                  className="neon-btn neon-btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
