"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit3,
  Table,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
  X,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";
import { SkeletonBlock } from "@/components/Skeleton";

interface RowData {
  [key: string]: unknown;
}

interface ColumnMeta {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey?: boolean;
  isAutoIncrement?: boolean;
}

interface DataTableProps {
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
  filterColumn: string | null;
  filterOperator: string;
  filterValue: string;
  onSort: (column: string) => void;
  onFilter: (
    column: string | null,
    operator: string,
    value: string
  ) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onInsert: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (
    primaryKey: Record<string, unknown>,
    data: Record<string, unknown>
  ) => Promise<void>;
  onDelete: (primaryKey: Record<string, unknown>) => Promise<void>;
}

export default function DataTable({
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
  filterColumn,
  filterOperator,
  filterValue,
  onSort,
  onFilter,
  onPageChange,
  onRefresh,
  onInsert,
  onUpdate,
  onDelete,
}: DataTableProps) {
  const [showFilter, setShowFilter] = useState(false);
  const [editingRow, setEditingRow] = useState<RowData | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [showInsertRow, setShowInsertRow] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<RowData | null>(null);
  const [localFilter, setLocalFilter] = useState({
    column: filterColumn || "",
    operator: filterOperator || "contains",
    value: filterValue || "",
  });
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync filter state
  useEffect(() => {
    setLocalFilter({
      column: filterColumn || "",
      operator: filterOperator || "contains",
      value: filterValue || "",
    });
  }, [filterColumn, filterOperator, filterValue]);

  const totalPages = Math.ceil(totalCount / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  const copyToClipboard = useCallback((text: string, cellKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(cellKey);
    setTimeout(() => setCopiedCell(null), 1500);
  }, []);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const isNull = (value: unknown): boolean =>
    value === null || value === undefined;

  const getPrimaryKeyForRow = (row: RowData): Record<string, unknown> => {
    const pk: Record<string, unknown> = {};
    for (const col of primaryKeys) {
      pk[col] = row[col];
    }
    return pk;
  };

  const handleStartEdit = (row: RowData) => {
    setEditingRow(row);
    const editValues: Record<string, string> = {};
    for (const col of columns) {
      editValues[col.name] = formatValue(row[col.name]);
    }
    setEditData(editValues);
  };

  const handleSaveEdit = async () => {
    if (!editingRow) return;
    const pk = getPrimaryKeyForRow(editingRow);
    try {
      await onUpdate(pk, editData);
      setEditingRow(null);
      setEditData({});
    } catch (err: any) {
      setActionError(err.message || "Update failed");
    }
  };

  const handleInsert = async () => {
    try {
      // Filter out empty values for auto-increment columns
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
    }
  };

  const handleDelete = async (row: RowData) => {
    const pk = getPrimaryKeyForRow(row);
    try {
      await onDelete(pk);
      setDeleteConfirm(null);
    } catch (err: any) {
      setActionError(err.message || "Delete failed");
    }
  };

  const applyFilter = () => {
    if (localFilter.column && localFilter.value) {
      onFilter(localFilter.column, localFilter.operator, localFilter.value);
    } else {
      onFilter(null, "contains", "");
    }
    setShowFilter(false);
  };

  const clearFilter = () => {
    setLocalFilter({ column: "", operator: "contains", value: "" });
    onFilter(null, "contains", "");
    setShowFilter(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-default)] bg-[var(--bg-inset)]">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">
            {schemaName}.{tableName}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)]">
            {totalCount.toLocaleString()} row{totalCount !== 1 ? "s" : ""}
          </span>
          {filterColumn && filterValue && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--neon-green-bg)] text-[10px] font-medium text-[var(--neon-green)]">
              <Filter className="w-2.5 h-2.5" />
              Filtered
              <button
                onClick={clearFilter}
                className="ml-0.5 hover:text-[var(--text-primary)]"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Filter button */}
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`neon-btn neon-btn-ghost neon-btn-sm ${
                filterColumn && filterValue
                  ? "!text-[var(--neon-green)]"
                  : ""
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filter
            </button>

            {showFilter && (
              <div className="absolute right-0 top-full mt-1 w-[320px] p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg z-50 animate-dropdown-enter">
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
                  Filter Rows
                </div>
                <div className="flex gap-2 mb-2">
                  <select
                    value={localFilter.column}
                    onChange={(e) =>
                      setLocalFilter({ ...localFilter, column: e.target.value })
                    }
                    className="neon-input h-[32px] text-[11px] flex-1"
                  >
                    <option value="">Select column...</option>
                    {columns.map((col) => (
                      <option key={col.name} value={col.name}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={localFilter.operator}
                    onChange={(e) =>
                      setLocalFilter({
                        ...localFilter,
                        operator: e.target.value,
                      })
                    }
                    className="neon-input h-[32px] text-[11px] w-[100px]"
                  >
                    <option value="contains">contains</option>
                    <option value="eq">equals</option>
                    <option value="neq">not equals</option>
                    <option value="gt">greater than</option>
                    <option value="gte">≥</option>
                    <option value="lt">less than</option>
                    <option value="lte">≤</option>
                    <option value="startsWith">starts with</option>
                    <option value="endsWith">ends with</option>
                    <option value="isNull">is null</option>
                    <option value="isNotNull">is not null</option>
                    <option value="isEmpty">is empty</option>
                    <option value="isNotEmpty">is not empty</option>
                  </select>
                </div>
                {!["isNull", "isNotNull", "isEmpty", "isNotEmpty"].includes(
                  localFilter.operator
                ) && (
                  <input
                    type="text"
                    value={localFilter.value}
                    onChange={(e) =>
                      setLocalFilter({
                        ...localFilter,
                        value: e.target.value,
                      })
                    }
                    placeholder="Filter value..."
                    className="neon-input h-[32px] text-[11px] mb-2"
                    onKeyDown={(e) => e.key === "Enter" && applyFilter()}
                    autoFocus
                  />
                )}
                <div className="flex gap-2 justify-end">
                  <button onClick={clearFilter} className="neon-btn neon-btn-ghost neon-btn-sm">
                    Clear
                  </button>
                  <button onClick={applyFilter} className="neon-btn neon-btn-primary neon-btn-sm">
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Insert button */}
          <button
            onClick={() => {
              const defaults: Record<string, string> = {};
              for (const col of columns) {
                defaults[col.name] = "";
              }
              setInsertData(defaults);
              setShowInsertRow(true);
            }}
            className="neon-btn neon-btn-primary neon-btn-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Insert
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            className="neon-btn neon-btn-ghost neon-btn-sm"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin-slow" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="px-4 py-2 bg-[var(--status-error-bg)] border-b border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-[var(--status-error)]">
            <AlertCircle className="w-3.5 h-3.5" />
            {actionError}
          </div>
          <button
            onClick={() => setActionError(null)}
            className="p-1 rounded hover:bg-red-100"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Error message from parent */}
      {error && (
        <div className="px-4 py-2 bg-[var(--status-error-bg)] border-b border-red-200 flex items-center gap-2 text-[12px] text-[var(--status-error)]">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Data grid */}
      <div className="flex-1 overflow-auto">
        {loading && rows.length === 0 ? (
          <div className="p-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b" style={{ borderColor: "var(--border-default)", animationDelay: `${i * 40}ms` }}>
                {Array.from({ length: 5 }).map((_, j) => (
                  <SkeletonBlock key={j} className="rounded" style={{ height: 10, width: 60 + ((i * 13 + j * 7 + 5) % 60), opacity: 0.3 }} />
                ))}
              </div>
            ))}
          </div>
        ) : rows.length === 0 && !showInsertRow ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Table className="w-10 h-10 text-[var(--text-tertiary)]" />
              <p className="text-[13px] text-[var(--text-secondary)]">
                No data found
              </p>
              <button
                onClick={() => {
                  const defaults: Record<string, string> = {};
                  for (const col of columns) {
                    defaults[col.name] = "";
                  }
                  setInsertData(defaults);
                  setShowInsertRow(true);
                }}
                className="neon-btn neon-btn-primary neon-btn-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Insert first row
              </button>
            </div>
          </div>
        ) : (
          <table className="neon-table">
            <thead>
              <tr>
                {/* Row actions column */}
                <th className="w-[80px] text-center">Actions</th>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className="cursor-pointer select-none group"
                    onClick={() => onSort(col.name)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono">{col.name}</span>
                      {col.isPrimaryKey && (
                        <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-[var(--neon-green-bg)] text-[var(--neon-green)]">
                          PK
                        </span>
                      )}
                      {sortColumn === col.name ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-[var(--neon-green)]" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-[var(--neon-green)]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                      )}
                      <span className="text-[9px] text-[var(--text-tertiary)] font-normal ml-0.5">
                        {col.type}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Insert row */}
              {showInsertRow && (
                <tr className="bg-[var(--neon-green-bg)]">
                  <td className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={handleInsert}
                        className="p-1 rounded text-[var(--neon-green)] hover:bg-[var(--neon-green-border)] transition-colors"
                        title="Save"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setShowInsertRow(false);
                          setInsertData({});
                        }}
                        className="p-1 rounded text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  {columns.map((col) => (
                    <td key={col.name}>
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
                        className="w-full bg-transparent border border-[var(--neon-green-border)] rounded px-2 py-1 text-[12px] font-mono focus:outline-none focus:border-[var(--neon-green)] text-[var(--text-primary)]"
                        disabled={col.isAutoIncrement}
                      />
                    </td>
                  ))}
                </tr>
              )}

              {/* Data rows */}
              {rows.map((row, ri) => {
                const pk = getPrimaryKeyForRow(row);
                const isEditing =
                  editingRow &&
                  JSON.stringify(getPrimaryKeyForRow(editingRow)) ===
                    JSON.stringify(pk);

                return (
                  <tr key={ri}>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              className="p-1 rounded text-[var(--neon-green)] hover:bg-[var(--neon-green-bg)] transition-colors"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingRow(null);
                                setEditData({});
                              }}
                              className="p-1 rounded text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEdit(row)}
                              className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(row)}
                              className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-bg)] transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                    {columns.map((col) => {
                      const cellKey = `${ri}-${col.name}`;
                      const rawValue = isEditing
                        ? editData[col.name]
                        : row[col.name];
                      const cellText = formatValue(rawValue);

                      return (
                        <td key={col.name}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData[col.name] ?? ""}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  [col.name]: e.target.value,
                                })
                              }
                              className="w-full bg-transparent border border-[var(--neon-green-border)] rounded px-2 py-1 text-[12px] font-mono focus:outline-none focus:border-[var(--neon-green)] text-[var(--text-primary)]"
                              autoFocus
                            />
                          ) : (
                            <div
                              className="group/cell flex items-center gap-1 cursor-pointer"
                              onClick={() => copyToClipboard(cellText, cellKey)}
                            >
                              <span
                                className={`font-mono text-[12px] truncate ${
                                  isNull(rawValue)
                                    ? "text-[var(--text-tertiary)] italic"
                                    : "text-[var(--text-primary)]"
                                }`}
                              >
                                {cellText}
                              </span>
                              {copiedCell === cellKey ? (
                                <Check className="w-3 h-3 text-[var(--status-active)] opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0" />
                              ) : (
                                <Copy className="w-3 h-3 text-[var(--text-tertiary)] opacity-0 group-hover/cell:opacity-100 transition-opacity flex-shrink-0" />
                              )}
                            </div>
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

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-default)] bg-[var(--bg-inset)]">
        <span className="text-[11px] text-[var(--text-tertiary)]">
          Showing {offset + 1}–{Math.min(offset + limit, totalCount)} of{" "}
          {totalCount.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(0)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-[var(--text-secondary)] font-medium px-2">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() =>
              onPageChange(Math.min((totalPages - 1) * limit, offset + limit))
            }
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onPageChange((totalPages - 1) * limit)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

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
              <p className="text-[13px] text-[var(--text-secondary)] mb-4">
                Are you sure you want to delete this row from{" "}
                <code className="font-mono bg-[var(--bg-inset)] px-1.5 py-0.5 rounded border border-[var(--border-default)]">
                  {schemaName}.{tableName}
                </code>
                ?
              </p>
              <div className="p-3 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)] mb-4">
                {Object.entries(getPrimaryKeyForRow(deleteConfirm)).map(
                  ([key, val]) => (
                    <div key={key} className="flex gap-2 text-[12px] font-mono">
                      <span className="text-[var(--text-tertiary)]">{key}:</span>
                      <span className="text-[var(--text-primary)]">
                        {formatValue(val)}
                      </span>
                    </div>
                  )
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="neon-btn neon-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="neon-btn neon-btn-danger"
                >
                  Delete Row
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
