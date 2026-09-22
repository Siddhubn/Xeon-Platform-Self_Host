"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Database,
  Plus,
  MoreVertical,
  Trash2,
  ExternalLink,
  RefreshCw,
  Search,
  GitBranch,
  Download,
  Cpu,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import CreateProjectDialog from "@/components/CreateProjectDialog";
import { ProjectsSkeleton } from "@/components/Skeleton";

interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  defaultBranchId: string | null;
  branchCount: number;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ProjectSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (project: ProjectSummary) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setDeleteConfirm(null);
        fetchProjects();
      }
    } catch {
      alert("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-page-enter px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Projects</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Manage your database projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProjects}
            disabled={loading}
            className="neon-btn neon-btn-ghost neon-btn-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin-slow" : ""}`} />
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="neon-btn neon-btn-primary"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Import Data Banner */}
      <button
        onClick={() => router.push("/import-data")}
        className="w-full flex items-center gap-3 px-4 py-3 mb-5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] transition-all group cursor-pointer"
      >
        <div className="w-8 h-8 rounded-md bg-[var(--accent-soft)] flex items-center justify-center flex-shrink-0">
          <Download className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            Import Data
          </p>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Import an existing PostgreSQL or Neon database as a new project
          </p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors" />
      </button>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* Projects */}
      {loading ? (
        <ProjectsSkeleton inline />
      ) : (
        <>
          {/* My Projects */}
          {filteredProjects.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                My Projects
              </h2>
              <div className="space-y-1">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-transparent hover:border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer group"
                    onClick={() => router.push(`/projects/${project.id}/dashboard`)}
                  >
                    <div className="w-8 h-8 rounded-md bg-[var(--neon-green-bg)] flex items-center justify-center flex-shrink-0">
                      <Database className="w-4 h-4 text-[var(--neon-green)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {project.name}
                      </p>
                      <div className="flex items-center gap-2.5 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                          <GitBranch className="w-3 h-3" />
                          {project.branchCount} {project.branchCount === 1 ? "branch" : "branches"}
                        </span>
                        <span className="text-[11px] text-[var(--text-tertiary)]">
                          Created {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu(contextMenu === project.id ? null : project.id);
                        }}
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-hover-strong)] transition-all"
                      >
                        <MoreVertical className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                      </button>
                      {contextMenu === project.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 rounded-lg z-10 dropdown-menu">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/projects/${project.id}/dashboard`);
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-[12px] hover:bg-[var(--bg-hover-strong)] flex items-center gap-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open Project
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(project);
                              setContextMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-[12px] hover:bg-[var(--status-error-bg)] text-[var(--status-error)] flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Project
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredProjects.length === 0 && !search && (
            <div className="py-16 text-center">
              <Database className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                No projects yet
              </p>
              <p className="text-[12px] text-[var(--text-secondary)] mb-5">
                Create your first project or import an existing database
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowCreateDialog(true)}
                  className="neon-btn neon-btn-primary neon-btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Project
                </button>
                <button
                  onClick={() => router.push("/import-data")}
                  className="neon-btn neon-btn-secondary neon-btn-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Import Data
                </button>
              </div>
            </div>
          )}

          {/* No search results */}
          {filteredProjects.length === 0 && search && (
            <div className="py-12 text-center">
              <Search className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
              <p className="text-[13px] text-[var(--text-secondary)]">
                No projects match &quot;{search}&quot;
              </p>
            </div>
          )}
        </>
      )}

      {/* Create Project Dialog */}
      <CreateProjectDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(project) => {
          fetchProjects();
          router.push(`/projects/${project.id}/dashboard`);
        }}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="neon-modal-overlay"
          onClick={() => setDeleteConfirm(null)}
        >
          <div className="neon-modal" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[var(--status-error-bg)] flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-[var(--status-error)]" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold">Delete Project</h3>
                  <p className="text-[12px] text-[var(--text-tertiary)]">
                    This action is irreversible
                  </p>
                </div>
              </div>
              <p className="text-[13px] text-[var(--text-secondary)] mb-6">
                Are you sure you want to delete project{" "}
                <code className="font-mono bg-[var(--bg-inset)] px-1.5 py-0.5 rounded border border-[var(--border-default)]">
                  {deleteConfirm.name}
                </code>
                ? All branches, databases, and data will be permanently lost.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="neon-btn neon-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="neon-btn neon-btn-danger"
                >
                  {deleting ? "Deleting..." : "Delete Project"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
