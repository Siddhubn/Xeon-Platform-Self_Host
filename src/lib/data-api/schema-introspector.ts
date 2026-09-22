/**
 * Schema Introspector — reads real PostgreSQL schema metadata
 * for the Data API and Data Masking features.
 */

import pg from "pg";

export interface SchemaTable {
  schemaName: string;
  tableName: string;
  tableType: string; // "BASE TABLE" | "VIEW"
  rowCountEstimate: number | null;
}

export interface SchemaColumn {
  schemaName: string;
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  ordinalPosition: number;
  maxLength: number | null;
}

export interface SchemaForeignKey {
  schemaName: string;
  tableName: string;
  columnName: string;
  foreignSchemaName: string;
  foreignTableName: string;
  foreignColumnName: string;
  constraintName: string;
}

export interface SchemaPrimaryKey {
  schemaName: string;
  tableName: string;
  columnName: string;
  constraintName: string;
}

export interface SchemaFunction {
  schemaName: string;
  functionName: string;
  returnType: string;
  argumentTypes: string;
  language: string;
  isAggregate: boolean;
}

export interface SchemaRLSPolicy {
  schemaName: string;
  tableName: string;
  policyName: string;
  command: string;
  roles: string[];
  usingExpression: string | null;
  checkExpression: string | null;
}

export interface FullSchema {
  tables: SchemaTable[];
  columns: SchemaColumn[];
  foreignKeys: SchemaForeignKey[];
  primaryKeys: SchemaPrimaryKey[];
  functions: SchemaFunction[];
  rlsPolicies: SchemaRLSPolicy[];
  rlsEnabled: Record<string, boolean>; // "schema.table" -> boolean
  refreshedAt: string;
}

function createClient(conn: {
  host: string;
  port: number;
  database: string;
}): pg.Client {
  return new pg.Client({
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: process.env.POSTGRES_USER || "cloud_admin",
    password: process.env.POSTGRES_PASSWORD || "helloworld",
    connectionTimeoutMillis: 5000,
    query_timeout: 15000,
    ssl: false,
  });
}

export async function introspectSchema(conn: {
  host: string;
  port: number;
  database: string;
}): Promise<FullSchema> {
  const client = createClient(conn);
  await client.connect();

  try {
    // Tables
    const tablesResult = await client.query(`
      SELECT 
        schemaname as "schemaName",
        tablename as "tableName",
        'BASE TABLE' as "tableType",
        c.reltuples::bigint as "rowCountEstimate"
      FROM pg_catalog.pg_tables t
      LEFT JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename
    `);

    // Views
    const viewsResult = await client.query(`
      SELECT 
        schemaname as "schemaName",
        viewname as "tableName",
        'VIEW' as "tableType",
        NULL as "rowCountEstimate"
      FROM pg_catalog.pg_views
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, viewname
    `);

    // Columns
    const columnsResult = await client.query(`
      SELECT
        c.table_schema as "schemaName",
        c.table_name as "tableName",
        c.column_name as "columnName",
        c.data_type as "dataType",
        CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END as "isNullable",
        c.column_default as "columnDefault",
        c.ordinal_position as "ordinalPosition",
        c.character_maximum_length as "maxLength"
      FROM information_schema.columns c
      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
    `);

    // Foreign Keys
    const fkResult = await client.query(`
      SELECT
        tc.table_schema as "schemaName",
        tc.table_name as "tableName",
        kcu.column_name as "columnName",
        ccu.table_schema as "foreignSchemaName",
        ccu.table_name as "foreignTableName",
        ccu.column_name as "foreignColumnName",
        tc.constraint_name as "constraintName"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY tc.table_schema, tc.table_name
    `);

    // Primary Keys
    const pkResult = await client.query(`
      SELECT
        tc.table_schema as "schemaName",
        tc.table_name as "tableName",
        kcu.column_name as "columnName",
        tc.constraint_name as "constraintName"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY tc.table_schema, tc.table_name
    `);

    // Functions
    const fnResult = await client.query(`
      SELECT
        n.nspname as "schemaName",
        p.proname as "functionName",
        pg_catalog.pg_get_function_result(p.oid) as "returnType",
        pg_catalog.pg_get_function_arguments(p.oid) as "argumentTypes",
        l.lanname as "language",
        p.proisagg as "isAggregate"
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      JOIN pg_language l ON p.prolang = l.oid
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND p.prokind = 'f'
      ORDER BY n.nspname, p.proname
    `);

    // RLS Policies
    const rlsResult = await client.query(`
      SELECT
        schemaname as "schemaName",
        tablename as "tableName",
        policyname as "policyName",
        cmd as "command",
        roles as "roles",
        qual as "usingExpression",
        with_check as "checkExpression"
      FROM pg_policies
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename, policyname
    `);

    // RLS enabled status
    const rlsEnabledResult = await client.query(`
      SELECT
        schemaname as "schemaName",
        tablename as "tableName",
        relrowsecurity as "rlsEnabled"
      FROM pg_catalog.pg_tables t
      JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.schemaname)
      WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
    `);

    const rlsEnabled: Record<string, boolean> = {};
    for (const row of rlsEnabledResult.rows) {
      rlsEnabled[`${row.schemaName}.${row.tableName}`] = row.rlsEnabled;
    }

    return {
      tables: [...tablesResult.rows, ...viewsResult.rows] as SchemaTable[],
      columns: columnsResult.rows as SchemaColumn[],
      foreignKeys: fkResult.rows as SchemaForeignKey[],
      primaryKeys: pkResult.rows as SchemaPrimaryKey[],
      functions: fnResult.rows as SchemaFunction[],
      rlsPolicies: rlsResult.rows as SchemaRLSPolicy[],
      rlsEnabled,
      refreshedAt: new Date().toISOString(),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
