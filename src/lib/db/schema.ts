import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

export const backups = sqliteTable("backups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id"),
  databaseName: text("database_name").notNull(),
  type: text("type").notNull().default("full"), // full, schema, data
  format: text("format").notNull().default("custom"), // custom, plain, tar
  status: text("status").notNull().default("creating"), // creating, completed, failed, deleting, restoring
  scope: text("scope").notNull().default("database"), // database, branch, project
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  checksum: text("checksum"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  completedAt: text("completed_at"),
  deletedAt: text("deleted_at"),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("admin"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Projects — maps user-facing project to internal Neon tenant
// ---------------------------------------------------------------------------

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  internalTenantId: text("internal_tenant_id").notNull().unique(),
  internalTimelineId: text("internal_timeline_id"),
  regionId: text("region_id").default("default"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  deletedAt: text("deleted_at"),
});

// ---------------------------------------------------------------------------
// Branches — maps user-facing branch to internal Neon timeline
// ---------------------------------------------------------------------------

export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  internalTimelineId: text("internal_timeline_id").notNull(),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  parentBranchId: text("parent_branch_id"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  deletedAt: text("deleted_at"),
});

// ---------------------------------------------------------------------------
// Computes — maps user-facing compute to internal endpoint/compute URL
// ---------------------------------------------------------------------------

export const computes = sqliteTable("computes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  name: text("name").notNull(),
  internalEndpointUrl: text("internal_endpoint_url"),
  host: text("host").default("localhost"),
  port: integer("port").default(5432),
  database: text("database").default("neondb"),
  role: text("role").default("neondb_owner"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  deletedAt: text("deleted_at"),
});

// ---------------------------------------------------------------------------
// Databases — PostgreSQL databases within a branch/compute
// ---------------------------------------------------------------------------

export const databases = sqliteTable("databases", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull().default("neondb_owner"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  deletedAt: text("deleted_at"),
});

// ---------------------------------------------------------------------------
// Roles — PostgreSQL roles within a branch/compute
// ---------------------------------------------------------------------------

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  name: text("name").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  deletedAt: text("deleted_at"),
});

// ---------------------------------------------------------------------------
// Operations — tracks all mutating operations
// ---------------------------------------------------------------------------

export const operations = sqliteTable("operations", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  resourceId: text("resource_id"),
  projectId: text("project_id"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  completedAt: text("completed_at"),
});

// ---------------------------------------------------------------------------
// Query History — SQL editor history
// ---------------------------------------------------------------------------

