"use client";

import React from "react";

// ---------------------------------------------------------------------------
// Base skeleton primitives
// ---------------------------------------------------------------------------

export function SkeletonBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton-block rounded-md ${className}`}
      style={style}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
  lineHeight = 12,
  gap = 8,
}: {
  lines?: number;
  className?: string;
  lineHeight?: number;
  gap?: number;
}) {
  return (
    <div className={`space-y-[${gap}px]`} style={{ gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={className}
          style={{
            height: lineHeight,
            width: i === lines - 1 ? "60%" : "100%",
          }}
        />
      ))}
    </div>
  );
}

export function SkeletonCircle({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-block rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

export function SkeletonTable({
  rows = 5,
  columns = 4,
  columnWidths,
}: {
  rows?: number;
  columns?: number;
  columnWidths?: number[];
}) {
  const defaultWidths = Array.from({ length: columns }).map(
    (_, i) => (columnWidths?.[i] ?? 80 + ((i * 17 + 7) % 40))
  );

  return (
    <div className="skeleton-block rounded-xl overflow-hidden" style={{ minHeight: 200 }}>
      {/* Table header */}
      <div
        className="flex items-center gap-4 px-5 py-3 border-b"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-surface-secondary)" }}
      >
        {defaultWidths.map((w, i) => (
          <div
            key={i}
            className="skeleton-block rounded"
            style={{ height: 10, width: w * 0.6, opacity: 0.4 }}
          />
        ))}
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 px-5 py-3.5 border-b"
          style={{
            borderColor: "var(--border-default)",
            animationDelay: `${rowIdx * 60}ms`,
          }}
        >
          {defaultWidths.map((w, colIdx) => (
            <div
              key={colIdx}
              className="skeleton-block rounded"
              style={{
                height: colIdx === 0 ? 14 : 10,
                width: w,
                opacity: colIdx === 0 ? 0.55 : 0.35,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card skeleton
// ---------------------------------------------------------------------------

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-block rounded-xl p-5 ${className}`}
      style={{ minHeight: 120 }}
    >
      <div className="flex items-start gap-3 mb-4">
        <SkeletonCircle size={40} />
        <div className="flex-1 space-y-2">
          <SkeletonBlock style={{ height: 14, width: "45%" }} />
          <SkeletonBlock style={{ height: 10, width: "30%", opacity: 0.35 }} />
        </div>
      </div>
      <SkeletonText lines={2} lineHeight={10} gap={6} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page skeleton — mimics a standard dashboard page layout
// ---------------------------------------------------------------------------

