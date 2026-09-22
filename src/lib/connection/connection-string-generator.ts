// ---------------------------------------------------------------------------
// Connection String Generator — produces all supported connection formats
// ---------------------------------------------------------------------------

import type {
  ConnectionStringInput,
  ConnectionStringOutput,
  ConnectionNetworkMode,
  SslMode,
  ResolvedHost,
} from "./types";
import { resolveHost, resolveSslMode } from "./connection-host-resolver";

/**
 * URL-encode a password for use in PostgreSQL URIs.
 * Handles special characters that would break the URI.
 */
function encodePassword(password: string): string {
  return encodeURIComponent(password);
}

/**
 * Escape a value for use in psql command-line string.
 */
function escapeShellArg(arg: string): string {
  // Wrap in single quotes, escaping internal single quotes
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * Generate all connection string formats from the resolved connection details.
 */
export function generateConnectionStrings(
  input: ConnectionStringInput,
  resolvedHost: { host: string; port: number; source: ResolvedHost['source']; tailscaleInfo?: ResolvedHost['tailscaleInfo'] }
): ConnectionStringOutput {
  const { host, port } = resolvedHost;
  const user = input.roleName;
  const database = input.databaseName;
  const password = input.password || "";
  const sslMode = resolveSslMode(input.networkMode, input.sslMode);

  const encodedPassword = password ? encodePassword(password) : "";

  // Base URI parts
  const authPart = password ? `${user}:${encodedPassword}@` : `${user}@`;
  const baseUri = `postgresql://${authPart}${host}:${port}/${database}`;

  // For public mode, the Neon proxy requires the endpoint ID as an option.
  // This tells the proxy which compute to route the connection to.
  const endpointOption = input.networkMode === "public" && input.endpointId
    ? `options=endpoint%3D${encodeURIComponent(input.endpointId)}`
    : null;

  const baseUriSsl = endpointOption
    ? `${baseUri}?sslmode=${sslMode}&${endpointOption}`
    : `${baseUri}?sslmode=${sslMode}`;

  // Pooler details
  const poolerHost = input.poolerHost || host;
  const poolerPort = input.poolerPort || 5432;
  const poolerUri = password
    ? `postgresql://${user}:${encodedPassword}@${poolerHost}:${poolerPort}/${database}?sslmode=${sslMode}`
    : `postgresql://${user}@${poolerHost}:${poolerPort}/${database}?sslmode=${sslMode}`;

  const formats = {
    // 1. Standard PostgreSQL URI
    postgresqlUri: endpointOption ? `${baseUri}?${endpointOption}` : baseUri,

    // 2. PostgreSQL URI with SSL
    postgresqlUriSsl: baseUriSsl,

    // 3. psql command
    psqlCommand: `psql "${baseUriSsl}"`,

    // 19. Public/Remote connection string (Neon proxy)
    publicConnectionString:
      input.networkMode === "public" && endpointOption
        ? `${baseUri}?sslmode=${sslMode}&${endpointOption}`
        : null,

    // 4. Individual connection parameters
    individualParams: {
      Host: host,
      Port: String(port),
      Database: database,
      User: user,
      Password: password || "(set password)",
      "SSL Mode": sslMode,
    },

    // 5. Environment variable format
    environmentVariable: `DATABASE_URL="${baseUriSsl}"`,

    // 6. libpq key-value format
    libpqKeyValue: `host=${host} port=${port} dbname=${database} user=${user}${
      password ? ` password=${password}` : ""
    } sslmode=${sslMode}`,

    // 7. JDBC connection string
    jdbcString: `jdbc:postgresql://${host}:${port}/${database}?user=${user}${
      password ? `&password=${password}` : ""
    }&sslmode=${sslMode}`,

    // 8. Node.js / JavaScript
    nodeJs: `import { Client } from 'pg';\n\nconst client = new Client({\n  connectionString: process.env.DATABASE_URL,\n  // or individually:\n  host: '${host}',\n  port: ${port},\n  database: '${database}',\n  user: '${user}',\n  password: process.env.DB_PASSWORD,\n  ssl: ${sslMode !== "disable" ? "{ rejectUnauthorized: false }" : "false"},\n});\n\nawait client.connect();`,

    // 9. Python psycopg
    pythonPsycopg: `import psycopg\n\nconn = psycopg.connect(\n    host="${host}",\n    port=${port},\n    dbname="${database}",\n    user="${user}",\n    password="${password || "YOUR_PASSWORD"}",\n    sslmode="${sslMode}"\n)\n\n# Or use connection string:\n# conn = psycopg.connect(\n#     "${baseUriSsl}"\n# )`,

    // 10. Python asyncpg
    pythonAsyncpg: `import asyncio\nimport asyncpg\n\nasync def main():\n    conn = await asyncpg.connect(\n        host="${host}",\n        port=${port},\n        database="${database}",\n        user="${user}",\n        password="${password || "YOUR_PASSWORD"}",\n        ssl="${sslMode !== "disable" ? "require" : "disable"}"\n    )\n    # Or use connection string:\n    # conn = await asyncpg.connect("${baseUriSsl}")\n    \n    version = await conn.fetchval('SELECT version()')\n    print(version)\n    await conn.close()\n\nasyncio.run(main())`,

    // 11. Python SQLAlchemy
    pythonSqlAlchemy: `from sqlalchemy import create_engine\n\n# Connection URL:\nDATABASE_URL = "${baseUriSsl}"\n\nengine = create_engine(DATABASE_URL)\n\nwith engine.connect() as conn:\n    result = conn.execute(text("SELECT 1"))\n    print(result.fetchone())`,

    // 12. Go pgx
    goPgx: `package main\n\nimport (\n    "context"\n    "fmt"\n    "os"\n\n    "github.com/jackc/pgx/v5"\n)\n\nfunc main() {\n    connStr := "${baseUriSsl}"\n    // Or use env: connStr := os.Getenv("DATABASE_URL")\n    \n    conn, err := pgx.Connect(context.Background(), connStr)\n    if err != nil {\n        fmt.Fprintf(os.Stderr, "Unable to connect: %v\\n", err)\n        os.Exit(1)\n    }\n    defer conn.Close(context.Background())\n    \n    var version string\n    conn.QueryRow(context.Background(), "SELECT version()").Scan(&version)\n    fmt.Println(version)\n}`,

    // 13. Go database/sql
    goDatabaseSql: `package main\n\nimport (\n    "database/sql"\n    "fmt"\n    "log"\n\n    _ "github.com/lib/pq"\n)\n\nfunc main() {\n    connStr := "${baseUriSsl}"\n    db, err := sql.Open("postgres", connStr)\n    if err != nil {\n        log.Fatal(err)\n    }\n    defer db.Close()\n    \n    var version string\n    err = db.QueryRow("SELECT version()").Scan(&version)\n    if err != nil {\n        log.Fatal(err)\n    }\n    fmt.Println(version)\n}`,

    // 14. Java JDBC
    javaJdbc: `import java.sql.Connection;\nimport java.sql.DriverManager;\nimport java.sql.ResultSet;\nimport java.sql.Statement;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        String url = "jdbc:postgresql://${host}:${port}/${database}";\n        String user = "${user}";\n        String password = "${password || "YOUR_PASSWORD"}";\n        \n        Connection conn = DriverManager.getConnection(url, user, password);\n        Statement stmt = conn.createStatement();\n        ResultSet rs = stmt.executeQuery("SELECT version()");\n        \n        if (rs.next()) {\n            System.out.println(rs.getString(1));\n        }\n        \n        rs.close();\n        stmt.close();\n        conn.close();\n    }\n}`,

    // 15. .NET Npgsql
    dotnetNpgsql: `using Npgsql;\n\nvar connectionString = "${baseUriSsl}";\n\nawait using var conn = new NpgsqlConnection(connectionString);\nawait conn.OpenAsync();\n\nawait using var cmd = new NpgsqlCommand("SELECT version()", conn);\nvar version = await cmd.ExecuteScalarAsync();\nConsole.WriteLine(version);`,

    // 16. Prisma
    prismaEnv: `# prisma/schema.prisma\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n# .env\nDATABASE_URL="${baseUriSsl}"`,

    // 17. Drizzle ORM
    drizzleEnv: `import { drizzle } from 'drizzle-orm/node-postgres';\nimport { pgTable, text, serial } from 'drizzle-orm/pg-core';\nimport { Pool } from 'pg';\n\n// .env\n// DATABASE_URL="${baseUriSsl}"\n\nconst pool = new Pool({\n  connectionString: process.env.DATABASE_URL,\n});\n\nexport const db = drizzle(pool);`,

    // 18. Neon Serverless (if compatible)
    neonServerless:
      // Neon serverless driver requires WebSocket transport, which is specific to Neon Cloud.
      // For self-hosted, this is typically not available.
      `// ⚠️ @neondatabase/serverless requires Neon Cloud WebSocket transport.\n// For self-hosted Neon, use the standard 'pg' driver instead:\n// npm install pg\n\nimport { Client } from 'pg';\n\nconst client = new Client({\n  connectionString: process.env.DATABASE_URL,\n});\n\nawait client.connect();`,
  };

  return {
    host,
    port,
    database,
    user,
    sslMode,
    networkMode: input.networkMode,
    connectionType: input.connectionType,
    resolvedHost,
    poolerAvailable: !!input.poolerHost,
    poolerHost: input.poolerHost,
    poolerPort: input.poolerPort,
    formats,
  };
}
