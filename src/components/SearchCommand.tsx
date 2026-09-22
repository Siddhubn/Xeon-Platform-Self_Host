"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Database,
  GitBranch,
  HardDrive,
  Users,
  Server,
  Code2,
  Table,
  Shield,
  User,
  BookOpen,
  Settings,
  ArrowRight,
  X,
  Loader2,
  FileText,
  CornerDownLeft,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "project" | "branch" | "database" | "role" | "page" | "setting";
  icon: string;
  url: string;
  meta?: string;
}

// ---------------------------------------------------------------------------
// Icon mapper
// ---------------------------------------------------------------------------

function getCategoryIcon(category: string, className = "w-4 h-4") {
  const icons: Record<string, React.ReactNode> = {
    database: <Database className={className} />,
    "git-branch": <GitBranch className={className} />,
    "hard-drive": <HardDrive className={className} />,
    users: <Users className={className} />,
    server: <Server className={className} />,
    code: <Code2 className={className} />,
    table: <Table className={className} />,
    shield: <Shield className={className} />,
    user: <User className={className} />,
    book: <BookOpen className={className} />,
    settings: <Settings className={className} />,
  };
  return icons[category] || <FileText className={className} />;
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    project: "var(--accent)",
    branch: "#10b981",
    database: "#8b5cf6",
    role: "#f59e0b",
    page: "var(--text-secondary)",
    setting: "var(--text-tertiary)",
  };
  return colors[category] || "var(--text-secondary)";
}

const categoryLabels: Record<string, string> = {
  page: "Pages",
  project: "Projects",
  branch: "Branches",
  database: "Databases",
  role: "Roles",
  setting: "Settings",
};

// ---------------------------------------------------------------------------
// Quick actions (always shown when search is empty)
// ---------------------------------------------------------------------------

const quickActions: SearchResult[] = [
  {
    id: "qa-new-project",
    title: "Create New Project",
    subtitle: "Set up a new database project",
    category: "project",
    icon: "database",
    url: "/projects",
  },
  {
    id: "qa-sql",
    title: "Open SQL Editor",
    subtitle: "Write and run SQL queries",
    category: "page",
    icon: "code",
    url: "/sql-editor",
  },
  {
    id: "qa-data",
    title: "Browse Data",
    subtitle: "Explore your database tables",
    category: "page",
    icon: "table",
    url: "/data",
  },
  {
    id: "qa-backup",
    title: "Create a Backup",
    subtitle: "Protect your database data",
    category: "page",
    icon: "shield",
    url: "/backups",
  },
  {
    id: "qa-account",
    title: "Account Settings",
    subtitle: "Manage your profile and preferences",
    category: "setting",
    icon: "user",
    url: "/account",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SearchCommand({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Keyboard shortcut to open ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
      // "/" when not in an input
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange]);

  // ── Focus input when opened ──
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Search when query changes ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setSelectedIdx(0);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ── Navigate to result ──
  const navigateTo = useCallback(
    (result: SearchResult) => {
      onOpenChange(false);
      setQuery("");
      router.push(result.url);
    },
    [router, onOpenChange]);

  // ── Keyboard navigation ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = query.trim() ? results : quickActions;
    if (items.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((prev) => (prev - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[selectedIdx]) {
        navigateTo(items[selectedIdx]);
      }
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  // ── Scroll selected into view ──
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIdx] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIdx]);

  // ── Group results by category ──
  const groupedResults = (() => {
    if (!query.trim()) return null;
    const groups: Record<string, SearchResult[]> = {};
    for (const r of results) {
      const label = categoryLabels[r.category] || r.category;
      if (!groups[label]) groups[label] = [];
      groups[label].push(r);
    }
    return groups;
  })();

  const displayItems = query.trim() ? results : quickActions;
  let globalIdx = -1;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      {/* Backdrop — heavy blur over entire viewport */}
      <div
        className="fixed inset-0 animate-fade-in"
        style={{
          background: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-[560px] mx-4 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-default)] shadow-2xl overflow-hidden animate-modal-enter">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-default)]">
          <Search
            className="w-5 h-5 flex-shrink-0"
            style={{ color: loading ? "var(--accent)" : "var(--text-tertiary)" }}
          />
          {loading && (
            <Loader2
              className="w-4 h-4 animate-spin flex-shrink-0"
              style={{ color: "var(--accent)" }}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, branches, databases, pages..."
            className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--text-tertiary)]" />
            </button>
          )}
          <kbd className="text-[10px] bg-[var(--bg-inset)] border border-[var(--border-default)] rounded px-1.5 py-0.5 font-mono text-[var(--text-tertiary)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[360px] overflow-y-auto py-2"
          style={{ scrollbarWidth: "thin" }}
        >
          {query.trim() && results.length === 0 && !loading && (
            <div className="px-5 py-10 text-center">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-[13px] text-[var(--text-secondary)]">
                No results found for &quot;{query}&quot;
              </p>
              <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                Try searching for a project, branch, or page name
              </p>
            </div>
          )}

          {/* Quick actions (when empty) */}
          {!query.trim() && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                  Quick Actions
                </span>
              </div>
              {quickActions.map((item) => {
                globalIdx++;
                const idx = globalIdx;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selectedIdx === idx
                        ? "bg-[var(--bg-hover)]"
                        : "hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${getCategoryColor(item.category)}15` }}
                    >
                      {getCategoryIcon(item.icon, "w-4 h-4")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {item.subtitle}
                      </p>
                    </div>
                    <ArrowRight
                      className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--text-tertiary)" }}
                    />
                  </button>
                );
              })}
            </>
          )}

          {/* Grouped search results */}
          {query.trim() && groupedResults && (
            <>
              {Object.entries(groupedResults).map(([label, items]) => (
                <div key={label}>
                  <div className="px-4 py-1.5">
                    <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                      {label}
                    </span>
                  </div>
                  {items.map((item) => {
                    globalIdx++;
                    const idx = globalIdx;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateTo(item)}
                        onMouseEnter={() => setSelectedIdx(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          selectedIdx === idx
                            ? "bg-[var(--bg-hover)]"
                            : "hover:bg-[var(--bg-hover)]"
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: `${getCategoryColor(item.category)}15`,
                            color: getCategoryColor(item.category),
                          }}
                        >
                          {getCategoryIcon(item.icon, "w-4 h-4")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                              {item.title}
                            </p>
                            {item.meta && (
                              <span
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase"
                                style={{
                                  background: `${getCategoryColor(item.category)}15`,
                                  color: getCategoryColor(item.category),
                                }}
                              >
                                {item.meta}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                            {item.subtitle}
                          </p>
                        </div>
                        <ArrowRight
                          className="w-3.5 h-3.5 flex-shrink-0"
                          style={{ color: "var(--text-tertiary)", opacity: selectedIdx === idx ? 0.6 : 0 }}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-t border-[var(--border-default)] bg-[var(--bg-surface-secondary)]">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <kbd className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded px-1 py-0.5 font-mono text-[9px]">
              ↑↓
            </kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <CornerDownLeft className="w-3 h-3" />
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)]">
            <kbd className="bg-[var(--bg-inset)] border border-[var(--border-default)] rounded px-1 py-0.5 font-mono text-[9px]">
              ESC
            </kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