export function SkeletonPage({
  titleWidth = 180,
  showTable = true,
  tableRows = 5,
  tableColumns = 4,
  tableColumnWidths,
  showSearch = true,
  showHeader = true,
}: {
  titleWidth?: number;
  showTable?: boolean;
  tableRows?: number;
  tableColumns?: number;
  tableColumnWidths?: number[];
  showSearch?: boolean;
  showHeader?: boolean;
}) {
  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <SkeletonBlock style={{ height: 22, width: titleWidth }} />
            <SkeletonBlock
              style={{ height: 12, width: titleWidth * 1.4, opacity: 0.35 }}
            />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock
              className="rounded-lg"
              style={{ height: 34, width: 34 }}
            />
            <SkeletonBlock
              className="rounded-lg"
              style={{ height: 34, width: 110 }}
            />
          </div>
        </div>
      )}

      {showSearch && (
        <SkeletonBlock className="rounded-lg" style={{ height: 36 }} />
      )}

      {showTable && (
        <SkeletonTable
          rows={tableRows}
          columns={tableColumns}
          columnWidths={tableColumnWidths}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Specific page skeletons
// ---------------------------------------------------------------------------

export function ProjectsSkeleton({ inline = false }: { inline?: boolean }) {
  if (inline) {
    return (
      <div className="py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b" style={{ borderColor: "var(--border-default)", animationDelay: `${i * 60}ms` }}>
            <SkeletonBlock style={{ height: 14, width: 160, opacity: 0.55 }} />
            <SkeletonBlock style={{ height: 10, width: 60, opacity: 0.35 }} />
            <SkeletonBlock style={{ height: 10, width: 80, opacity: 0.35 }} />
            <div className="ml-auto"><SkeletonBlock style={{ height: 16, width: 16 }} /></div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <SkeletonPage
      titleWidth={140}
      tableColumns={3}
      tableColumnWidths={[180, 80, 100]}
      tableRows={5}
    />
  );
}

export function BranchesSkeleton({ inline = false }: { inline?: boolean }) {
  if (inline) {
    return (
      <div className="py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b" style={{ borderColor: "var(--border-default)", animationDelay: `${i * 60}ms` }}>
            <SkeletonBlock style={{ height: 14, width: 130, opacity: 0.55 }} />
            <SkeletonBadge />
            <SkeletonBlock style={{ height: 10, width: 40, opacity: 0.35 }} />
            <SkeletonBlock style={{ height: 10, width: 80, opacity: 0.35 }} />
            <SkeletonBlock style={{ height: 10, width: 70, opacity: 0.35 }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <SkeletonPage
      titleWidth={120}
      tableColumns={5}
      tableColumnWidths={[140, 70, 60, 100, 100]}
      tableRows={4}
    />
  );
}

export function DatabasesSkeleton({ inline = false }: { inline?: boolean }) {
  if (inline) {
    return (
      <div className="py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b" style={{ borderColor: "var(--border-default)", animationDelay: `${i * 60}ms` }}>
            <SkeletonBlock style={{ height: 14, width: 140, opacity: 0.55 }} />
            <SkeletonBlock style={{ height: 10, width: 90, opacity: 0.35 }} />
            <SkeletonBlock style={{ height: 10, width: 70, opacity: 0.35 }} />
            <div className="ml-auto"><SkeletonBlock style={{ height: 16, width: 16 }} /></div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <SkeletonPage
      titleWidth={140}
      tableColumns={4}
      tableColumnWidths={[160, 100, 100, 60]}
      tableRows={4}
    />
  );
}

export function RolesSkeleton({ inline = false }: { inline?: boolean }) {
  if (inline) {
    return (
      <div className="py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b" style={{ borderColor: "var(--border-default)", animationDelay: `${i * 60}ms` }}>
            <SkeletonBlock style={{ height: 14, width: 120, opacity: 0.55 }} />
            <SkeletonBadge />
            <div className="ml-auto"><SkeletonBlock style={{ height: 16, width: 16 }} /></div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <SkeletonPage
      titleWidth={80}
      tableColumns={3}
      tableColumnWidths={[140, 80, 60]}
      tableRows={4}
    />
  );
}

export function ComputeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock style={{ height: 22, width: 220 }} />
          <SkeletonBlock
            style={{ height: 12, width: 300, opacity: 0.35 }}
          />
        </div>
        <SkeletonBlock
          className="rounded-lg"
          style={{ height: 34, width: 100 }}
        />
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

export function BackupsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock style={{ height: 26, width: 200 }} />
          <SkeletonBlock
            style={{ height: 13, width: 280, opacity: 0.35 }}
          />
        </div>
        <SkeletonBlock
          className="rounded-lg"
          style={{ height: 38, width: 140 }}
        />
      </div>
      <div className="flex gap-3">
        <SkeletonBlock className="rounded-lg" style={{ height: 36, width: 180 }} />
        <SkeletonBlock className="rounded-lg" style={{ height: 36, width: 160 }} />
      </div>
      <SkeletonBlock className="rounded-lg" style={{ height: 36 }} />
      <SkeletonTable
        rows={4}
        columns={5}
        columnWidths={[160, 60, 100, 80, 140]}
      />
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock style={{ height: 22, width: 180 }} />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonBlock
            key={i}
            className="rounded-lg"
            style={{ height: 32, width: 80 + i * 10 }}
          />
        ))}
      </div>
      <div className="neon-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <SkeletonCircle size={72} />
          <div className="space-y-2">
            <SkeletonBlock style={{ height: 14, width: 160 }} />
            <SkeletonBlock
              style={{ height: 10, width: 120, opacity: 0.35 }}
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <SkeletonBlock style={{ height: 10, width: 80 }} />
            <SkeletonBlock className="rounded-lg" style={{ height: 38 }} />
          </div>
          <div className="space-y-1.5">
            <SkeletonBlock style={{ height: 10, width: 100 }} />
            <SkeletonBlock className="rounded-lg" style={{ height: 38 }} />
          </div>
          <div className="space-y-1.5">
            <SkeletonBlock style={{ height: 10, width: 60 }} />
            <SkeletonBlock className="rounded-lg" style={{ height: 38 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DataPageSkeleton() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      {/* Top bar skeleton */}
      <div
        className="flex items-center gap-4 px-4 py-2 border-b"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-1.5">
              <SkeletonBlock style={{ height: 14, width: 14 }} />
              <SkeletonBlock
                className="rounded"
                style={{ height: 12, width: 80 }}
              />
            </div>
            {i < 2 && (
              <div
                className="w-px h-4"
                style={{ background: "var(--border-default)" }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Sidebar skeleton */}
        <div
          className="w-[220px] flex-shrink-0 border-r flex flex-col overflow-hidden"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-surface)",
          }}
        >
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            <SkeletonBlock className="rounded-md" style={{ height: 28 }} />
          </div>
          <div className="flex-1 py-2 space-y-1 px-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <SkeletonBlock style={{ height: 12, width: 12 }} />
                <SkeletonBlock
                  className="rounded"
                  style={{
                    height: 10,
                    width: 60 + ((i * 13 + 5) % 50),
                    opacity: 0.4,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        {/* Main grid skeleton */}
        <div className="flex-1 p-4">
          <SkeletonTable rows={12} columns={5} />
        </div>
      </div>
    </div>
  );
}

export function SqlEditorSkeleton() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
      <div
        className="flex items-center gap-3 px-4 py-2 border-b"
        style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
      >
        <SkeletonBlock className="rounded-lg" style={{ height: 32, width: 70 }} />
        <SkeletonBlock className="rounded-lg" style={{ height: 32, width: 100 }} />
        <div className="flex-1" />
        <SkeletonBlock className="rounded-lg" style={{ height: 32, width: 60 }} />
      </div>
      <div className="flex flex-1 min-h-0">
        {/* Schema sidebar */}
        <div
          className="w-[220px] flex-shrink-0 border-r"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-surface)",
          }}
        >
          <div className="p-2 space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <SkeletonBlock style={{ height: 12, width: 12 }} />
                <SkeletonBlock
                  className="rounded"
                  style={{
                    height: 10,
                    width: 50 + ((i * 11 + 3) % 60),
                    opacity: 0.4,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        {/* Editor area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 space-y-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <SkeletonBlock
                  style={{ height: 10, width: 20, opacity: 0.25 }}
                />
                <SkeletonBlock
                  className="rounded"
                  style={{
                    height: 10,
                    width: 80 + ((i * 23 + 7) % 200),
                    opacity: 0.2,
                  }}
                />
              </div>
            ))}
          </div>
          <div
            className="border-t p-3"
            style={{ borderColor: "var(--border-default)" }}
          >
            <SkeletonBlock className="rounded-lg" style={{ height: 100 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LayoutSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar skeleton */}
      <div
        className="w-[240px] flex-shrink-0 border-r flex flex-col"
        style={{
          borderColor: "var(--border-default)",
          background: "var(--bg-surface-secondary)",
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: "var(--border-default)" }}>
          <div className="flex items-center gap-2.5">
            <SkeletonCircle size={28} />
            <SkeletonBlock style={{ height: 14, width: 100 }} />
          </div>
        </div>
        <div className="flex-1 p-3 space-y-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
              <SkeletonBlock style={{ height: 16, width: 16 }} />
              <SkeletonBlock
                className="rounded"
                style={{
                  height: 11,                   width: 70 + ((i * 19 + 11) % 50),
                  opacity: 0.4,
                }}
              />
            </div>
          ))}
        </div>
      </div>
      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar skeleton */}
        <div
          className="h-14 border-b flex items-center px-6 justify-between"
          style={{
            borderColor: "var(--border-default)",
            background: "var(--bg-surface)",
          }}
        >
          <div className="flex items-center gap-4">
            <SkeletonBlock style={{ height: 14, width: 100 }} />
            <SkeletonBlock
              style={{ height: 14, width: 80, opacity: 0.35 }}
            />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="rounded-lg" style={{ height: 32, width: 32 }} />
            <SkeletonCircle size={32} />
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 p-6 lg:p-8">
          <SkeletonPage tableRows={6} tableColumns={4} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline skeleton helpers
// ---------------------------------------------------------------------------

export function SkeletonBadge() {
  return (
    <SkeletonBlock
      className="rounded-full"
      style={{ height: 20, width: 60 }}
    />
  );
}

export function SkeletonInput() {
  return (
    <div className="space-y-1.5">
      <SkeletonBlock style={{ height: 10, width: 80 }} />
      <SkeletonBlock className="rounded-lg" style={{ height: 38 }} />
    </div>
  );
}

export function SkeletonButton({ width = 100 }: { width?: number }) {
  return (
    <SkeletonBlock className="rounded-lg" style={{ height: 34, width }} />
  );
}
