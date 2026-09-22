"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import GlobalSidebar from "@/components/GlobalSidebar";
import Topbar from "@/components/Topbar";
import SearchCommand from "@/components/SearchCommand";
import { LayoutSkeleton } from "@/components/Skeleton";
import { OrgProvider } from "@/lib/org-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && mounted && !user) {
      router.push("/login");
    }
  }, [loading, mounted, user, router]);

  if (loading || !mounted) {
    return <LayoutSkeleton />;
  }

  if (!user) return null;

  const isProjectRoute = pathname.startsWith("/projects/");

  return (
    <OrgProvider>
      <div className="flex h-screen overflow-hidden">
        {isProjectRoute ? null : <GlobalSidebar />}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!isProjectRoute && <Topbar onSearchOpen={() => setSearchOpen(true)} />}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </OrgProvider>
  );
}
