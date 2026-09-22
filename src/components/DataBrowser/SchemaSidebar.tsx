"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Table,
  Eye,
  Columns3,
  Search,
  RefreshCw,
} from "lucide-react";
import { SkeletonBlock } from "@/components/Skeleton";

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  ordinalPosition: number;
}

export interface ForeignKeyInfo {
  columnName: string;
  foreignTableSchema: string;
  foreignTable: string;
  foreignColumn: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface TableInfo {
  schema: string;
  name: string;
  type: "table" | "view";
  rowCount: number | null;
  columns: ColumnInfo[];
  foreignKeys: ForeignKeyInfo[];
  indexes: IndexInfo[];
}

export interface SchemaInfo {
  name: string;
  tables: TableInfo[];
}

interface SchemaSidebarProps {
  schemas: SchemaInfo[];
  selectedSchema: string | null;
  selectedTable: string | null;
  onSelectTable: (schema: string, table: string) => void;
  loading: boolean;
  onRefresh: () => void;
}

export default function SchemaSidebar({
  schemas,
  selectedSchema,
  selectedTable,
  onSelectTable,
  loading,
  onRefresh,
}: SchemaSidebarProps) {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(
    new Set(schemas.length > 0 ? [schemas[0].name] : [])
  );
  const [searchQuery, setSearchQuery] = useState("");

  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schemaName)) {
        next.delete(schemaName);
      } else {
        next.add(schemaName);
      }
      return next;
    });
  };

  const filteredSchemas = schemas.map((schema) => ({
    ...schema,
    tables: schema.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        schema.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((s) => s.tables.length > 0 || searchQuery === "");

  return (
    <div className="w-[280px] flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-default)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Schemas
          </h3>
          <button
            onClick={onRefresh}
            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin-slow" : ""}`}
            />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tables..."
            className="neon-input h-[30px] text-[11px] pl-8"
          />
        </div>
      </div>

      {/* Schema tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && schemas.length === 0 ? (
          <div className="px-3 py-2 space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <SkeletonBlock style={{ height: 10, width: 10 }} />
                <SkeletonBlock className="rounded" style={{ height: 10, width: 50 + (i * 8), opacity: 0.35 }} />
              </div>
            ))}
          </div>
        ) : schemas.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[12px] text-[var(--text-tertiary)]">
              No schemas found
            </p>
          </div>
        ) : (
          filteredSchemas.map((schema) => {
            const isExpanded =
              expandedSchemas.has(schema.name) ||
              (searchQuery !== "" && schema.tables.length > 0);

            return (
              <div key={schema.name}>
                {/* Schema header */}
                <button
                  onClick={() => toggleSchema(schema.name)}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-[var(--bg-hover)] transition-colors group"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] flex-shrink-0" />
                  )}
                  <span className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    {schema.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                    {schema.tables.length}
                  </span>
                </button>

                {/* Tables */}
                {isExpanded && (
                  <div className="ml-3">
                    {schema.tables.map((table) => {
                      const isSelected =
                        selectedSchema === schema.name &&
                        selectedTable === table.name;

                      return (
                        <button
                          key={`${schema.name}.${table.name}`}
                          onClick={() =>
                            onSelectTable(schema.name, table.name)
                          }
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left rounded-md mx-2 transition-colors ${
                            isSelected
                              ? "bg-[var(--neon-green-bg)] text-[var(--neon-green)]"
                              : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                          }`}
                          style={{ width: "calc(100% - 16px)" }}
                        >
                          {table.type === "view" ? (
                            <Eye className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                          ) : (
                            <Table className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                          )}
                          <span className="text-[12px] font-mono truncate flex-1">
                            {table.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-tertiary)] flex-shrink-0">
                            {table.columns.length} col
                          </span>
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

      {/* Footer stats */}
      {schemas.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border-default)] flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
          <span>
            {schemas.reduce((acc, s) => acc + s.tables.length, 0)} tables
          </span>
          <span>·</span>
          <span>{schemas.length} schemas</span>
        </div>
      )}
    </div>
  );
}
