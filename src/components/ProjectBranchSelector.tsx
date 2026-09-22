"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, GitBranch } from "lucide-react";
import { SkeletonBlock } from "@/components/Skeleton";
import CustomSelect from "@/components/CustomSelect";

interface ProjectOption {
  id: string;
  name: string;
  internalTenantId: string;
}

interface BranchOption {
  id: string;
  name: string;
  isPrimary: boolean;
  internalTimelineId: string;
}

interface ProjectBranchSelectorProps {
  onSelectionChange: (projectId: string, branchId: string) => void;
  defaultProjectId?: string;
  defaultBranchId?: string;
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

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

  return { projects, loading, refresh: fetchProjects };
}

export function useBranches(projectId: string | null) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBranches = useCallback(async () => {
    if (!projectId) {
      setBranches([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/branches`);
      const data = await res.json();
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  return { branches, loading, refresh: fetchBranches };
}

export default function ProjectBranchSelector({
  onSelectionChange,
  defaultProjectId,
  defaultBranchId,
}: ProjectBranchSelectorProps) {
  const { projects, loading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    defaultProjectId || null
  );
  const { branches, loading: branchesLoading } = useBranches(selectedProjectId);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    defaultBranchId || null
  );

  // Auto-select first project
  useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // Auto-select first branch
  useEffect(() => {
    if (selectedProjectId && !selectedBranchId && branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
  }, [selectedProjectId, branches, selectedBranchId]);

  // Notify parent of selection changes
  useEffect(() => {
    if (selectedProjectId && selectedBranchId) {
      onSelectionChange(selectedProjectId, selectedBranchId);
    }
  }, [selectedProjectId, selectedBranchId, onSelectionChange]);

  if (projectsLoading) {
    return (
      <div className="flex items-center gap-4">
        <SkeletonBlock className="rounded-lg" style={{ height: 38, width: 200 }} />
        <SkeletonBlock className="rounded-lg" style={{ height: 38, width: 160 }} />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="neon-card p-4">
        <p className="text-[13px] text-[var(--text-secondary)] text-center">
          No projects found.{" "}
          <a href="/projects" className="text-[var(--text-link)] hover:underline">
            Create a project first
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Project selector */}
      <CustomSelect
        value={selectedProjectId || ""}
        options={projects.map((p) => ({
          value: p.id,
          label: p.name,
          icon: <Database className="w-3.5 h-3.5 text-[var(--neon-green)]" />,
        }))}
        onChange={(val) => {
          setSelectedProjectId(val);
          setSelectedBranchId(null);
        }}
        placeholder="Select project"
        searchable
        className="w-[260px]"
      />

      {/* Branch selector */}
      {selectedProjectId && (
        branchesLoading ? (
          <div className="w-[200px]">
            <SkeletonBlock className="rounded-lg" style={{ height: 38, width: 200 }} />
          </div>
        ) : (
          <CustomSelect
            value={selectedBranchId || ""}
            options={branches.map((b) => ({
              value: b.id,
              label: `${b.name}${b.isPrimary ? " (main)" : ""}`,
              icon: <GitBranch className="w-3.5 h-3.5 text-[var(--neon-green)]" />,
            }))}
            onChange={(val) => setSelectedBranchId(val)}
            placeholder="Select branch"
            searchable
            className="w-[220px]"
          />
        )
      )}
    </div>
  );
}
