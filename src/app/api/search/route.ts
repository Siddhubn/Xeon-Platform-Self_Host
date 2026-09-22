import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers/self-hosted-neon-provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "project" | "branch" | "page" | "setting";
  icon: string;
  url: string;
  meta?: string;
}

// ---------------------------------------------------------------------------
// Static navigation pages
// ---------------------------------------------------------------------------

const staticPages: SearchResult[] = [
  {
    id: "page-projects",
    title: "Projects",
    subtitle: "Manage your database projects",
    category: "page",
    icon: "database",
    url: "/projects",
  },
  {
    id: "page-branches",
    title: "Branches",
    subtitle: "Manage database branches",
    category: "page",
    icon: "git-branch",
    url: "/branches",
  },
  {
    id: "page-databases",
    title: "Databases",
    subtitle: "Manage PostgreSQL databases",
    category: "page",
    icon: "hard-drive",
    url: "/databases",
  },
  {
    id: "page-roles",
    title: "Roles",
    subtitle: "Manage PostgreSQL roles",
    category: "page",
    icon: "users",
    url: "/roles",
  },
  {
    id: "page-compute",
    title: "Compute Endpoints",
    subtitle: "Manage compute instances",
    category: "page",
    icon: "server",
    url: "/compute",
  },
  {
    id: "page-sql",
    title: "SQL Editor",
    subtitle: "Write and execute SQL queries",
    category: "page",
    icon: "code",
    url: "/sql-editor",
  },
  {
    id: "page-data",
    title: "Data Browser",
    subtitle: "Browse and manage table data",
    category: "page",
    icon: "table",
    url: "/data",
  },
  {
    id: "page-backups",
    title: "Backup & Restore",
    subtitle: "Create and manage database backups",
    category: "page",
    icon: "shield",
    url: "/backups",
  },
  {
    id: "page-nodes",
    title: "Nodes",
    subtitle: "Pageserver nodes",
    category: "page",
    icon: "server",
    url: "/nodes",
  },
  {
    id: "page-account",
    title: "Account Settings",
    subtitle: "Manage your profile and preferences",
    category: "setting",
    icon: "user",
    url: "/account",
  },
  {
    id: "page-docs",
    title: "Documentation",
    subtitle: "Platform documentation and guides",
    category: "page",
    icon: "book",
    url: "/docs",
  },
];

// ---------------------------------------------------------------------------
// GET /api/search?q=...
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() || "";

    if (query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    const ql = query.toLowerCase();
    const results: SearchResult[] = [];

    // ── Search pages (static, instant) ──
    const matchingPages = staticPages.filter(
      (p) =>
        p.title.toLowerCase().includes(ql) ||
        p.subtitle.toLowerCase().includes(ql)
    );
    results.push(...matchingPages);

    // ── Search projects and branches via provider ──
    try {
      const provider = getProvider();
      const projects = await provider.projects.list();

      for (const proj of projects) {
        const nameMatch =
          proj.name?.toLowerCase().includes(ql) ||
          proj.id?.toLowerCase().includes(ql);

        if (nameMatch) {
          results.push({
            id: `project-${proj.id}`,
            title: proj.name || proj.id,
            subtitle: `Project · ${proj.branchCount ?? "?"} branch${(proj.branchCount ?? 0) === 1 ? "" : "es"}`,
            category: "project",
            icon: "database",
            url: `/projects/${proj.id}`,
            meta: "Project",
          });
        }

        // Search branches within each project
        try {
          const branches = await provider.branches.list(proj.id);
          for (const branch of branches) {
            if (
              branch.name?.toLowerCase().includes(ql) ||
              branch.id?.toLowerCase().includes(ql)
            ) {
              results.push({
                id: `branch-${branch.id}`,
                title: branch.name || branch.id,
                subtitle: `${proj.name} / ${branch.name}`,
                category: "branch",
                icon: "git-branch",
                url: `/projects/${proj.id}`,
                meta: branch.isPrimary ? "Primary" : undefined,
              });
            }
          }
        } catch {}
      }
    } catch {}

    // ── Deduplicate ──
    const seen = new Set<string>();
    const deduped = results.filter((r) => {
      const key = `${r.category}-${r.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── Sort: pages first, then projects, then branches ──
    const categoryOrder: Record<string, number> = {
      page: 0,
      project: 1,
      branch: 2,
      setting: 3,
    };

    deduped.sort(
      (a, b) =>
        (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99)
    );

    return NextResponse.json({ results: deduped.slice(0, 25) });
  } catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", results: [] },
      { status: 500 }
    );
  }
}
