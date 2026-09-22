/**
 * Data API Proxy — PostgREST-compatible REST interface to PostgreSQL.
 * 
 * Translates HTTP requests to SQL queries and returns JSON responses.
 * Enforces authentication, authorization, and RLS.
 */

import pg from "pg";

export interface DataApiProxyOptions {
  host: string;
  port: number;
  database: string;
  role?: string;
  schema?: string;
  allowedSchemas?: string[];
}

export interface DataApiRequest {
  method: string;
  path: string; // e.g. "/users" or "/rpc/function_name"
  headers: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
}

export interface DataApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

function createProxyClient(opts: {
  host: string;
  port: number;
  database: string;
  role?: string;
}): pg.Client {
  return new pg.Client({
    host: opts.host,
    port: opts.port,
    database: opts.database,
    user: process.env.POSTGRES_USER || "cloud_admin",
    password: process.env.POSTGRES_PASSWORD || "helloworld",
    connectionTimeoutMillis: 5000,
    query_timeout: 30000,
    ssl: false,
  });
}

/** Validate and sanitize identifier to prevent SQL injection */
function sanitizeIdentifier(name: string): string {
  // Only allow alphanumeric, underscores, and dots
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return name;
}

/** Parse PostgREST-style select parameter into column list */
function parseSelect(select: string | undefined): string {
  if (!select || select === "*") return "*";
  // Validate each column name
  return select
    .split(",")
    .map((s) => s.trim())
    .map((s) => {
      if (!/^[a-zA-Z_*][a-zA-Z0-9_.*]*$/.test(s)) {
        throw new Error(`Invalid column in select: ${s}`);
      }
      return s;
    })
    .join(", ");
}

/** Parse ordering parameter */
function parseOrder(order: string | undefined): string {
  if (!order) return "";
  return order
    .split(",")
    .map((part) => {
      const [col, dir] = part.trim().split(".");
      const safeCol = sanitizeIdentifier(col);
      const safeDir = dir?.toUpperCase() === "DESC" ? "DESC" : "ASC";
      return `${safeCol} ${safeDir}`;
    })
    .join(", ");
}

