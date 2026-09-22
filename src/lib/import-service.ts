/**
 * Import Service — handles connecting to external PostgreSQL databases,
 * introspecting schemas, comparing compatibility, and importing data.
 */

import { Client, type QueryResult } from "pg";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  NotificationService,
} from "@/lib/notification-service";
import { notifyImportCompleted, notifyImportFailed } from "@/lib/notification-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedConnectionString {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sslmode?: string;
  raw: string;
}

export interface SourceDatabaseInfo {
  host: string;
  port: number;
  database: string;
  postgresVersion: string;
  schemas: string[];
}

export interface SourceColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isForeignKey: boolean;
  foreignKeyTable?: string;
  foreignKeyColumn?: string;
  maxLength?: number;
}

export interface SourceTableInfo {
  schemaName: string;
  tableName: string;
  columns: SourceColumnInfo[];
  rowCount: number;
}

export interface SourceSchemaInfo {
  tables: SourceTableInfo[];
  totalTables: number;
  totalEstimatedRows: number;
}

export interface SchemaCompatibilityResult {
  compatible: boolean;
  compatibleTables: string[];
  incompatibleTables: string[];
  warnings: SchemaWarning[];
  differences: SchemaDifference[];
}

export interface SchemaWarning {
  table: string;
  message: string;
}

export interface SchemaDifference {
  table: string;
  column?: string;
  type: "missing_table" | "missing_column" | "type_mismatch" | "nullability" | "pk_mismatch" | "fk_mismatch";
  source?: string;
  destination?: string;
  message: string;
}

