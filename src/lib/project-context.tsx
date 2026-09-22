"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useParams } from "next/navigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProjectInfo {
  id: string;
  name: string;
  internalTenantId: string;
  createdAt: string;
  branchCount?: number;
  databaseCount?: number;
  computeCount?: number;
  replicaCount?: number;
}

export interface BranchInfo {
  id: string;
  name: string;
  isPrimary: boolean;
  internalTimelineId: string;
}

interface ProjectContextValue {
  project: ProjectInfo | null;
  projectId: string | null;
  loading: boolean;
  error: string | null;
  refreshProject: () => Promise<void>;
  // Branch selection
  branches: BranchInfo[];
  branchesLoading: boolean;
  selectedBranchId: string | null;
  selectedBranch: BranchInfo | null;
  selectBranch: (branchId: string) => void;
  refreshBranches: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue>({
  project: null,
  projectId: null,
  loading: true,
  error: null,
  refreshProject: async () => {},
  branches: [],
  branchesLoading: false,
  selectedBranchId: null,
  selectedBranch: null,
  selectBranch: () => {},
  refreshBranches: async () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ProjectProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const projectId = (params?.projectId as string) || null;
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Branch state
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        setProject(null);
      } else {
        setProject(data.project);
      }
    } catch {
      setError("Failed to load project");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchBranches = useCallback(async () => {
    if (!projectId) {
      setBranches([]);
      return;
    }
    setBranchesLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/branches`);
      const data = await res.json();
      const branchList = data.branches || [];
      setBranches(branchList);
      // Auto-select first branch if none selected or current selection no longer valid
      if (branchList.length > 0) {
        setSelectedBranchId((prev) => {
          if (prev && branchList.find((b: BranchInfo) => b.id === prev)) return prev;
          return branchList[0].id;
        });
      } else {
        setSelectedBranchId(null);
      }
    } catch {
      setBranches([]);
    } finally {
      setBranchesLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
    fetchBranches();
    // Reset branch selection when project changes
    setSelectedBranchId(null);
  }, [fetchProject, fetchBranches]);

  const selectBranch = useCallback((branchId: string) => {
    setSelectedBranchId(branchId);
  }, []);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || null;

  return (
    <ProjectContext.Provider
      value={{
        project,
        projectId,
        loading,
        error,
        refreshProject: fetchProject,
        branches,
        branchesLoading,
        selectedBranchId,
        selectedBranch,
        selectBranch,
        refreshBranches: fetchBranches,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProject() {
  return useContext(ProjectContext);
}
