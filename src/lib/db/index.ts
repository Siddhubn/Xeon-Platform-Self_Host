import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// Database file location
// ---------------------------------------------------------------------------

const DB_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "neon-console.db");

// Ensure the data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Schema initialization (raw SQL — runs once)
// ---------------------------------------------------------------------------

const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT,
    database_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'full',
    format TEXT NOT NULL DEFAULT 'custom',
    status TEXT NOT NULL DEFAULT 'creating',
    scope TEXT NOT NULL DEFAULT 'database',
    file_path TEXT,
    file_size INTEGER,
    checksum TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    internal_tenant_id TEXT NOT NULL UNIQUE,
    internal_timeline_id TEXT,
    region_id TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS branches (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    internal_timeline_id TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    parent_branch_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS computes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    name TEXT NOT NULL,
    internal_endpoint_url TEXT,
    host TEXT DEFAULT 'localhost',
    port INTEGER DEFAULT 5432,
    database TEXT DEFAULT 'neondb',
    role TEXT DEFAULT 'neondb_owner',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS databases (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    name TEXT NOT NULL,
    owner_name TEXT NOT NULL DEFAULT 'neondb_owner',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    resource_id TEXT,
    project_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS query_history (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    branch_id TEXT,
    database TEXT,
    role TEXT,
    sql TEXT NOT NULL,
    execution_time_ms INTEGER,
    row_count INTEGER,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    display_name TEXT,
    username TEXT UNIQUE,
    bio TEXT,
    avatar_url TEXT,
    full_name TEXT,
    organization TEXT,
    job_title TEXT,
    location TEXT,
    website TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    theme TEXT DEFAULT 'system',
    accent_color TEXT DEFAULT 'blue',
    default_project_id TEXT,
    default_branch_id TEXT,
    timezone TEXT,
    sidebar_collapsed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS org_memberships (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    organization_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    organization_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    resource_name TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS infra_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT,
    branch_id TEXT,
    access_level TEXT NOT NULL DEFAULT 'read',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS data_api_configs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    database_id TEXT,
    database_name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    base_url TEXT,
    auth_mode TEXT NOT NULL DEFAULT 'jwt',
    jwt_secret TEXT,
    jwks_url TEXT,
    anonymous_access INTEGER NOT NULL DEFAULT 0,
    allowed_schemas TEXT DEFAULT 'public',
    default_schema TEXT DEFAULT 'public',
    api_roles TEXT,
    cors_origins TEXT DEFAULT '*',
    public_schema_access INTEGER NOT NULL DEFAULT 0,
    schema_cache_last_refreshed TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS masking_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    database_name TEXT NOT NULL,
    schema_name TEXT NOT NULL DEFAULT 'public',
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    rule_type TEXT NOT NULL,
    configuration TEXT,
    custom_expression TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS masking_operations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    source_branch_id TEXT NOT NULL REFERENCES branches(id),
    target_branch_id TEXT REFERENCES branches(id),
    database_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0,
    current_step TEXT,
    total_steps INTEGER NOT NULL DEFAULT 4,
    rules_applied INTEGER NOT NULL DEFAULT 0,
    rows_affected INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS security_findings (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    database_name TEXT NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    table_name TEXT,
    column_name TEXT,
    resolution TEXT,
    auto_resolvable INTEGER NOT NULL DEFAULT 0,
    resolved INTEGER NOT NULL DEFAULT 0,
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
  );

  CREATE TABLE IF NOT EXISTS read_replicas (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    source_compute_id TEXT,
    display_name TEXT NOT NULL,
    internal_timeline_id TEXT,
    host TEXT DEFAULT 'localhost',
    port INTEGER DEFAULT 5432,
    database TEXT DEFAULT 'postgres',
    role TEXT DEFAULT 'cloud_admin',
    status TEXT NOT NULL DEFAULT 'creating',
    type TEXT NOT NULL DEFAULT 'read_replica',
    replication_status TEXT,
    replication_lag_ms INTEGER,
    location TEXT DEFAULT 'primary',
    error_message TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    organization_id TEXT,
    type TEXT NOT NULL DEFAULT 'info',
    priority TEXT NOT NULL DEFAULT 'normal',
    title TEXT NOT NULL,
    message TEXT,
    resource_type TEXT,
    resource_id TEXT,
    resource_name TEXT,
    action_url TEXT,
    status TEXT NOT NULL DEFAULT 'unread',
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS import_jobs (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    project_id TEXT NOT NULL REFERENCES projects(id),
    branch_id TEXT NOT NULL REFERENCES branches(id),
    database_id TEXT,
    database_name TEXT NOT NULL,
    source_host TEXT NOT NULL,
    source_database TEXT NOT NULL,
    source_encrypted_conn TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    import_mode TEXT NOT NULL DEFAULT 'data_only',
    conflict_strategy TEXT NOT NULL DEFAULT 'fail',
    tables_selected TEXT,
    tables_completed INTEGER NOT NULL DEFAULT 0,
    tables_total INTEGER NOT NULL DEFAULT 0,
    rows_imported INTEGER NOT NULL DEFAULT 0,
    total_estimated_rows INTEGER,
    error_summary TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS import_table_results (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES import_jobs(id),
    schema_name TEXT NOT NULL DEFAULT 'public',
    table_name TEXT NOT NULL,
    source_row_count INTEGER,
    imported_row_count INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    started_at TEXT,
    completed_at TEXT
  );
`;

// ---------------------------------------------------------------------------
// Migrations (add columns that may not exist in older databases)
// ---------------------------------------------------------------------------

const MIGRATIONS = [
  `ALTER TABLE user_preferences ADD COLUMN accent_color TEXT DEFAULT 'blue'`,
  // Activity logs — monitoring extensions
  `ALTER TABLE activity_logs ADD COLUMN project_id TEXT`,
  `ALTER TABLE activity_logs ADD COLUMN branch_id TEXT`,
  `ALTER TABLE activity_logs ADD COLUMN compute_id TEXT`,
  `ALTER TABLE activity_logs ADD COLUMN database_name TEXT`,
  `ALTER TABLE activity_logs ADD COLUMN role_name TEXT`,
  `ALTER TABLE activity_logs ADD COLUMN status TEXT DEFAULT 'success'`,
  `ALTER TABLE activity_logs ADD COLUMN actor_name TEXT`,
  `ALTER TABLE activity_logs ADD COLUMN operation_id TEXT`,
];

// Activity log indexes for monitoring performance
const ACTIVITY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_activity_project ON activity_logs(project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_branch ON activity_logs(branch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_compute ON activity_logs(compute_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_resource_type ON activity_logs(resource_type)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_status ON activity_logs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_project_branch ON activity_logs(project_id, branch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_logs(project_id, created_at)`,
];

// ---------------------------------------------------------------------------
// Singleton — auto-initializes tables on first access
// ---------------------------------------------------------------------------

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _initialized = false;

export function getDb() {
  if (!_db) {
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    // Auto-create tables on first access
    if (!_initialized) {
      sqlite.exec(CREATE_TABLES_SQL);
      // Run migrations to add columns to existing tables
      for (const migration of MIGRATIONS) {
        try {
          sqlite.exec(migration);
        } catch {
          // Column may already exist — ignore
        }
      }
      // Create activity monitoring indexes
      for (const idx of ACTIVITY_INDEXES) {
        try {
          sqlite.exec(idx);
        } catch {
          // Index may already exist — ignore
        }
      }
      _initialized = true;
    }

    _db = drizzle(sqlite, { schema });

    // Seed default users, organisation, and memberships
    try {
      const userCount = sqlite.prepare("SELECT count(*) as c FROM users").get() as any;
      if (userCount?.c === 0) {
        sqlite.prepare(
          `INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)`
        ).run("1", "Admin", "admin@neon.io", "admin");
        sqlite.prepare(
          `INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)`
        ).run("2", "Developer", "dev@neon.io", "developer");
        sqlite.prepare(
          `INSERT OR IGNORE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)`
        ).run("3", "Viewer", "readonly@neon.io", "readonly");
      }

      const orgCount = sqlite.prepare("SELECT count(*) as c FROM organizations").get() as any;
      if (orgCount?.c === 0) {
        const defaultOrgId = "org-default-001";
        sqlite.prepare(
          `INSERT INTO organizations (id, name, slug, description, created_by) VALUES (?, ?, ?, ?, ?)`
        ).run(defaultOrgId, "My Organisation", "my-organisation", "Default organisation", "1");

        // Create memberships for all demo users
        const memCount = sqlite.prepare("SELECT count(*) as c FROM org_memberships").get() as any;
        if (memCount?.c === 0) {
          sqlite.prepare(
            `INSERT INTO org_memberships (id, user_id, organization_id, role) VALUES (?, ?, ?, ?)`
          ).run("mem-admin-001", "1", defaultOrgId, "owner");
          sqlite.prepare(
            `INSERT INTO org_memberships (id, user_id, organization_id, role) VALUES (?, ?, ?, ?)`
          ).run("mem-dev-001", "2", defaultOrgId, "member");
          sqlite.prepare(
            `INSERT INTO org_memberships (id, user_id, organization_id, role) VALUES (?, ?, ?, ?)`
          ).run("mem-ro-001", "3", defaultOrgId, "viewer");
        }
      }
    } catch (e) {
      // Ignore seed errors
    }
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Explicit init (for startup / scripts)
// ---------------------------------------------------------------------------

export function initDb() {
  return getDb();
}
