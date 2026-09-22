"use client";

import { useState, useCallback, useEffect } from "react";
import SchemaSidebar, {
  type SchemaInfo,
  type TableInfo,
  type ColumnInfo,
} from "./SchemaSidebar";
import DataTable from "./DataTable";
import TableInfoPanel from "./TableInfoPanel";
import { Columns3, Table } from "lucide-react";

interface DataBrowserProps {
  projectId: string;
  branchId: string;
  databaseName: string;
}

interface RowData {
  [key: string]: unknown;
}

export default function DataBrowser({
  projectId,
  branchId,
  databaseName,
}: DataBrowserProps) {
  // Schema metadata state
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  // Selected table state
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedTableInfo, setSelectedTableInfo] = useState<TableInfo | null>(
    null
  );

  // Table data state
  const [rows, setRows] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<
    { name: string; type: string; nullable: boolean; defaultValue: string | null }[]
  >([]);
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Pagination & sorting & filtering
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterOperator, setFilterOperator] = useState("contains");
  const [filterValue, setFilterValue] = useState("");

  // Active info panel tab
  const [infoTab, setInfoTab] = useState<"data" | "structure">("data");

  // -----------------------------------------------------------------------
  // Fetch metadata (schemas + tables)
  // -----------------------------------------------------------------------

  const fetchMetadata = useCallback(async () => {
    setMetadataLoading(true);
    setMetadataError(null);
    try {
      const params = new URLSearchParams({
        projectId,
        branchId,
        databaseName,
      });
      const res = await fetch(`/api/data/metadata?${params}`);
      const data = await res.json();
      if (data.error) {
        setMetadataError(data.error);
        setSchemas([]);
      } else {
        setSchemas(data.schemas || []);
      }
    } catch {
      setMetadataError("Failed to fetch database metadata");
      setSchemas([]);
    } finally {
      setMetadataLoading(false);
    }
  }, [projectId, branchId, databaseName]);

  // Fetch metadata on mount and when context changes
  useEffect(() => {
    if (projectId && branchId && databaseName) {
      fetchMetadata();
    }
  }, [projectId, branchId, databaseName, fetchMetadata]);

  // Auto-select first table
  useEffect(() => {
    if (
      schemas.length > 0 &&
      !selectedTable &&
      schemas[0]?.tables.length > 0
    ) {
      setSelectedSchema(schemas[0].name);
      setSelectedTable(schemas[0].tables[0].name);
    }
  }, [schemas, selectedTable]);

  // -----------------------------------------------------------------------
  // Fetch table data
  // -----------------------------------------------------------------------

  const fetchTableData = useCallback(async () => {
    if (!selectedSchema || !selectedTable) return;

    setDataLoading(true);
    setDataError(null);
    try {
      const params = new URLSearchParams({
        projectId,
        branchId,
        databaseName,
        schema: selectedSchema,
        table: selectedTable,
        offset: String(offset),
        limit: String(limit),
      });
      if (sortColumn) {
        params.set("sortColumn", sortColumn);
        params.set("sortDirection", sortDirection);
      }
      if (filterColumn && filterValue) {
        params.set("filterColumn", filterColumn);
        params.set("filterOperator", filterOperator);
        params.set("filterValue", filterValue);
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
      }
    } catch {
      setDataError("Failed to fetch table data");
      setRows([]);
      setColumns([]);
      setPrimaryKeys([]);
      setTotalCount(0);
    } finally {
      setDataLoading(false);
    }
  }, [
    projectId,
    branchId,
    databaseName,
    selectedSchema,
    selectedTable,
    offset,
    limit,
    sortColumn,
    sortDirection,
    filterColumn,
    filterOperator,
    filterValue,
  ]);

  // Fetch data when selection or params change
  useEffect(() => {
    if (selectedSchema && selectedTable) {
      fetchTableData();
    }
  }, [fetchTableData]);

  // Update selectedTableInfo when schemas or selection changes
  useEffect(() => {
    if (selectedSchema && selectedTable) {
      const schema = schemas.find((s) => s.name === selectedSchema);
      const table = schema?.tables.find((t) => t.name === selectedTable);
      setSelectedTableInfo(table || null);
    }
  }, [schemas, selectedSchema, selectedTable]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSelectTable = (schema: string, table: string) => {
    setSelectedSchema(schema);
    setSelectedTable(table);
    setOffset(0);
    setSortColumn(null);
    setSortDirection("asc");
    setFilterColumn(null);
    setFilterValue("");
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setOffset(0);
  };

  const handleFilter = (
    column: string | null,
    operator: string,
    value: string
  ) => {
    setFilterColumn(column);
    setFilterOperator(operator);
    setFilterValue(value);
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
        projectId,
        branchId,
        databaseName,
        schema: selectedSchema,
        table: selectedTable,
        data,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || "Insert failed");
    }
    // Refresh data after insert
    await fetchTableData();
  };

  const handleUpdate = async (
    primaryKey: Record<string, unknown>,
    data: Record<string, unknown>
  ) => {
    const res = await fetch("/api/data/row", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        branchId,
        databaseName,
        schema: selectedSchema,
        table: selectedTable,
        primaryKey,
        data,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || "Update failed");
    }
    // Refresh data after update
    await fetchTableData();
  };

  const handleDelete = async (primaryKey: Record<string, unknown>) => {
    const res = await fetch("/api/data/row", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        branchId,
        databaseName,
        schema: selectedSchema,
        table: selectedTable,
        primaryKey,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || "Delete failed");
    }
    // Refresh data after delete
    await fetchTableData();
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex h-full border border-[var(--border-default)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
      {/* Left: Schema sidebar */}
      <SchemaSidebar
        schemas={schemas}
        selectedSchema={selectedSchema}
        selectedTable={selectedTable}
        onSelectTable={handleSelectTable}
        loading={metadataLoading}
        onRefresh={fetchMetadata}
      />

      {/* Right: Data area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedTable ? (
          <>
            {/* Tab bar */}
            <div className="neon-tabs px-4">
              <button
                onClick={() => setInfoTab("data")}
                className={`neon-tab ${infoTab === "data" ? "neon-tab-active" : ""}`}
              >
                <Table className="w-3.5 h-3.5" />
                Data
              </button>
              <button
                onClick={() => setInfoTab("structure")}
                className={`neon-tab ${infoTab === "structure" ? "neon-tab-active" : ""}`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                Structure
              </button>
            </div>

            {/* Content */}
            {infoTab === "data" ? (
              <DataTable
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
                filterColumn={filterColumn}
                filterOperator={filterOperator}
                filterValue={filterValue}
                onSort={handleSort}
                onFilter={handleFilter}
                onPageChange={handlePageChange}
                onRefresh={fetchTableData}
                onInsert={handleInsert}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ) : (
              <div className="flex-1 overflow-y-auto">
                <TableInfoPanel table={selectedTableInfo} />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Table className="w-12 h-12 text-[var(--text-tertiary)]" />
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
                Select a Table
              </h3>
              <p className="text-[13px] text-[var(--text-tertiary)] max-w-[300px]">
                Choose a table from the sidebar to browse and manage its data
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
