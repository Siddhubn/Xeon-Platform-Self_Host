/**
 * Data Masking Engine — applies masking transformations to PostgreSQL data.
 * 
 * Each masking rule generates a SQL expression that transforms column values
 * in-place within a new (anonymized) branch.
 */

import pg from "pg";

// ---------------------------------------------------------------------------
// Masking Rule Types
// ---------------------------------------------------------------------------

export type MaskingRuleType =
  | "preserve"
  | "null_value"
  | "fixed_value"
  | "random_first_name"
  | "random_last_name"
  | "random_full_name"
  | "consistent_pseudonym"
  | "random_email"
  | "synthetic_email"
  | "hashed_email"
  | "redacted_email"
  | "random_phone"
  | "redacted_phone"
  | "hashed_phone"
  | "random_address"
  | "random_city"
  | "random_postal_code"
  | "synthetic_address"
  | "redacted_address"
  | "random_date"
  | "date_shift"
  | "random_uuid"
  | "consistent_hash"
  | "sequential_replacement"
  | "random_int"
  | "redacted"
  | "custom_sql";

export interface MaskingRuleConfig {
  ruleType: MaskingRuleType;
  configuration?: Record<string, unknown>;
  customExpression?: string;
  dataType?: string;
}

// ---------------------------------------------------------------------------
// Masking Categories for the UI
// ---------------------------------------------------------------------------

