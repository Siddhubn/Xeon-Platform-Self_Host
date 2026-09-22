/**
 * DatabasePlatformProvider — abstraction layer interfaces
 * These define the contract between the frontend and the backend provider.
 * The frontend uses user-friendly terminology (Project, Branch, etc.)
 * The backend translates to internal Neon infrastructure concepts.
 */

// -----------------------------------------------------------------------
// Project Types
// -----------------------------------------------------------------------

export interface PlatformProject {
  id: string;
  name: string;
  createdAt: string;
  defaultBranchId: string | null;
  branchCount: number;
  internalTenantId: string;
}

export interface PlatformProjectDetail extends PlatformProject {
  primaryTimelineId: string | null;
  pgVersion: number | null;
  timelineCount: number;
  shardCount: number;
  physicalSize: number | null;
  policy: Record<string, unknown>;
  stripeSize: number;
}

export interface CreateProjectInput {
  name: string;
  pgVersion?: number;
  regionId?: string;
}

export interface RenameProjectInput {
  name: string;
}

// -----------------------------------------------------------------------
// Branch Types
// -----------------------------------------------------------------------

export interface PlatformBranch {
  id: string;
  projectId: string;
  name: string;
  isPrimary: boolean;
  parentBranchId: string | null;
  pgVersion: number;
  state: string;
  lastRecordLsn: string | null;
  createdAt: string;
  internalTimelineId: string;
}

export interface PlatformBranchDetail extends PlatformBranch {
  ancestorLsn: string | null;
  physicalSize: number | null;
}

export interface CreateBranchInput {
  projectId: string;
  parentBranchId: string;
  name: string;
  ancestorLsn?: string;
}

export interface RenameBranchInput {
  name: string;
}

// -----------------------------------------------------------------------
// Compute Types
// -----------------------------------------------------------------------

export interface PlatformCompute {
  id: string;
  projectId: string;
  branchId: string;
  name: string;
  status: "running" | "stopped" | "unknown";
  host: string;
  port: number;
  pgVersion: number;
  database: string;
  role: string;
  createdAt: string;
  lastActive: string | null;
  internalComputeUrl: string;
}

// -----------------------------------------------------------------------
// Database Types
// -----------------------------------------------------------------------

export interface PlatformDatabase {
  id: string;
  projectId: string;
  branchId: string;
  name: string;
  ownerName: string;
  createdAt: string;
}

export interface CreateDatabaseInput {
  projectId: string;
  branchId: string;
  name: string;
  ownerName: string;
}

// -----------------------------------------------------------------------
// Role Types
// -----------------------------------------------------------------------

export interface PlatformRole {
  id: string;
  projectId: string;
  branchId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateRoleInput {
  projectId: string;
  branchId: string;
  name: string;
  password: string;
}

// -----------------------------------------------------------------------
// SQL Types
// -----------------------------------------------------------------------

export interface SqlQueryInput {
  projectId: string;
  branchId: string;
  database: string;
  role: string;
  sql: string;
}

export interface SqlQueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  executionTimeMs: number;
  error?: string;
}

// -----------------------------------------------------------------------
// Operation Types
// -----------------------------------------------------------------------

export interface PlatformOperation {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  resourceId?: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

// -----------------------------------------------------------------------
// Node Types
// -----------------------------------------------------------------------

export interface PlatformNode {
  id: number;
  availability: string;
  scheduling: string;
  listenHttpAddr: string;
  listenHttpPort: number;
  listenPgAddr: string;
  listenPgPort: number;
  primaryShardCount: number;
  secondaryShardCount: number;
  availabilityZoneId: string;
}

// -----------------------------------------------------------------------
// Service Interfaces
// -----------------------------------------------------------------------

export interface ProjectService {
  list(): Promise<PlatformProject[]>;
  get(id: string): Promise<PlatformProjectDetail>;
  create(input: CreateProjectInput): Promise<PlatformProject>;
  rename(id: string, input: RenameProjectInput): Promise<PlatformProject>;
  delete(id: string): Promise<void>;
}

export interface BranchService {
  list(projectId: string): Promise<PlatformBranch[]>;
  get(projectId: string, branchId: string): Promise<PlatformBranchDetail>;
  create(input: CreateBranchInput): Promise<PlatformBranch>;
  rename(
    projectId: string,
    branchId: string,
    input: RenameBranchInput
  ): Promise<PlatformBranch>;
  delete(projectId: string, branchId: string): Promise<void>;
}

export interface ComputeService {
  list(projectId: string): Promise<PlatformCompute[]>;
  getStatus(computeId: string): Promise<PlatformCompute>;
  start(computeId: string): Promise<void>;
  stop(computeId: string): Promise<void>;
}

export interface DatabaseService {
  list(projectId: string, branchId: string): Promise<PlatformDatabase[]>;
  create(input: CreateDatabaseInput): Promise<PlatformDatabase>;
  delete(projectId: string, branchId: string, databaseName: string): Promise<void>;
}

export interface RoleService {
  list(projectId: string, branchId: string): Promise<PlatformRole[]>;
  create(input: CreateRoleInput): Promise<PlatformRole>;
  delete(projectId: string, branchId: string, roleName: string): Promise<void>;
  resetPassword(
    projectId: string,
    branchId: string,
    roleName: string,
    newPassword: string
  ): Promise<void>;
}

export interface SqlService {
  execute(input: SqlQueryInput): Promise<SqlQueryResult>;
}

export interface OperationService {
  get(id: string): Promise<PlatformOperation | null>;
  list(projectId?: string): Promise<PlatformOperation[]>;
}

export interface NodeService {
  list(): Promise<PlatformNode[]>;
  get(nodeId: number): Promise<PlatformNode>;
}

// -----------------------------------------------------------------------
// Provider Interface
// -----------------------------------------------------------------------

export interface DatabasePlatformProvider {
  projects: ProjectService;
  branches: BranchService;
  computes: ComputeService;
  databases: DatabaseService;
  roles: RoleService;
  sql: SqlService;
  operations: OperationService;
  nodes: NodeService;
}