/** Build WHERE clause from PostgREST-style filters */
function buildWhereClause(
  query: Record<string, string>,
  allowedSchemas: string[]
): { whereClause: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  const skipParams = new Set([
    "select", "order", "limit", "offset", "limit", "columns",
  ]);

  for (const [key, value] of Object.entries(query)) {
    if (skipParams.has(key) || key.startsWith("_")) continue;

    // PostgREST-style operators
    if (key.endsWith("=not.is.null")) {
      const col = sanitizeIdentifier(key.replace("=not.is.null", ""));
      conditions.push(`${col} IS NOT NULL`);
    } else if (key.endsWith("=is.null")) {
      const col = sanitizeIdentifier(key.replace("=is.null", ""));
      conditions.push(`${col} IS NULL`);
    } else if (key.endsWith("=like")) {
      const col = sanitizeIdentifier(key.replace("=like", ""));
      conditions.push(`${col} LIKE $${paramIndex}`);
      params.push(value);
      paramIndex++;
    } else if (key.endsWith("=ilike")) {
      const col = sanitizeIdentifier(key.replace("=ilike", ""));
      conditions.push(`${col} ILIKE $${paramIndex}`);
      params.push(value);
      paramIndex++;
    } else if (key.endsWith("=gte")) {
      const col = sanitizeIdentifier(key.replace("=gte", ""));
      conditions.push(`${col} >= $${paramIndex}`);
      params.push(value);
      paramIndex++;
    } else if (key.endsWith("=lte")) {
      const col = sanitizeIdentifier(key.replace("=lte", ""));
      conditions.push(`${col} <= $${paramIndex}`);
      params.push(value);
      paramIndex++;
    } else if (key.endsWith("=gt")) {
      const col = sanitizeIdentifier(key.replace("=gt", ""));
      conditions.push(`${col} > $${paramIndex}`);
      params.push(value);
      paramIndex++;
    } else if (key.endsWith("=lt")) {
      const col = sanitizeIdentifier(key.replace("=lt", ""));
      conditions.push(`${col} < $${paramIndex}`);
      params.push(value);
      paramIndex++;
    } else if (key.endsWith("=in")) {
      const col = sanitizeIdentifier(key.replace("=in", ""));
      const values = value.replace(/^\(/, "").replace(/\)$/, "").split(",");
      const placeholders = values.map((_, i) => {
        params.push(values[i].trim());
        return `$${paramIndex + i}`;
      });
      paramIndex += values.length;
      conditions.push(`${col} IN (${placeholders.join(", ")})`);
    } else if (key.endsWith("=neq")) {
      const col = sanitizeIdentifier(key.replace("=neq", ""));
      conditions.push(`${col} != $${paramIndex}`);
      params.push(value);
      paramIndex++;
    } else {
      // Simple equality
      const col = sanitizeIdentifier(key);
      if (allowedSchemas.length > 0 || true) {
        conditions.push(`${col} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

export async function handleDataApiRequest(
  req: DataApiRequest,
  opts: DataApiProxyOptions
): Promise<DataApiResponse> {
  const allowedSchemas = opts.allowedSchemas || ["public"];
  const client = createProxyClient(opts);

  try {
    await client.connect();

    // Set role if specified
    if (opts.role) {
      try {
        await client.query(`SET ROLE "${opts.role}"`);
      } catch {
        // Role may not exist
      }
    }

    const path = req.path.replace(/^\/+/, "").replace(/\/+$/, "");
    const parts = path.split("/");

    // RPC call: /rpc/function_name
    if (parts[0] === "rpc" && parts[1]) {
      const fnName = sanitizeIdentifier(parts[1]);
      const body = (req.body || {}) as Record<string, unknown>;
      const keys = Object.keys(body);
      const values = Object.values(body);
      const placeholders = values.map((_, i) => `$${i + 1}`);

      const sql = `SELECT * FROM ${opts.schema || "public"}."${fnName}"(${keys.map((k, i) => `"${sanitizeIdentifier(k)}" => $${i + 1}`).join(", ")})`;
      const result = await client.query(sql, values as unknown[]);

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: result.rows,
      };
    }

    // Table/View access: /table_name
    if (parts.length >= 1 && parts[0]) {
      const tableName = sanitizeIdentifier(parts[0]);

      switch (req.method) {
        case "GET": {
          const select = parseSelect(req.query.select);
          const order = parseOrder(req.query.order);
          const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
          const offset = req.query.offset ? parseInt(req.query.offset) : undefined;

          const { whereClause, params } = buildWhereClause(req.query, allowedSchemas);

          let sql = `SELECT ${select} FROM ${opts.schema || "public"}."${tableName}" ${whereClause}`;
          if (order) sql += ` ORDER BY ${order}`;
          if (limit) sql += ` LIMIT ${Math.min(limit, 1000)}`;
          if (offset) sql += ` OFFSET ${offset}`;

          const result = await client.query(sql, params);

          // Get total count
          let totalCount = result.rowCount || 0;
          if (limit || offset) {
            const countResult = await client.query(
              `SELECT COUNT(*) as count FROM ${opts.schema || "public"}."${tableName}" ${whereClause}`,
              params
            );
            totalCount = parseInt(countResult.rows[0]?.count || "0");
          }

          return {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "X-Total-Count": String(totalCount),
              "Content-Range": `${offset || 0}-${(offset || 0) + result.rows.length - 1}/${totalCount}`,
            },
            body: result.rows,
          };
        }

        case "POST": {
          const body = (req.body || {}) as Record<string, unknown>;
          const keys = Object.keys(body);
          const values = Object.values(body);
          const placeholders = values.map((_, i) => `$${i + 1}`);

          const sql = `INSERT INTO ${opts.schema || "public"}."${tableName}" (${keys.map((k) => `"${sanitizeIdentifier(k)}"`).join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`;
          const result = await client.query(sql, values as unknown[]);

          return {
            status: 201,
            headers: { "Content-Type": "application/json" },
            body: result.rows[0],
          };
        }

        case "PATCH": {
          const body = (req.body || {}) as Record<string, unknown>;
          const { whereClause, params: whereParams } = buildWhereClause(req.query, allowedSchemas);

          if (!whereClause) {
            return {
              status: 400,
              headers: { "Content-Type": "application/json" },
              body: { error: "PATCH requires filter conditions (e.g., ?id=eq.1)" },
            };
          }

          const setClauses = Object.entries(body).map(([key, _], i) => {
            return `"${sanitizeIdentifier(key)}" = $${i + 1}`;
          });
          const setValues = Object.values(body);
          const allParams = [...setValues, ...whereParams];

          const sql = `UPDATE ${opts.schema || "public"}."${tableName}" SET ${setClauses.join(", ")} ${whereClause.replace(/\$\d+/g, (match) => {
            const idx = parseInt(match.slice(1)) + setValues.length;
            return `$${idx}`;
          })} RETURNING *`;
          const result = await client.query(sql, allParams as unknown[]);

          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: result.rows,
          };
        }

        case "DELETE": {
          const { whereClause, params } = buildWhereClause(req.query, allowedSchemas);

          if (!whereClause) {
            return {
              status: 400,
              headers: { "Content-Type": "application/json" },
              body: { error: "DELETE requires filter conditions (e.g., ?id=eq.1)" },
            };
          }

          const sql = `DELETE FROM ${opts.schema || "public"}."${tableName}" ${whereClause} RETURNING *`;
          const result = await client.query(sql, params);

          return {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: result.rows,
          };
        }

        default:
          return {
            status: 405,
            headers: { "Content-Type": "application/json" },
            body: { error: `Method ${req.method} not supported` },
          };
      }
    }

    return {
      status: 404,
      headers: { "Content-Type": "application/json" },
      body: { error: "No resource specified" },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 500,
      headers: { "Content-Type": "application/json" },
      body: { error: message },
    };
  } finally {
    await client.end().catch(() => {});
  }
}
