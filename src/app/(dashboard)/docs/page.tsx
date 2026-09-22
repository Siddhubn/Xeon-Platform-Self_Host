"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Database,
  GitBranch,
  Table,
  Code2,
  Users,
  HardDrive,
  Cpu,
  Server,
  Settings,
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Plus,
  Check,
  Trash2,
  Edit3,
  Copy,
  Play,
  Terminal,
  Shield,
  Key,
  Link as LinkIcon,
  Zap,
  Globe,
  Layers,
  ArrowRight,
  ExternalLink,
  Info,
  AlertTriangle,
  Lightbulb,
  Copy as CopyIcon,
} from "lucide-react";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface DocSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  subsections: DocSubsection[];
}

interface DocSubsection {
  id: string;
  title: string;
  content: React.ReactNode;
}

// -----------------------------------------------------------------------
// Documentation Content
// -----------------------------------------------------------------------

function OverviewContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Overview
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          The <strong>Neon Console</strong> is a web-based interface for managing your self-hosted Neon PostgreSQL database. 
          It provides a user-friendly way to manage projects, branches, databases, roles, compute endpoints, and data 
          — all connected directly to your self-hosted Neon infrastructure.
        </p>
      </div>

      <div className="neon-card p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[var(--status-info)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Self-Hosted vs. Managed Neon
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              This console connects to your own self-hosted Neon PostgreSQL deployment, not the managed Neon cloud service. 
              All data stays within your infrastructure. The API endpoints communicate directly with your Postgres instances 
              using the configured connection details.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Key Features
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { icon: Database, label: "Project Management", desc: "Create and manage multiple database projects" },
            { icon: GitBranch, label: "Branch Management", desc: "Branch databases like Git branches for development" },
            { icon: Table, label: "Data Browser", desc: "View, edit, filter, and sort table data with a spreadsheet-like UI" },
            { icon: Code2, label: "SQL Editor", desc: "Write and execute SQL queries with syntax support" },
            { icon: Users, label: "Role Management", desc: "Create and manage database roles and permissions" },
            { icon: HardDrive, label: "Database Management", desc: "Create, rename, and delete databases" },
            { icon: Cpu, label: "Compute Endpoints", desc: "Manage compute resources for your databases" },
            { icon: Server, label: "Storage Nodes", desc: "Monitor storage node status and usage" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <item.icon className="w-4 h-4 text-[var(--neon-green)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[12px] font-medium text-[var(--text-primary)]">
                  {item.label}
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GettingStartedContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Getting Started
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          Follow these steps to get up and running with the Neon Console.
        </p>
      </div>

      <div className="space-y-4">
        <div className="neon-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-[var(--neon-green)] text-[var(--accent-foreground)] flex items-center justify-center text-[12px] font-bold">
              1
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Access the Console
            </h3>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] ml-10">
            Open your browser and navigate to the console URL provided by your system administrator. 
            You&apos;ll see the login page. Enter your credentials to access the dashboard.
          </p>
        </div>

        <div className="neon-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-[var(--neon-green)] text-[var(--accent-foreground)] flex items-center justify-center text-[12px] font-bold">
              2
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Create Your First Project
            </h3>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] ml-10">
            From the Dashboard, click <strong>&quot;+ New Project&quot;</strong> in the top navigation bar. 
            Give your project a name and create it. Each project represents an isolated PostgreSQL database environment.
          </p>
        </div>

        <div className="neon-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-[var(--neon-green)] text-[var(--accent-foreground)] flex items-center justify-center text-[12px] font-bold">
              3
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Select a Branch
            </h3>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] ml-10">
            Every project starts with a <strong>main</strong> branch. Use the branch selector in the top bar 
            to switch between branches. Branches allow you to create isolated database copies for development, 
            testing, or staging.
          </p>
        </div>

        <div className="neon-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-[var(--neon-green)] text-[var(--accent-foreground)] flex items-center justify-center text-[12px] font-bold">
              4
            </div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Start Exploring
            </h3>
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] ml-10">
            Use the sidebar navigation to explore different sections: browse your data with the 
            <strong> Data Browser</strong>, run queries in the <strong>SQL Editor</strong>, manage 
            <strong> Roles</strong> and <strong>Databases</strong>, and configure <strong>Compute</strong> endpoints.
          </p>
        </div>
      </div>

      <div className="neon-card p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-[var(--status-idle)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Quick Tip
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              You can connect to your database directly using any PostgreSQL client (psql, pgAdmin, DBeaver, etc.) 
              using the connection string found in your project settings. The connection details point to your 
              self-hosted Neon compute endpoint.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Dashboard
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          The Dashboard is your central hub for managing all projects. It displays a list of all your projects 
          with their status, branches, and quick actions.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Project List
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          Each project card shows:
        </p>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Project name</strong> — The identifier for your database project</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Branch count</strong> — Number of branches in the project</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Status</strong> — Active/Idle/Deleted status of the project</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Created date</strong> — When the project was created</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Creating a Project
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          Click <strong>&quot;+ New Project&quot;</strong> in the top navigation bar to create a new project. You&apos;ll need to provide:
        </p>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Project name</strong> — A descriptive name for your project</span>
          </li>
        </ul>
        <p className="text-[13px] text-[var(--text-secondary)] mt-3">
          A new project automatically creates:
        </p>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span>A <strong>main</strong> branch (default primary branch)</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span>A <strong>postgres</strong> database</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span>A <strong>compute</strong> endpoint</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span>A default <strong>cloud_admin</strong> role</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function BranchesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Branches
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          Branches in Neon work similarly to Git branches. They allow you to create isolated copies of your 
          database for development, testing, or staging without affecting production data.
        </p>
      </div>

      <div className="neon-card p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[var(--status-info)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Copy-on-Write Branching
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              Neon branches use copy-on-write technology. Creating a branch is instant and doesn&apos;t 
              duplicate your data. Data is only duplicated when modified in either branch.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Branch Operations
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <Plus className="w-4 h-4 text-[var(--neon-green)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-[var(--text-primary)]">Create Branch</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Create a new branch from an existing branch. The new branch starts as a copy-on-write snapshot.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <GitBranch className="w-4 h-4 text-[var(--neon-green)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-[var(--text-primary)]">Primary Branch</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Each project has one primary branch (usually &quot;main&quot;). This is the default branch for production traffic.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <Trash2 className="w-4 h-4 text-[var(--status-error)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-[var(--text-primary)]">Delete Branch</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Delete a non-primary branch. The primary branch cannot be deleted.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Switching Branches
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Use the branch selector in the top navigation bar to switch between branches. All data operations 
          (Data Browser, SQL Editor, Roles, Databases) operate on the currently selected branch.
        </p>
      </div>
    </div>
  );
}

function DataBrowserContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Data Browser
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          The Data Browser provides a spreadsheet-like interface for viewing, editing, and managing your 
          table data. Navigate to <strong>Data</strong> in the sidebar to access it.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Interface Layout
        </h3>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Context Bar</strong> — Top bar showing Project, Branch, and Database selectors</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Schema Sidebar</strong> — Left panel showing schemas and tables with search</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Data Grid</strong> — Main area showing table rows and columns</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Toolbar</strong> — DATA/STRUCTURE tabs, pagination, actions</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Viewing Data
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          Click any table in the schema sidebar to load its data. The grid displays:
        </p>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span>Column names and types in the header</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span>Primary key columns highlighted in green</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span>NULL values displayed in italic</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span>Timestamp columns highlighted with amber background</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Editing Data
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          To edit a cell value:
        </p>
        <ol className="space-y-2 ml-4 list-decimal list-inside">
          <li className="text-[13px] text-[var(--text-secondary)]">
            <strong>Double-click</strong> on any cell to enter edit mode
          </li>
          <li className="text-[13px] text-[var(--text-secondary)]">
            Type your new value
          </li>
          <li className="text-[13px] text-[var(--text-secondary)]">
            Press <strong>Enter</strong> to commit or <strong>Escape</strong> to cancel
          </li>
          <li className="text-[13px] text-[var(--text-secondary)]">
            The <strong>Save changes</strong> button turns green when there are pending changes
          </li>
          <li className="text-[13px] text-[var(--text-secondary)]">
            Click <strong>Save changes</strong> to persist to the database
          </li>
        </ol>
      </div>

      <div className="neon-card p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--status-idle)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Important
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              You can edit primary key columns. The system uses the original primary key value to locate the 
              row, then applies the update including the new primary key value.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Searching & Filtering
        </h3>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Search className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Quick Search</strong> — Type in the search bar to instantly filter rows across all columns</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Filter className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Advanced Filters</strong> — Click &quot;Filters&quot; to add column-specific conditions (equals, contains, starts with, etc.)</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <span className="font-mono text-[var(--neon-green)] mt-0.5 flex-shrink-0 text-[11px]">{"{ }"}</span>
            <span><strong>SQL Preview</strong> — Click &quot;SQL&quot; to see the generated query for your current filters</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Sorting
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Click any column header to sort by that column. Click again to toggle ascending/descending order. 
          The sort indicator (arrow icon) shows the current sort direction.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Row Selection & Context Menu
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          Use checkboxes to select rows. Selected rows can be bulk-copied or deleted. 
          Right-click on any row to access the context menu:
        </p>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Copy className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Copy row as JSON</strong> — Copies the row data as formatted JSON</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <CopyIcon className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Duplicate row</strong> — Opens the insert form pre-filled with the row data</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Trash2 className="w-3 h-3 text-[var(--status-error)] mt-1 flex-shrink-0" />
            <span><strong>Delete row</strong> — Deletes the row (with confirmation)</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Adding Records
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Click <strong>&quot;+ Add record&quot;</strong> in the toolbar to insert a new row. Fill in the values 
          for each column (auto-increment columns show &quot;auto&quot;). Click the checkmark to commit or X to cancel.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Structure Tab
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Switch to the <strong>STRUCTURE</strong> tab to view the table schema: column names, types, 
          nullable status, default values, and primary key indicators.
        </p>
      </div>
    </div>
  );
}

function SQLContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          SQL Editor
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          The SQL Editor provides an interface for writing and executing SQL queries directly against 
          your database. Navigate to <strong>SQL Editor</strong> in the sidebar.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Writing Queries
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          Type your SQL query in the editor area. You can write:
        </p>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>SELECT</strong> queries to read data</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>INSERT</strong> statements to add new records</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>UPDATE</strong> statements to modify existing records</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>DELETE</strong> statements to remove records</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>DDL</strong> statements (CREATE TABLE, ALTER TABLE, etc.)</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Executing Queries
        </h3>
        <ol className="space-y-2 ml-4 list-decimal list-inside">
          <li className="text-[13px] text-[var(--text-secondary)]">
            Write your query in the editor
          </li>
          <li className="text-[13px] text-[var(--text-secondary)]">
            Click <strong>&quot;Run&quot;</strong> or press <strong>Ctrl+Enter</strong> / <strong>Cmd+Enter</strong>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)]">
            Results appear below the editor in a grid format
          </li>
        </ol>
      </div>

      <div className="neon-card p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-[var(--status-idle)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Tips
            </p>
            <ul className="text-[12px] text-[var(--text-secondary)] leading-relaxed space-y-1">
              <li>• Use <code className="px-1 py-0.5 bg-[var(--bg-inset)] rounded text-[11px]">schema_name.table_name</code> to reference tables in other schemas</li>
              <li>• The query runs against the currently selected branch and database</li>
              <li>• Execution time is displayed after each query</li>
              <li>• Long-running queries can be cancelled</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function RolesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Roles
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          Database roles control access permissions. Each role can have specific privileges 
          for reading, writing, and managing database objects. Navigate to <strong>Roles</strong> in the sidebar.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Managing Roles
        </h3>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Plus className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Create Role</strong> — Create a new database role with a name and optional password</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Edit3 className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Edit Role</strong> — Modify role properties like password or login ability</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Trash2 className="w-3 h-3 text-[var(--status-error)] mt-1 flex-shrink-0" />
            <span><strong>Delete Role</strong> — Remove a role (cannot delete roles with active connections)</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Default Roles
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Every project comes with a <strong>cloud_admin</strong> role which has superuser privileges. 
          This is the administrative role used for initial setup and management tasks.
        </p>
      </div>

      <div className="neon-card p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-[var(--status-info)] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-medium text-[var(--text-primary)] mb-1">
              Security Best Practice
            </p>
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              Create dedicated roles for your applications instead of using the admin role. 
              Grant only the minimum necessary privileges to each role. Use row-level security 
              policies for multi-tenant applications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DatabasesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Databases
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          Manage the databases within each branch. Each branch can contain multiple databases, 
          similar to a standard PostgreSQL cluster. Navigate to <strong>Databases</strong> in the sidebar.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Database Operations
        </h3>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Plus className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Create Database</strong> — Create a new database with a name and optional owner role</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Trash2 className="w-3 h-3 text-[var(--status-error)] mt-1 flex-shrink-0" />
            <span><strong>Delete Database</strong> — Remove a database (cannot delete the default postgres database)</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Switching Databases
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Use the database selector in the top context bar of the Data Browser and SQL Editor to switch 
          between databases within the current branch.
        </p>
      </div>
    </div>
  );
}

function ComputeContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Compute Endpoints
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          Compute endpoints are the PostgreSQL server instances that serve your database. 
          Each branch has its own compute endpoint. Navigate to <strong>Compute</strong> in the sidebar.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          What You Can See
        </h3>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Host & Port</strong> — Connection endpoint for your compute</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Status</strong> — Whether the compute is active, idle, or deleted</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Created/Updated</strong> — Timestamps for lifecycle tracking</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Connecting Externally
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Use the host and port from the compute endpoint to connect with any PostgreSQL client:
        </p>
        <div className="mt-3 p-3 bg-[var(--bg-inset)] border border-[var(--border-default)] rounded-lg font-mono text-[12px] text-[var(--text-secondary)]">
          psql -h &lt;host&gt; -p &lt;port&gt; -U &lt;role&gt; -d &lt;database&gt;
        </div>
      </div>
    </div>
  );
}

function NodesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Storage Nodes
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          Storage nodes represent the underlying storage infrastructure for your databases. 
          Navigate to <strong>Nodes</strong> in the sidebar to monitor their status.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Monitoring
        </h3>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Node Status</strong> — Active, idle, or error states</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Resource Usage</strong> — CPU, memory, and storage metrics</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <ChevronRight className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Health Indicators</strong> — Real-time health status of each node</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function SettingsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Settings
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          Configure your project and system settings. Navigate to <strong>Settings</strong> in the sidebar.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-2">
          Available Settings
        </h3>
        <ul className="space-y-2 ml-4">
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Settings className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Project Settings</strong> — Rename projects, manage project-level configuration</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <Key className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>Connection Settings</strong> — View and copy connection strings</span>
          </li>
          <li className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2">
            <LinkIcon className="w-3 h-3 text-[var(--neon-green)] mt-1 flex-shrink-0" />
            <span><strong>API Configuration</strong> — Backend API endpoint settings</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function APIReferenceContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          API Reference
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          The Neon Console communicates with the backend through a REST API. Below are the main 
          API endpoints used by the console.
        </p>
      </div>

      <div className="space-y-3">
        {[
          { method: "GET", path: "/api/projects", desc: "List all projects" },
          { method: "POST", path: "/api/projects", desc: "Create a new project" },
          { method: "GET", path: "/api/projects/:id/branches", desc: "List branches for a project" },
          { method: "POST", path: "/api/projects/:id/branches", desc: "Create a new branch" },
          { method: "DELETE", path: "/api/projects/:id/branches/:branchId", desc: "Delete a branch" },
          { method: "GET", path: "/api/data/metadata", desc: "Get schema/table metadata" },
          { method: "GET", path: "/api/data/rows", desc: "Fetch table rows with pagination and sorting" },
          { method: "POST", path: "/api/data/row", desc: "Insert a new row" },
          { method: "PUT", path: "/api/data/row", desc: "Update a row by primary key" },
          { method: "DELETE", path: "/api/data/row", desc: "Delete a row by primary key" },
          { method: "GET", path: "/api/data/databases", desc: "List databases for a branch" },
          { method: "POST", path: "/api/data/databases", desc: "Create a new database" },
          { method: "DELETE", path: "/api/data/databases", desc: "Delete a database" },
          { method: "GET", path: "/api/data/roles", desc: "List roles for a branch" },
          { method: "POST", path: "/api/data/roles", desc: "Create a new role" },
          { method: "DELETE", path: "/api/data/roles", desc: "Delete a role" },
          { method: "POST", path: "/api/sql/execute", desc: "Execute a SQL query" },
          { method: "GET", path: "/api/compute", desc: "List compute endpoints" },
          { method: "GET", path: "/api/nodes", desc: "List storage nodes" },
        ].map((endpoint, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]"
          >
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                endpoint.method === "GET"
                  ? "bg-[var(--status-info-bg)] text-[var(--status-info)]"
                  : endpoint.method === "POST"
                    ? "bg-[var(--status-active-bg)] text-[var(--status-active)]"
                    : endpoint.method === "PUT"
                      ? "bg-[var(--status-idle-bg)] text-[var(--status-idle)]"
                      : "bg-[var(--status-error-bg)] text-[var(--status-error)]"
              }`}
            >
              {endpoint.method}
            </span>
            <code className="text-[11px] font-mono text-[var(--text-primary)] flex-shrink-0">
              {endpoint.path}
            </code>
            <span className="text-[11px] text-[var(--text-tertiary)] ml-auto">
              {endpoint.desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TroubleshootingContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-bold text-[var(--text-primary)] mb-3">
          Troubleshooting
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
          Common issues and their solutions when using the Neon Console.
        </p>
      </div>

      <div className="space-y-4">
        {[
          {
            q: "Cannot connect to database",
            a: "Verify that your compute endpoint is active and the host/port combination is correct. Check that the role has login permission and the correct password.",
          },
          {
            q: "Data changes not saving",
            a: "Ensure you click the green \"Save changes\" button after editing cells. Check that the table has a primary key defined — updates require a primary key to identify rows.",
          },
          {
            q: "No tables showing in Data Browser",
            a: "Verify you have selected the correct project, branch, and database. Check that tables exist in the selected schema (default is 'public').",
          },
          {
            q: "SQL query fails with permission error",
            a: "The current role may not have the required privileges. Check role permissions or use the cloud_admin role for administrative queries.",
          },
          {
            q: "Branch creation fails",
            a: "Ensure you have sufficient storage space. Check that the source branch exists and is not deleted. The compute endpoint may need to be active.",
          },
          {
            q: "Slow query performance",
            a: "Check if appropriate indexes exist on queried columns. Use EXPLAIN ANALYZE to understand query execution plans. Verify compute endpoint has sufficient resources.",
          },
        ].map((item, i) => (
          <div key={i} className="neon-card p-4">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-2">
              {item.q}
            </h3>
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------
// Sections Definition
// -----------------------------------------------------------------------

const docSections: DocSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: BookOpen,
    subsections: [{ id: "overview-main", title: "Introduction", content: <OverviewContent /> }],
  },
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    subsections: [{ id: "getting-started-main", title: "Quick Start", content: <GettingStartedContent /> }],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutGrid,
    subsections: [{ id: "dashboard-main", title: "Projects", content: <DashboardContent /> }],
  },
  {
    id: "branches",
    title: "Branches",
    icon: GitBranch,
    subsections: [{ id: "branches-main", title: "Branch Management", content: <BranchesContent /> }],
  },
  {
    id: "data-browser",
    title: "Data Browser",
    icon: Table,
    subsections: [{ id: "data-browser-main", title: "Viewing & Editing Data", content: <DataBrowserContent /> }],
  },
  {
    id: "sql-editor",
    title: "SQL Editor",
    icon: Code2,
    subsections: [{ id: "sql-editor-main", title: "Running Queries", content: <SQLContent /> }],
  },
  {
    id: "roles",
    title: "Roles",
    icon: Users,
    subsections: [{ id: "roles-main", title: "Role Management", content: <RolesContent /> }],
  },
  {
    id: "databases",
    title: "Databases",
    icon: HardDrive,
    subsections: [{ id: "databases-main", title: "Database Management", content: <DatabasesContent /> }],
  },
  {
    id: "compute",
    title: "Compute",
    icon: Cpu,
    subsections: [{ id: "compute-main", title: "Compute Endpoints", content: <ComputeContent /> }],
  },
  {
    id: "nodes",
    title: "Nodes",
    icon: Server,
    subsections: [{ id: "nodes-main", title: "Storage Nodes", content: <NodesContent /> }],
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    subsections: [{ id: "settings-main", title: "Configuration", content: <SettingsContent /> }],
  },
  {
    id: "api-reference",
    title: "API Reference",
    icon: Terminal,
    subsections: [{ id: "api-reference-main", title: "Endpoints", content: <APIReferenceContent /> }],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: AlertTriangle,
    subsections: [{ id: "troubleshooting-main", title: "Common Issues", content: <TroubleshootingContent /> }],
  },
];

// -----------------------------------------------------------------------
// Page Component
// -----------------------------------------------------------------------

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");

  const activeDoc = docSections.find((s) => s.id === activeSection);

  // Filter sections based on search
  const filteredSections = searchQuery
    ? docSections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.subsections.some((sub) =>
            sub.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : docSections;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar navigation */}
      <div className="w-[220px] flex-shrink-0">
        <div className="sticky top-4">
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search docs..."
              className="w-full h-[32px] pl-8 pr-3 text-[12px] bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--neon-green)] transition-colors"
            />
          </div>

          {/* Nav items */}
          <nav className="space-y-0.5">
            {filteredSections.map((section) => {
              const isActive = activeSection === section.id;
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    isActive
                      ? "bg-[var(--neon-green-bg)] text-[var(--neon-green)] font-medium"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{section.title}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 max-w-[720px]">
        {activeDoc && (
          <div className="neon-card p-6 lg:p-8">
            {activeDoc.subsections.map((sub) => (
              <div key={sub.id}>{sub.content}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