export interface ImportJobRecord {
  id: string;
  organizationId: string | null;
  projectId: string;
  branchId: string;
  databaseId: string | null;
  databaseName: string;
  sourceHost: string;
  sourceDatabase: string;
  sourceEncryptedConn: string | null;
  status: string;
  importMode: string;
  conflictStrategy: string;
  tablesSelected: string | null;
  tablesCompleted: number;
  tablesTotal: number;
  rowsImported: number;
  totalEstimatedRows: number | null;
  errorSummary: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportTableResultRecord {
  id: string;
  jobId: string;
  schemaName: string;
  tableName: string;
  sourceRowCount: number | null;
  importedRowCount: number | null;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return randomBytes(16).toString("hex");
}

// Simple XOR-based obfuscation for temporary credential storage (not cryptographic security)
function obfuscate(plain: string): string {
  const key = "neon-import-key-2026";
  let result = "";
  for (let i = 0; i < plain.length; i++) {
    result += String.fromCharCode(
      plain.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return Buffer.from(result, "utf-8").toString("base64");
}

function deobfuscate(encoded: string): string {
  const key = "neon-import-key-2026";
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  let result = "";
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(
      decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Connection String Parser
// ---------------------------------------------------------------------------

export function parseConnectionString(connStr: string): ParsedConnectionString {
  const trimmed = connStr.trim();

  // Support postgresql:// and postgres://
  const urlPattern = /^(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?&\s]+)/;
  const match = trimmed.match(urlPattern);

  if (!match) {
    throw new Error(
      "Invalid connection string format. Expected: postgresql://user:password@host:port/database"
    );
  }

  const [, , user, password, host, portStr, database] = match;
  const port = portStr ? parseInt(portStr, 10) : 5432;

  // Parse query parameters for sslmode
  const queryStart = trimmed.indexOf("?");
  let sslmode: string | undefined;
  if (queryStart !== -1) {
    const queryString = trimmed.substring(queryStart + 1);
    const params = new URLSearchParams(queryString);
    sslmode = params.get("sslmode") || undefined;
  }

  return {
    host: decodeURIComponent(host),
    port,
    database: decodeURIComponent(database),
    user: decodeURIComponent(user),
    password: decodeURIComponent(password),
    sslmode,
    raw: trimmed,
  };
}

/**
 * Returns the connection string with password masked.
 */
export function maskConnectionString(connStr: string): string {
  return connStr.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}

// ---------------------------------------------------------------------------
// Source Database Connection
// ---------------------------------------------------------------------------

function createSourceClient(parsed: ParsedConnectionString): Client {
  const sslConfig =
    parsed.sslmode === "require" || parsed.sslmode === "verify-ca" || parsed.sslmode === "verify-full"
      ? { rejectUnauthorized: parsed.sslmode !== "require" ? true : false }
      : false;

  return new Client({
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    user: parsed.user,
    password: parsed.password,
    connectionTimeoutMillis: 15000,
    statement_timeout: 30000,
    ssl: sslConfig || undefined,
  });
}

// ---------------------------------------------------------------------------
// Test Connection
// ---------------------------------------------------------------------------

export async function testConnection(
  connStr: string
): Promise<{ success: boolean; info?: SourceDatabaseInfo; error?: string }> {
  const parsed = parseConnectionString(connStr);
  const client = createSourceClient(parsed);

  try {
    await client.connect();

    // Get PostgreSQL version
    const versionResult = await client.query("SELECT version()");
    const pgVersion = versionResult.rows[0]?.version || "Unknown";

    // Get schemas
    const schemaResult = await client.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name"
    );
    const schemas = schemaResult.rows.map((r: any) => r.schema_name);

    await client.end();

    return {
      success: true,
      info: {
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        postgresVersion: pgVersion,
        schemas,
      },
    };
  } catch (err: any) {
    try { await client.end(); } catch {}
    const msg = err?.code === "ECONNREFUSED"
      ? "The database server could not be reached. Verify the hostname and network connectivity."
      : err?.code === "ENOTFOUND"
      ? `Could not resolve hostname "${parsed.host}". Please verify the connection string.`
      : err?.code === "28P01"
      ? "Authentication failed. Please verify the username and password."
      : err?.code === "3D000"
      ? `Database "${parsed.database}" does not exist on the server.`
      : "Unable to connect to the source database. Please verify the connection string and ensure the source database is reachable from the server.";
    return { success: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Source Schema Introspection
// ---------------------------------------------------------------------------

export async function introspectSourceSchema(
  connStr: string
): Promise<SourceSchemaInfo> {
  const parsed = parseConnectionString(connStr);
  const client = createSourceClient(parsed);

  try {
    await client.connect();

    // Get all tables with row counts
    const tablesResult = await client.query(`
      SELECT 
        t.table_schema,
        t.table_name,
        COALESCE(pg_class.reltuples::bigint, 0) as estimated_rows
      FROM information_schema.tables t
      LEFT JOIN pg_class ON pg_class.relname = t.table_name
      LEFT JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace AND pg_namespace.nspname = t.table_schema
      WHERE t.table_type = 'BASE TABLE'
        AND t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY t.table_schema, t.table_name
    `);

    const tables: SourceTableInfo[] = [];
    let totalEstimatedRows = 0;

    for (const tableRow of tablesResult.rows) {
      const { table_schema, table_name, estimated_rows } = tableRow;

      // Get columns
      const colsResult = await client.query(
        `
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk,
          CASE WHEN uq.column_name IS NOT NULL THEN true ELSE false END as is_unique,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_fk,
          fk.foreign_table_name,
          fk.foreign_column_name
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON pk.column_name = c.column_name
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'UNIQUE'
        ) uq ON uq.column_name = c.column_name
        LEFT JOIN (
          SELECT 
            ku.column_name,
            ccu.table_name as foreign_table_name,
            ccu.column_name as foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON fk.column_name = c.column_name
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position
      `,
        [table_schema, table_name]
      );

      const columns: SourceColumnInfo[] = colsResult.rows.map((cr: any) => ({
        columnName: cr.column_name,
        dataType: cr.data_type,
        isNullable: cr.is_nullable === "YES",
        columnDefault: cr.column_default,
        isPrimaryKey: cr.is_pk,
        isUnique: cr.is_unique,
        isForeignKey: cr.is_fk,
        foreignKeyTable: cr.foreign_table_name,
        foreignKeyColumn: cr.foreign_column_name,
        maxLength: cr.character_maximum_length,
      }));

      const rowCount = Number(estimated_rows) || 0;
      totalEstimatedRows += rowCount;

      tables.push({
        schemaName: table_schema,
        tableName: table_name,
        columns,
        rowCount,
      });
    }

    await client.end();

    return {
      tables,
      totalTables: tables.length,
      totalEstimatedRows,
    };
  } catch (err: any) {
    try { await client.end(); } catch {}
    throw new Error(
      `Failed to introspect source schema: ${err?.message || "Unknown error"}`
    );
  }
}

// ---------------------------------------------------------------------------
// Destination Schema Introspection
// ---------------------------------------------------------------------------

export async function introspectDestinationSchema(
  host: string,
  port: number,
  database: string,
  user: string,
  password: string
): Promise<SourceSchemaInfo> {
  const client = createSourceClient({
    host,
    port,
    database,
    user,
    password,
    raw: "",
  });

  try {
    await client.connect();

    const tablesResult = await client.query(`
      SELECT 
        t.table_schema,
        t.table_name,
        COALESCE(pg_class.reltuples::bigint, 0) as estimated_rows
      FROM information_schema.tables t
      LEFT JOIN pg_class ON pg_class.relname = t.table_name
      LEFT JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace AND pg_namespace.nspname = t.table_schema
      WHERE t.table_type = 'BASE TABLE'
        AND t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY t.table_schema, t.table_name
    `);

    const tables: SourceTableInfo[] = [];
    let totalEstimatedRows = 0;

    for (const tableRow of tablesResult.rows) {
      const { table_schema, table_name, estimated_rows } = tableRow;

      const colsResult = await client.query(
        `
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.character_maximum_length,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk,
          CASE WHEN uq.column_name IS NOT NULL THEN true ELSE false END as is_unique,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_fk,
          fk.foreign_table_name,
          fk.foreign_column_name
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON pk.column_name = c.column_name
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'UNIQUE'
        ) uq ON uq.column_name = c.column_name
        LEFT JOIN (
          SELECT 
            ku.column_name,
            ccu.table_name as foreign_table_name,
            ccu.column_name as foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON fk.column_name = c.column_name
        WHERE c.table_schema = $1 AND c.table_name = $2
        ORDER BY c.ordinal_position
      `,
        [table_schema, table_name]
      );

      const columns: SourceColumnInfo[] = colsResult.rows.map((cr: any) => ({
        columnName: cr.column_name,
        dataType: cr.data_type,
        isNullable: cr.is_nullable === "YES",
        columnDefault: cr.column_default,
        isPrimaryKey: cr.is_pk,
        isUnique: cr.is_unique,
        isForeignKey: cr.is_fk,
        foreignKeyTable: cr.foreign_table_name,
        foreignKeyColumn: cr.foreign_column_name,
        maxLength: cr.character_maximum_length,
      }));

      const rowCount = Number(estimated_rows) || 0;
      totalEstimatedRows += rowCount;

      tables.push({
        schemaName: table_schema,
        tableName: table_name,
        columns,
        rowCount,
      });
    }

    await client.end();

    return {
      tables,
      totalTables: tables.length,
      totalEstimatedRows,
    };
  } catch (err: any) {
    try { await client.end(); } catch {}
    throw new Error(
      `Failed to introspect destination schema: ${err?.message || "Unknown error"}`
    );
  }
}

// ---------------------------------------------------------------------------
// Schema Comparison
// ---------------------------------------------------------------------------

// Type compatibility map — maps source types to destination types they can safely accept
const TYPE_COMPATIBILITY: Record<string, string[]> = {
  integer: ["integer", "bigint", "smallint", "numeric", "decimal", "real", "double precision"],
  bigint: ["bigint", "numeric", "decimal", "real", "double precision"],
  smallint: ["smallint", "integer", "bigint", "numeric", "decimal"],
  serial: ["integer", "bigint", "smallint", "numeric", "decimal", "serial", "bigserial"],
  bigserial: ["bigint", "numeric", "decimal", "bigserial"],
  "character varying": ["character varying", "text", "character"],
  varchar: ["character varying", "varchar", "text", "character"],
  text: ["text", "character varying", "varchar"],
  character: ["character", "character varying", "varchar", "text"],
  char: ["character", "character varying", "varchar", "text"],
  "double precision": ["double precision", "real", "numeric", "decimal"],
  "real": ["real", "double precision", "numeric", "decimal"],
  numeric: ["numeric", "decimal", "double precision", "real"],
  decimal: ["decimal", "numeric", "double precision", "real"],
  boolean: ["boolean"],
  "timestamp without time zone": ["timestamp without time zone", "timestamp with time zone", "date"],
  "timestamp with time zone": ["timestamp with time zone", "timestamp without time zone", "date"],
  timestamp: ["timestamp without time zone", "timestamp with time zone", "date"],
  timestamptz: ["timestamp with time zone", "timestamp without time zone", "date"],
  date: ["date", "timestamp without time zone", "timestamp with time zone"],
  time: ["time without time zone", "time with time zone"],
  json: ["json", "jsonb", "text"],
  jsonb: ["jsonb", "json", "text"],
  uuid: ["uuid", "text", "character varying"],
  bytea: ["bytea", "text"],
  "integer[]": ["integer[]"],
  "text[]": ["text[]"],
};

function areTypesCompatible(
  sourceType: string,
  destType: string
): "compatible" | "warning" | "incompatible" {
  const src = sourceType.toLowerCase().trim();
  const dst = destType.toLowerCase().trim();

  if (src === dst) return "compatible";

  const compatibles = TYPE_COMPATIBILITY[src];
  if (compatibles && compatibles.includes(dst)) return "compatible";

  // Same family warnings
  if (src.includes("int") && dst.includes("int")) return "warning";
  if (src.includes("char") && dst.includes("char")) return "warning";
  if (src.includes("numeric") && dst.includes("numeric")) return "warning";

  return "incompatible";
}

export function compareSchemas(
  source: SourceSchemaInfo,
  destination: SourceSchemaInfo
): SchemaCompatibilityResult {
  const compatibleTables: string[] = [];
  const incompatibleTables: string[] = [];
  const warnings: SchemaWarning[] = [];
  const differences: SchemaDifference[] = [];

  const sourceMap = new Map(
    source.tables.map((t) => [`${t.schemaName}.${t.tableName}`, t])
  );
  const destMap = new Map(
    destination.tables.map((t) => [`${t.schemaName}.${t.tableName}`, t])
  );

  // Check each source table against destination
  for (const [key, srcTable] of sourceMap) {
    const dstTable = destMap.get(key);

    if (!dstTable) {
      incompatibleTables.push(key);
      differences.push({
        table: key,
        type: "missing_table",
        message: `Table "${srcTable.tableName}" exists in source but not in destination`,
      });
      continue;
    }

    // Compare columns
    const srcColsMap = new Map(
      srcTable.columns.map((c) => [c.columnName, c])
    );
    const dstColsMap = new Map(
      dstTable.columns.map((c) => [c.columnName, c])
    );

    let tableCompatible = true;

    // Check source columns exist in destination
    for (const [colName, srcCol] of srcColsMap) {
      const dstCol = dstColsMap.get(colName);

      if (!dstCol) {
        // Destination missing a source column — only incompatible if source column is NOT NULL without default
        if (!srcCol.isNullable && !srcCol.columnDefault) {
          tableCompatible = false;
          differences.push({
            table: key,
            column: colName,
            type: "missing_column",
            source: srcCol.dataType,
            message: `Column "${colName}" is NOT NULL in source without a default, but is missing in destination`,
          });
        } else {
          warnings.push({
            table: key,
            message: `Column "${colName}" exists in source but not in destination (nullable or has default — data will be skipped for this column)`,
          });
        }
        continue;
      }

      // Check type compatibility
      const typeCompat = areTypesCompatible(srcCol.dataType, dstCol.dataType);
      if (typeCompat === "incompatible") {
        tableCompatible = false;
        differences.push({
          table: key,
          column: colName,
          type: "type_mismatch",
          source: srcCol.dataType,
          destination: dstCol.dataType,
          message: `Column "${colName}" type mismatch: source is ${srcCol.dataType}, destination is ${dstCol.dataType}`,
        });
      } else if (typeCompat === "warning") {
        warnings.push({
          table: key,
          message: `Column "${colName}" has a type difference: source is ${srcCol.dataType}, destination is ${dstCol.dataType}`,
        });
      }

      // Check nullability — source NOT NULL but destination nullable is fine
      // Source nullable but destination NOT NULL is incompatible
      if (!srcCol.isNullable && dstCol.isNullable) {
        // This is fine — importing NOT NULL into nullable column works
      } else if (srcCol.isNullable && !dstCol.isNullable) {
        warnings.push({
          table: key,
          message: `Column "${colName}" is nullable in source but NOT NULL in destination`,
        });
      }
    }

    // Check primary keys match
    const srcPKs = srcTable.columns
      .filter((c) => c.isPrimaryKey)
      .map((c) => c.columnName)
      .sort();
    const dstPKs = dstTable.columns
      .filter((c) => c.isPrimaryKey)
      .map((c) => c.columnName)
      .sort();

    if (JSON.stringify(srcPKs) !== JSON.stringify(dstPKs)) {
      tableCompatible = false;
      differences.push({
        table: key,
        type: "pk_mismatch",
        source: srcPKs.join(", ") || "(none)",
        destination: dstPKs.join(", ") || "(none)",
        message: `Primary key mismatch: source has [${srcPKs.join(", ") || "none"}], destination has [${dstPKs.join(", ") || "none"}]`,
      });
    }

    if (tableCompatible) {
      compatibleTables.push(key);
    } else {
      incompatibleTables.push(key);
    }
  }

  // Warn about destination tables not in source
  for (const [key] of destMap) {
    if (!sourceMap.has(key)) {
      warnings.push({
        table: key,
        message: `Table "${key}" exists in destination but not in source — it will not be affected`,
      });
    }
  }

  return {
    compatible: incompatibleTables.length === 0,
    compatibleTables,
    incompatibleTables,
    warnings,
    differences,
  };
}

// ---------------------------------------------------------------------------
// Import Data Engine
// ---------------------------------------------------------------------------

/**
 * Import data for a single table from source to destination.
 * Uses COPY for efficient bulk transfer.
 */
async function importTableData(
  sourceClient: Client,
  destClient: Client,
  schemaName: string,
  tableName: string,
  conflictStrategy: string
): Promise<{ importedRows: number; error?: string }> {
  try {
    // Get column list from source
    const colResult = await sourceClient.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schemaName, tableName]
    );
    const columns = colResult.rows.map((r: any) => r.column_name);

    if (columns.length === 0) {
      return { importedRows: 0, error: "No columns found" };
    }

    // Check which columns exist in destination
    const destColResult = await destClient.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
      [schemaName, tableName]
    );
    const destColumns = new Set(destColResult.rows.map((r: any) => r.column_name));

    const validColumns = columns.filter((c) => destColumns.has(c));

    if (validColumns.length === 0) {
      return { importedRows: 0, error: "No matching columns in destination" };
    }

    // Stream data from source using cursor-based approach
    const batchSize = 5000;
    let offset = 0;
    let totalImported = 0;
    const qualifiedTable = `"${schemaName}"."${tableName}"`;

    // Disable triggers and foreign keys during import for performance
    await destClient.query("SET session_replication_role = 'replica'");

    try {
      // Get total row count for streaming
      const countResult = await sourceClient.query(
        `SELECT COUNT(*) as count FROM ${qualifiedTable}`
      );
      const totalRows = parseInt(countResult.rows[0].count, 10);

      while (offset < totalRows) {
        // Fetch batch from source
        const dataResult = await sourceClient.query(
          `SELECT ${validColumns.map((c) => `"${c}"`).join(", ")} FROM ${qualifiedTable} ORDER BY ctid LIMIT $1 OFFSET $2`,
          [batchSize, offset]
        );

        if (dataResult.rows.length === 0) break;

        // Build INSERT statement for batch
        const placeholders = validColumns
          .map((_, i) => `$${i + 1}`)
          .join(", ");
        const insertSQL = `INSERT INTO ${qualifiedTable} (${validColumns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

        // Use a transaction for the batch
        const destClientTyped = destClient as any;
        await destClientTyped.query("BEGIN");

        for (const row of dataResult.rows) {
          const values = validColumns.map((c) => row[c]);
          try {
            await destClientTyped.query(insertSQL, values);
            totalImported++;
          } catch (rowErr: any) {
            // If conflict strategy is fail, abort
            if (conflictStrategy === "fail" && rowErr?.code === "23505") {
              await destClientTyped.query("ROLLBACK");
              await destClient.query("SET session_replication_role = 'origin'");
              return {
                importedRows: totalImported,
                error: `Primary key/unique constraint conflict at row. Use "skip" or "upsert" strategy to handle conflicts.`,
              };
            }
            // Skip the row (strategy is "skip" or "upsert" with fail)
          }
        }

        await destClientTyped.query("COMMIT");
        offset += batchSize;

        // Yield to allow cancellation checks
        await new Promise((resolve) => setImmediate(resolve));
      }
    } finally {
      await destClient.query("SET session_replication_role = 'origin'");
    }

    // Sync sequences after import
    for (const col of validColumns) {
      try {
        const seqResult = await destClient.query(
          `SELECT pg_get_serial_sequence($1, $2) as seq`,
          [qualifiedTable, col]
        );
        const seqName = seqResult.rows[0]?.seq;
        if (seqName) {
          await destClient.query(
            `SELECT setval('${seqName}', COALESCE((SELECT MAX("${col}") FROM ${qualifiedTable}), 1))`
          );
        }
      } catch {
        // Column may not have a sequence — ignore
      }
    }

    return { importedRows: totalImported };
  } catch (err: any) {
    return {
      importedRows: 0,
      error: err?.message || "Unknown import error",
    };
  }
}

/**
 * Execute a full import job: connects to source, streams data table-by-table to destination.
 */
export async function executeImport(jobId: string): Promise<void> {
  const db = getDb();

  // Load the job
  const job = db
    .select()
    .from(schema.importJobs)
    .where(eq(schema.importJobs.id, jobId))
    .get();

  if (!job) throw new Error("Import job not found");

  // Update status to running
  db.update(schema.importJobs)
    .set({ status: "running", startedAt: new Date().toISOString() })
    .where(eq(schema.importJobs.id, jobId))
    .run();

  // Decrypt source connection string
  if (!job.sourceEncryptedConn) {
    db.update(schema.importJobs)
      .set({ status: "failed", errorSummary: "No source connection string stored" })
      .where(eq(schema.importJobs.id, jobId))
      .run();
    return;
  }

  const connStr = deobfuscate(job.sourceEncryptedConn);
  const parsed = parseConnectionString(connStr);

  // Parse destination from job metadata
  // The destination database info is resolved by the API route before calling this
  // For now we use the project/branch/database metadata stored in the job
  const destProject = db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, job.projectId))
    .get();

  const destCompute = db
    .select()
    .from(schema.computes)
    .where(
      and(
        eq(schema.computes.projectId, job.projectId),
        eq(schema.computes.branchId, job.branchId)
      )
    )
    .get();

  if (!destCompute) {
    db.update(schema.importJobs)
      .set({ status: "failed", errorSummary: "Destination compute not found" })
      .where(eq(schema.importJobs.id, jobId))
      .run();
    return;
  }

  const tablesToImport: string[] = job.tablesSelected
    ? JSON.parse(job.tablesSelected)
    : [];

  let sourceClient: Client | null = null;
  let destClient: Client | null = null;

  try {
    // Connect to both databases
    sourceClient = createSourceClient(parsed);
    await sourceClient.connect();

    destClient = createSourceClient({
      host: destCompute.host || "localhost",
      port: destCompute.port || parseInt(process.env.POSTGRES_PORT || "55432"),
      database: job.databaseName,
      user: destCompute.role || "neondb_owner",
      password: "", // Internal connection — no password needed for local
      raw: "",
    });
    await destClient.connect();

    const totalTables = tablesToImport.length;
    let completedTables = 0;
    let totalRowsImported = 0;
    const errors: string[] = [];

    db.update(schema.importJobs)
      .set({ tablesTotal: totalTables })
      .where(eq(schema.importJobs.id, jobId))
      .run();

    for (const tableKey of tablesToImport) {
      // Check if job was cancelled
      const currentJob = db
        .select()
        .from(schema.importJobs)
        .where(eq(schema.importJobs.id, jobId))
        .get();
      if (currentJob?.status === "cancelled") {
        break;
      }

      const [schemaName, tableName] = tableKey.includes(".")
        ? tableKey.split(".")
        : ["public", tableKey];

      // Create table result record
      const tableResultId = generateId();
      db.insert(schema.importTableResults)
        .values({
          id: tableResultId,
          jobId,
          schemaName,
          tableName,
          status: "importing",
          startedAt: new Date().toISOString(),
        })
        .run();

      // Import data
      const result = await importTableData(
        sourceClient,
        destClient,
        schemaName,
        tableName,
        job.conflictStrategy
      );

      completedTables++;
      totalRowsImported += result.importedRows;

      // Update table result
      db.update(schema.importTableResults)
        .set({
          status: result.error ? "failed" : "completed",
          importedRowCount: result.importedRows,
          errorMessage: result.error || null,
          completedAt: new Date().toISOString(),
        })
        .where(eq(schema.importTableResults.id, tableResultId))
        .run();

      if (result.error) {
        errors.push(`${schemaName}.${tableName}: ${result.error}`);
      }

      // Update job progress
      db.update(schema.importJobs)
        .set({
          tablesCompleted: completedTables,
          rowsImported: totalRowsImported,
        })
        .where(eq(schema.importJobs.id, jobId))
        .run();
    }

    // Determine final status
    const finalStatus =
      currentJobStatus(jobId) === "cancelled"
        ? "cancelled"
        : errors.length > 0
        ? "completed"
        : "completed";

    db.update(schema.importJobs)
      .set({
        status: finalStatus,
        completedAt: new Date().toISOString(),
        errorSummary: errors.length > 0 ? errors.join("\n") : null,
      })
      .where(eq(schema.importJobs.id, jobId))
      .run();

    // Create notification
    try {
      const notifyResult = finalStatus === "cancelled"
        ? null
        : errors.length > 0
        ? null
        : notifyImportCompleted(
            job.createdBy,
            job.organizationId || undefined,
            totalRowsImported,
            job.databaseName
          );

      if (finalStatus === "cancelled") {
        NotificationService.create({
          userId: job.createdBy,
          organizationId: job.organizationId || undefined,
          type: "warning",
          title: "Import cancelled",
          message: `Import was cancelled. ${totalRowsImported} rows had been imported across ${completedTables} tables.`,
          resourceType: "import",
          resourceId: jobId,
          actionUrl: "/import-data",
        });
      } else if (errors.length > 0) {
        notifyImportFailed(
          job.createdBy,
          job.organizationId || undefined,
          errors.join("; "),
          job.databaseName
        );
      }
    } catch {
      // Don't fail import if notification fails
    }
  } catch (err: any) {
    db.update(schema.importJobs)
      .set({
        status: "failed",
        completedAt: new Date().toISOString(),
        errorSummary: err?.message || "Import failed unexpectedly",
      })
      .where(eq(schema.importJobs.id, jobId))
      .run();

    try {
      notifyImportFailed(
        job.createdBy,
        job.organizationId || undefined,
        err?.message || "Unknown error",
        job.databaseName
      );
    } catch {}
  } finally {
    try { sourceClient?.end(); } catch {}
    try { destClient?.end(); } catch {}
  }
}

function currentJobStatus(jobId: string): string {
  const db = getDb();
  const job = db
    .select()
    .from(schema.importJobs)
    .where(eq(schema.importJobs.id, jobId))
    .get();
  return job?.status || "failed";
}

// ---------------------------------------------------------------------------
// Job Management
// ---------------------------------------------------------------------------

export function createImportJob(params: {
  organizationId?: string;
  projectId: string;
  branchId: string;
  databaseId?: string;
  databaseName: string;
  sourceConnectionString: string;
  importMode?: string;
  conflictStrategy?: string;
  tablesSelected?: string[];
  totalEstimatedRows?: number;
  createdBy: string;
}): ImportJobRecord {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  const parsed = parseConnectionString(params.sourceConnectionString);

  db.insert(schema.importJobs)
    .values({
      id,
      organizationId: params.organizationId || null,
      projectId: params.projectId,
      branchId: params.branchId,
      databaseId: params.databaseId || null,
      databaseName: params.databaseName,
      sourceHost: parsed.host,
      sourceDatabase: parsed.database,
      sourceEncryptedConn: obfuscate(params.sourceConnectionString),
      status: "pending",
      importMode: params.importMode || "data_only",
      conflictStrategy: params.conflictStrategy || "fail",
      tablesSelected: params.tablesSelected ? JSON.stringify(params.tablesSelected) : null,
      totalEstimatedRows: params.totalEstimatedRows || null,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return db
    .select()
    .from(schema.importJobs)
    .where(eq(schema.importJobs.id, id))
    .get() as ImportJobRecord;
}

export function getImportJob(jobId: string): ImportJobRecord | null {
  const db = getDb();
  return db
    .select()
    .from(schema.importJobs)
    .where(eq(schema.importJobs.id, jobId))
    .get() || null;
}

export function getImportJobResults(
  jobId: string
): ImportTableResultRecord[] {
  const db = getDb();
  return db
    .select()
    .from(schema.importTableResults)
    .where(eq(schema.importTableResults.jobId, jobId))
    .all();
}

export function getImportHistory(
  organizationId?: string,
  limit: number = 50
): ImportJobRecord[] {
  const db = getDb();
  if (organizationId) {
    return db
      .select()
      .from(schema.importJobs)
      .where(eq(schema.importJobs.organizationId, organizationId))
      .orderBy(desc(schema.importJobs.createdAt))
      .limit(limit)
      .all();
  }
  return db
    .select()
    .from(schema.importJobs)
    .orderBy(desc(schema.importJobs.createdAt))
    .limit(limit)
    .all();
}

export function cancelImportJob(jobId: string): boolean {
  const db = getDb();
  const job = db
    .select()
    .from(schema.importJobs)
    .where(eq(schema.importJobs.id, jobId))
    .get();

  if (!job) return false;
  if (job.status !== "running" && job.status !== "pending" && job.status !== "validating") {
    return false;
  }

  db.update(schema.importJobs)
    .set({ status: "cancelled", updatedAt: new Date().toISOString() })
    .where(eq(schema.importJobs.id, jobId))
    .run();

  return true;
}

export {
  obfuscate,
  deobfuscate,
};