export const queryHistory = sqliteTable("query_history", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  branchId: text("branch_id"),
  database: text("database"),
  role: text("role"),
  sql: text("sql").notNull(),
  executionTimeMs: integer("execution_time_ms"),
  rowCount: integer("row_count"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------

export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  displayName: text("display_name"),
  username: text("username").unique(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  fullName: text("full_name"),
  organization: text("organization"),
  jobTitle: text("job_title"),
  location: text("location"),
  website: text("website"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  theme: text("theme").default("system"), // system, light, dark
  accentColor: text("accent_color").default("blue"),
  defaultProjectId: text("default_project_id"),
  defaultBranchId: text("default_branch_id"),
  timezone: text("timezone"),
  sidebarCollapsed: integer("sidebar_collapsed", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Export all tables
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type Compute = typeof computes.$inferSelect;
export type Database = typeof databases.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Backup = typeof backups.$inferSelect;
export type Operation = typeof operations.$inferSelect;
export type QueryHistoryEntry = typeof queryHistory.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type UserPreference = typeof userPreferences.$inferSelect;

// ---------------------------------------------------------------------------
// Organisations
// ---------------------------------------------------------------------------

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
  createdBy: text("created_by").notNull(),
});

// ---------------------------------------------------------------------------
// Organisation Memberships
// ---------------------------------------------------------------------------

export const orgMemberships = sqliteTable("org_memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  role: text("role").notNull().default("member"), // owner, admin, member, viewer
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// User Sessions (for tracking)
// ---------------------------------------------------------------------------

export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  organizationId: text("organization_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  lastActiveAt: text("last_active_at").notNull().default(new Date().toISOString()),
  endedAt: text("ended_at"),
});

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  organizationId: text("organization_id"),
  projectId: text("project_id"),
  branchId: text("branch_id"),
  computeId: text("compute_id"),
  databaseName: text("database_name"),
  roleName: text("role_name"),
  action: text("action").notNull(),
  resourceType: text("resource_type"), // branch, compute, database, role, backup, restore, import, replica, data_api, security, auth, project
  resourceId: text("resource_id"),
  resourceName: text("resource_name"),
  status: text("status").default("success"), // success, failed, warning, in_progress
  actorName: text("actor_name"),
  details: text("details"), // JSON string — metadata, no secrets
  ipAddress: text("ip_address"),
  operationId: text("operation_id"), // correlation ID for grouped events
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ---------------------------------------------------------------------------
// Infrastructure Access Assignments
// ---------------------------------------------------------------------------

export const infraAssignments = sqliteTable("infra_assignments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id"),
  branchId: text("branch_id"),
  accessLevel: text("access_level").notNull().default("read"), // read, write, admin
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export type Organization = typeof organizations.$inferSelect;
export type OrgMembership = typeof orgMemberships.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InfraAssignment = typeof infraAssignments.$inferSelect;

// ---------------------------------------------------------------------------
// Data API Configuration
// ---------------------------------------------------------------------------

export const dataApiConfigs = sqliteTable("data_api_configs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  databaseId: text("database_id"),
  databaseName: text("database_name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  baseUrl: text("base_url"),
  authMode: text("auth_mode").notNull().default("jwt"), // jwt, anonymous, api_key
  jwtSecret: text("jwt_secret"),
  jwksUrl: text("jwks_url"),
  anonymousAccess: integer("anonymous_access", { mode: "boolean" }).notNull().default(false),
  allowedSchemas: text("allowed_schemas").default("public"), // comma-separated
  defaultSchema: text("default_schema").default("public"),
  apiRoles: text("api_roles"), // comma-separated
  corsOrigins: text("cors_origins").default("*"),
  publicSchemaAccess: integer("public_schema_access", { mode: "boolean" }).notNull().default(false),
  schemaCacheLastRefreshed: text("schema_cache_last_refreshed"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export type DataApiConfig = typeof dataApiConfigs.$inferSelect;

// ---------------------------------------------------------------------------
// Data Masking Rules
// ---------------------------------------------------------------------------

export const maskingRules = sqliteTable("masking_rules", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  databaseName: text("database_name").notNull(),
  schemaName: text("schema_name").notNull().default("public"),
  tableName: text("table_name").notNull(),
  columnName: text("column_name").notNull(),
  ruleType: text("rule_type").notNull(), // random_name, random_email, random_phone, random_address, random_date, null_value, fixed_value, hash, custom_sql, preserve, synthetic_email, etc
  configuration: text("configuration"), // JSON string for rule params
  customExpression: text("custom_expression"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export type MaskingRule = typeof maskingRules.$inferSelect;

// ---------------------------------------------------------------------------
// Masking / Anonymization Operations
// ---------------------------------------------------------------------------

export const maskingOperations = sqliteTable("masking_operations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  sourceBranchId: text("source_branch_id").notNull().references(() => branches.id),
  targetBranchId: text("target_branch_id").references(() => branches.id),
  databaseName: text("database_name").notNull(),
  status: text("status").notNull().default("pending"), // pending, creating_branch, preparing, masking, verifying, completed, failed
  progress: integer("progress").notNull().default(0),
  currentStep: text("current_step"),
  totalSteps: integer("total_steps").notNull().default(4),
  rulesApplied: integer("rules_applied").notNull().default(0),
  rowsAffected: integer("rows_affected").notNull().default(0),
  error: text("error"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  completedAt: text("completed_at"),
});

export type MaskingOperation = typeof maskingOperations.$inferSelect;

// ---------------------------------------------------------------------------
// Data API Security Findings
// ---------------------------------------------------------------------------

export const securityFindings = sqliteTable("security_findings", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().references(() => organizations.id),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  databaseName: text("database_name").notNull(),
  severity: text("severity").notNull(), // critical, high, medium, low, info
  category: text("category").notNull(), // rls, permissions, exposure, auth, schema
  title: text("title").notNull(),
  description: text("description").notNull(),
  tableName: text("table_name"),
  columnName: text("column_name"),
  resolution: text("resolution"),
  autoResolvable: integer("auto_resolvable", { mode: "boolean" }).notNull().default(false),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  detectedAt: text("detected_at").notNull().default(new Date().toISOString()),
  resolvedAt: text("resolved_at"),
});

export type SecurityFinding = typeof securityFindings.$inferSelect;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  organizationId: text("organization_id"),
  type: text("type").notNull().default("info"), // success, error, warning, info, activity, system
  priority: text("priority").notNull().default("normal"), // low, normal, high, critical
  title: text("title").notNull(),
  message: text("message"),
  resourceType: text("resource_type"), // project, branch, database, backup, compute, data_api, masking, user, org
  resourceId: text("resource_id"),
  resourceName: text("resource_name"),
  actionUrl: text("action_url"),
  status: text("status").notNull().default("unread"), // unread, read
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

export type Notification = typeof notifications.$inferSelect;

// ---------------------------------------------------------------------------
// Read Replicas
// ---------------------------------------------------------------------------

export const readReplicas = sqliteTable("read_replicas", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  sourceComputeId: text("source_compute_id"),
  displayName: text("display_name").notNull(),
  internalTimelineId: text("internal_timeline_id"),
  host: text("host").default("localhost"),
  port: integer("port").default(5432),
  database: text("database").default("postgres"),
  role: text("role").default("cloud_admin"),
  status: text("status").notNull().default("creating"), // creating, starting, synchronizing, active, degraded, unavailable, stopping, stopped, failed, deleting
  type: text("type").notNull().default("read_replica"),
  replicationStatus: text("replication_status"), // healthy, lagging, disconnected
  replicationLagMs: integer("replication_lag_ms"),
  location: text("location").default("primary"),
  errorMessage: text("error_message"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
  deletedAt: text("deleted_at"),
});

export type ReadReplica = typeof readReplicas.$inferSelect;

// ---------------------------------------------------------------------------
// Import Jobs
// ---------------------------------------------------------------------------

export const importJobs = sqliteTable("import_jobs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  projectId: text("project_id").notNull().references(() => projects.id),
  branchId: text("branch_id").notNull().references(() => branches.id),
  databaseId: text("database_id"),
  databaseName: text("database_name").notNull(),
  sourceHost: text("source_host").notNull(),
  sourceDatabase: text("source_database").notNull(),
  sourceEncryptedConn: text("source_encrypted_conn"), // encrypted connection string (temp)
  status: text("status").notNull().default("pending"), // pending, validating, preparing, running, verifying, completed, failed, cancelled
  importMode: text("import_mode").notNull().default("data_only"),
  conflictStrategy: text("conflict_strategy").notNull().default("fail"), // fail, skip, upsert
  tablesSelected: text("tables_selected"), // JSON array
  tablesCompleted: integer("tables_completed").notNull().default(0),
  tablesTotal: integer("tables_total").notNull().default(0),
  rowsImported: integer("rows_imported").notNull().default(0),
  totalEstimatedRows: integer("total_estimated_rows"),
  errorSummary: text("error_summary"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

export type ImportJob = typeof importJobs.$inferSelect;

// ---------------------------------------------------------------------------
// Import Table Results
// ---------------------------------------------------------------------------

export const importTableResults = sqliteTable("import_table_results", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => importJobs.id),
  schemaName: text("schema_name").notNull().default("public"),
  tableName: text("table_name").notNull(),
  sourceRowCount: integer("source_row_count"),
  importedRowCount: integer("imported_row_count"),
  status: text("status").notNull().default("pending"), // pending, importing, completed, failed, skipped
  errorMessage: text("error_message"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
});

export type ImportTableResult = typeof importTableResults.$inferSelect;