export const MASKING_CATEGORIES = [
  {
    name: "Names",
    rules: [
      { type: "random_first_name", label: "Random First Name" },
      { type: "random_last_name", label: "Random Last Name" },
      { type: "random_full_name", label: "Random Full Name" },
      { type: "consistent_pseudonym", label: "Consistent Pseudonym" },
    ],
  },
  {
    name: "Email Addresses",
    rules: [
      { type: "random_email", label: "Random Email" },
      { type: "synthetic_email", label: "Synthetic Email" },
      { type: "hashed_email", label: "Hashed Email" },
      { type: "redacted_email", label: "Redacted Email" },
    ],
  },
  {
    name: "Phone Numbers",
    rules: [
      { type: "random_phone", label: "Random Phone Number" },
      { type: "redacted_phone", label: "Redacted Number" },
      { type: "hashed_phone", label: "Hashed Number" },
    ],
  },
  {
    name: "Addresses",
    rules: [
      { type: "random_address", label: "Random Street Address" },
      { type: "random_city", label: "Random City" },
      { type: "random_postal_code", label: "Random Postal Code" },
      { type: "synthetic_address", label: "Synthetic Address" },
      { type: "redacted_address", label: "Redacted Address" },
    ],
  },
  {
    name: "Dates",
    rules: [
      { type: "random_date", label: "Random Date" },
      { type: "date_shift", label: "Date Shift" },
    ],
  },
  {
    name: "Identifiers",
    rules: [
      { type: "random_uuid", label: "Random UUID" },
      { type: "consistent_hash", label: "Consistent Hash" },
      { type: "sequential_replacement", label: "Sequential Replacement" },
      { type: "random_int", label: "Random Integer" },
    ],
  },
  {
    name: "Generic",
    rules: [
      { type: "null_value", label: "NULL" },
      { type: "fixed_value", label: "Fixed Value" },
      { type: "redacted", label: "Fully Redacted" },
      { type: "custom_sql", label: "Custom SQL Expression" },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// SQL Expression Generator
// ---------------------------------------------------------------------------

/**
 * Generates a PostgreSQL SQL expression for a given masking rule.
 * The expression is used in an UPDATE ... SET column = <expression> statement.
 */
export function generateMaskingExpression(
  config: MaskingRuleConfig,
  columnName: string,
  tableName: string,
  schemaName: string = "public"
): string {
  const col = `"${schemaName}"."${tableName}"."${columnName}"`;
  const rnd = `random()`;

  switch (config.ruleType) {
    case "preserve":
      return col;

    case "null_value":
      return "NULL";

    case "fixed_value": {
      const val = config.configuration?.value ?? "REDACTED";
      return `'${String(val).replace(/'/g, "''")}'`;
    }

    case "random_first_name":
      return `(ARRAY['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Emma','Liam','Olivia','Noah','Ava','Sophia','Lucas','Mia','Oliver','Charlotte'])[floor(${rnd} * 10 + 1)::int]`;

    case "random_last_name":
      return `(ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Clark','Lewis','Robinson','Walker','Young'])[floor(${rnd} * 10 + 1)::int]`;

    case "random_full_name":
      return `(
        (ARRAY['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Elizabeth','David','Barbara','Richard','Susan','Emma','Liam','Olivia','Noah','Ava','Sophia'])[floor(${rnd} * 10 + 1)::int]
        || ' ' ||
        (ARRAY['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Clark','Lewis'])[floor(${rnd} * 10 + 1)::int]
      )`;

    case "consistent_pseudonym":
      return `('user-' || substr(md5(${col}::text), 1, 8))`;

    case "random_email":
      return `(
        'user' || floor(${rnd} * 999999)::int || '@' ||
        (ARRAY['example.com','test.invalid','sample.org','demo.net'])[floor(${rnd} * 4 + 1)::int]
      )`;

    case "synthetic_email": {
      const prefix = config.configuration?.prefix || "masked";
      return `(
        '${prefix}-' || floor(${rnd} * 999999)::int || '@example.invalid'
      )`;
    }

    case "hashed_email":
      return `(lower(md5(${col}::text)) || '@hash.invalid')`;

    case "redacted_email":
      return `CASE 
        WHEN ${col} IS NULL THEN NULL
        WHEN length(${col}::text) > 3 THEN 
          left(${col}::text, 2) || repeat('*', length(${col}::text) - 2)
        ELSE '***'
      END`;

    case "random_phone":
      return `(
        '+1-' || 
        lpad(floor(${rnd} * 900 + 100)::int::text, 3, '0') || '-' ||
        lpad(floor(${rnd} * 900 + 100)::int::text, 3, '0') || '-' ||
        lpad(floor(${rnd} * 9000 + 1000)::int::text, 4, '0')
      )`;

    case "redacted_phone":
      return `CASE 
        WHEN ${col} IS NULL THEN NULL
        ELSE '***-***-' || right(${col}::text, 4)
      END`;

    case "hashed_phone":
      return `(md5(${col}::text))`;

    case "random_address":
      return `(
        floor(${rnd} * 9999 + 1)::int || ' ' ||
        (ARRAY['Main St','Oak Ave','Maple Dr','Cedar Ln','Pine Rd','Elm Blvd','Park Way','Hill Ct','Lake Pl','River Rd'])[floor(${rnd} * 10 + 1)::int]
      )`;

    case "random_city":
      return `(ARRAY['Springfield','Riverside','Fairview','Greenville','Bristol','Manchester','Troy','Salem','Oakland','Portland','Austin','Madison','Georgetown','Chester','Dover'])[floor(${rnd} * 15 + 1)::int]`;

    case "random_postal_code":
      return `lpad(floor(${rnd} * 90000 + 10000)::int::text, 5, '0')`;

    case "synthetic_address":
      return `(
        floor(${rnd} * 9999 + 1)::int || ' ' ||
        (ARRAY['Synthetic St','Generated Ave','Demo Dr','Sample Ln','Test Rd'])[floor(${rnd} * 5 + 1)::int] || ', ' ||
        (ARRAY['Sample City','Demo Town','Testville','Mockburg'])[floor(${rnd} * 4 + 1)::int]
      )`;

    case "redacted_address":
      return `'[REDACTED]'`;

    case "random_date":
      return `(
        '1990-01-01'::date + floor(${rnd} * 10000)::int
      )`;

    case "date_shift": {
      const days = config.configuration?.days || 365;
      return `(${col} + floor(${rnd} * ${days} * 2 - ${days})::int)`;
    }

    case "random_uuid":
      return `(gen_random_uuid()::text)`;

    case "consistent_hash":
      return `(md5(${col}::text))`;

    case "sequential_replacement":
      return `(row_number() OVER (ORDER BY ${col})::text)`;

    case "random_int":
      return `floor(${rnd} * 999999 + 1)::int`;

    case "redacted":
      return `'[REDACTED]'`;

    case "custom_sql": {
      // Custom expressions reference the column as "column_name"
      if (!config.customExpression) {
        return `'CUSTOM_EXPRESSION_NOT_SET'`;
      }
      return `(${config.customExpression})`;
    }

    default:
      return `'UNSUPPORTED_RULE'`;
  }
}

// ---------------------------------------------------------------------------
// Preview Generator
// ---------------------------------------------------------------------------

export interface MaskingPreviewRow {
  original: unknown;
  masked: unknown;
}

/**
 * Preview what masking would do to sample data.
 * Runs a SELECT to get sample values, then computes the masking expression.
 */
export async function previewMasking(
  conn: { host: string; port: number; database: string },
  config: MaskingRuleConfig,
  schemaName: string,
  tableName: string,
  columnName: string,
  sampleSize: number = 5
): Promise<MaskingPreviewRow[]> {
  const client = new pg.Client({
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: process.env.POSTGRES_USER || "cloud_admin",
    password: process.env.POSTGRES_PASSWORD || "helloworld",
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    ssl: false,
  });

  try {
    await client.connect();

    const expr = generateMaskingExpression(config, columnName, tableName, schemaName);
    const sql = `
      SELECT 
        "${columnName}" as original,
        (${expr}) as masked
      FROM "${schemaName}"."${tableName}"
      WHERE "${columnName}" IS NOT NULL
      LIMIT ${sampleSize}
    `;

    const result = await client.query(sql);
    return result.rows.map((r) => ({
      original: r.original,
      masked: r.masked,
    }));
  } finally {
    await client.end().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Anonymization Executor
// ---------------------------------------------------------------------------

export interface AnonymizationResult {
  success: boolean;
  rulesApplied: number;
  rowsAffected: number;
  errors: string[];
}

/**
 * Apply all masking rules to the target database.
 * This is run against the NEW (anonymized) branch, not the source.
 */
export async function applyMasking(
  conn: { host: string; port: number; database: string },
  rules: Array<{
    schemaName: string;
    tableName: string;
    columnName: string;
    ruleType: MaskingRuleType;
    configuration?: Record<string, unknown>;
    customExpression?: string;
  }>
): Promise<AnonymizationResult> {
  const client = new pg.Client({
    host: conn.host,
    port: conn.port,
    database: conn.database,
    user: process.env.POSTGRES_USER || "cloud_admin",
    password: process.env.POSTGRES_PASSWORD || "helloworld",
    connectionTimeoutMillis: 30000,
    query_timeout: 300000,
    ssl: false,
  });

  const result: AnonymizationResult = {
    success: true,
    rulesApplied: 0,
    rowsAffected: 0,
    errors: [],
  };

  try {
    await client.connect();

    // Group rules by table for efficiency
    const rulesByTable = new Map<string, typeof rules>();
    for (const rule of rules) {
      const key = `${rule.schemaName}.${rule.tableName}`;
      const existing = rulesByTable.get(key) || [];
      existing.push(rule);
      rulesByTable.set(key, existing);
    }

    for (const [tableKey, tableRules] of rulesByTable) {
      const [schemaName, tableName] = tableKey.split(".");

      // Build a single UPDATE with all column transformations
      const setClauses: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      for (const rule of tableRules) {
        try {
          const expr = generateMaskingExpression(
            {
              ruleType: rule.ruleType,
              configuration: rule.configuration,
              customExpression: rule.customExpression,
            },
            rule.columnName,
            tableName,
            schemaName
          );

          // If the expression contains $N placeholders, we need to handle them
          // For simplicity, most expressions are self-contained SQL
          setClauses.push(`"${rule.columnName}" = ${expr}`);
          result.rulesApplied++;
        } catch (err) {
          result.errors.push(
            `Failed to generate expression for ${schemaName}.${tableName}.${rule.columnName}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      if (setClauses.length > 0) {
        try {
          const sql = `UPDATE "${schemaName}"."${tableName}" SET ${setClauses.join(", ")}`;
          const updateResult = await client.query(sql, params);
          result.rowsAffected += updateResult.rowCount || 0;
        } catch (err) {
          result.errors.push(
            `Failed to update ${schemaName}.${tableName}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }

    result.success = result.errors.length === 0;
  } catch (err) {
    result.success = false;
    result.errors.push(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await client.end().catch(() => {});
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sensitive Column Detection
// ---------------------------------------------------------------------------

export interface SensitiveColumnSuggestion {
  tableName: string;
  columnName: string;
  dataType: string;
  suggestedRule: MaskingRuleType;
  confidence: number; // 0-1
}

const SENSITIVE_PATTERNS: Array<{
  pattern: RegExp;
  rule: MaskingRuleType;
  confidence: number;
}> = [
  { pattern: /email|e_mail|mail_address/i, rule: "synthetic_email", confidence: 0.95 },
  { pattern: /phone|mobile|cell|fax/i, rule: "random_phone", confidence: 0.9 },
  { pattern: /first_?name|given_?name|fname/i, rule: "random_first_name", confidence: 0.9 },
  { pattern: /last_?name|surname|family_?name|lname/i, rule: "random_last_name", confidence: 0.9 },
  { pattern: /full_?name|display_?name|username/i, rule: "random_full_name", confidence: 0.85 },
  { pattern: /address|street|addr/i, rule: "random_address", confidence: 0.85 },
  { pattern: /city|town|locality/i, rule: "random_city", confidence: 0.8 },
  { pattern: /postal_?code|zip_?code|postcode/i, rule: "random_postal_code", confidence: 0.85 },
  { pattern: /password|passwd|pwd|secret/i, rule: "redacted", confidence: 0.95 },
  { pattern: /ssn|social_?security|sin/i, rule: "redacted", confidence: 0.95 },
  { pattern: /credit_?card|card_?number|cc_?num/i, rule: "redacted", confidence: 0.95 },
  { pattern: /date_?of_?birth|dob|birthday|birth_?date/i, rule: "random_date", confidence: 0.9 },
  { pattern: /ip_?addr|ip_?address/i, rule: "random_int", confidence: 0.7 },
  { pattern: /salary|wage|income|pay/i, rule: "random_int", confidence: 0.8 },
];

/**
 * Analyze column names and suggest masking rules for sensitive data.
 */
export function suggestMaskingRules(
  columns: Array<{ tableName: string; columnName: string; dataType: string }>
): SensitiveColumnSuggestion[] {
  const suggestions: SensitiveColumnSuggestion[] = [];

  for (const col of columns) {
    // Skip primary keys, IDs, timestamps, and booleans
    if (
      /^(id|_id|uuid|created_at|updated_at|deleted_at|is_|has_|version)$/i.test(col.columnName) ||
      /^(created|updated|deleted|timestamp)/i.test(col.columnName) ||
      col.dataType === "boolean"
    ) {
      continue;
    }

    for (const { pattern, rule, confidence } of SENSITIVE_PATTERNS) {
      if (pattern.test(col.columnName)) {
        suggestions.push({
          tableName: col.tableName,
          columnName: col.columnName,
          dataType: col.dataType,
          suggestedRule: rule,
          confidence,
        });
        break;
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
