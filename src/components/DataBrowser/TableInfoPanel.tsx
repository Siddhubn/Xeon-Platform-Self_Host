"use client";

import { useState } from "react";
import {
  Columns3,
  Link2,
  Hash,
  ChevronDown,
  ChevronRight,
  Key,
  AlertCircle,
} from "lucide-react";
import type { TableInfo } from "./SchemaSidebar";

interface TableInfoPanelProps {
  table: TableInfo | null;
}

export default function TableInfoPanel({ table }: TableInfoPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["columns"])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (!table) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-[13px] text-[var(--text-tertiary)]">
          Select a table to view its details
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Table header */}
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
          {table.name}
        </h3>
        <span className="text-[11px] text-[var(--text-tertiary)]">
          {table.type}
        </span>
        {table.rowCount !== null && (
          <span className="text-[11px] text-[var(--text-tertiary)]">
            ~{table.rowCount.toLocaleString()} rows
          </span>
        )}
      </div>

      {/* Columns section */}
      <div className="mb-3">
        <button
          onClick={() => toggleSection("columns")}
          className="w-full flex items-center gap-2 py-2 text-left"
        >
          {expandedSections.has("columns") ? (
            <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />
          )}
          <Columns3 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
            Columns ({table.columns.length})
          </span>
        </button>

        {expandedSections.has("columns") && (
          <div className="ml-5 border-l border-[var(--border-default)] pl-3">
            <table className="neon-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Nullable</th>
                  <th>Default</th>
                  <th>Key</th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map((col) => (
                  <tr key={col.name}>
                    <td className="font-mono text-[12px] font-medium">
                      {col.name}
                    </td>
                    <td className="text-[12px] text-[var(--text-secondary)]">
                      {col.type}
                    </td>
                    <td className="text-[12px]">
                      {col.nullable ? (
                        <span className="text-[var(--status-active)]">YES</span>
                      ) : (
                        <span className="text-[var(--text-tertiary)]">NO</span>
                      )}
                    </td>
                    <td className="text-[12px] text-[var(--text-tertiary)] font-mono">
                      {col.defaultValue || "—"}
                    </td>
                    <td>
                      {col.isPrimaryKey && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--neon-green-bg)] text-[var(--neon-green)]">
                          <Key className="w-2.5 h-2.5" />
                          PK
                        </span>
                      )}
                      {col.isAutoIncrement && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--status-info-bg)] text-[var(--status-info)] ml-1">
                          SERIAL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Foreign Keys section */}
      {table.foreignKeys.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => toggleSection("foreignKeys")}
            className="w-full flex items-center gap-2 py-2 text-left"
          >
            {expandedSections.has("foreignKeys") ? (
              <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />
            )}
            <Link2 className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
              Foreign Keys ({table.foreignKeys.length})
            </span>
          </button>

          {expandedSections.has("foreignKeys") && (
            <div className="ml-5 border-l border-[var(--border-default)] pl-3">
              {table.foreignKeys.map((fk, i) => (
                <div
                  key={i}
                  className="py-2 text-[12px] font-mono"
                >
                  <span className="text-[var(--text-primary)]">
                    {fk.columnName}
                  </span>
                  <span className="text-[var(--text-tertiary)] mx-1.5">
                    →
                  </span>
                  <span className="text-[var(--text-secondary)]">
                    {fk.foreignTableSchema}.{fk.foreignTable}(
                    {fk.foreignColumn})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Indexes section */}
      {table.indexes.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => toggleSection("indexes")}
            className="w-full flex items-center gap-2 py-2 text-left"
          >
            {expandedSections.has("indexes") ? (
              <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" />
            ) : (
              <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />
            )}
            <Hash className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
              Indexes ({table.indexes.length})
            </span>
          </button>

          {expandedSections.has("indexes") && (
            <div className="ml-5 border-l border-[var(--border-default)] pl-3 space-y-1.5">
              {table.indexes.map((idx, i) => (
                <div key={i} className="py-1.5 text-[12px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[var(--text-primary)]">
                      {idx.name}
                    </span>
                    {idx.isUnique && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--status-info-bg)] text-[var(--status-info)]">
                        UNIQUE
                      </span>
                    )}
                  </div>
                  <span className="text-[var(--text-tertiary)] font-mono">
                    ({idx.columns.join(", ")})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
