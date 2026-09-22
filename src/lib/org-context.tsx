"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  userRole: string;
  membershipId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

interface OrgContextValue {
  organization: Organization | null;
  organizations: Organization[];
  loading: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  isOwner: boolean;
  isAdmin: boolean;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveOrg = useCallback(async () => {
    try {
      const res = await fetch("/api/account/active-organization");
      if (res.ok) {
        const data = await res.json();
        setOrganization(data.organization);
        setOrganizations(data.organizations || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveOrg();
  }, [fetchActiveOrg]);

  const switchOrganization = useCallback(
    async (orgId: string) => {
      try {
        const res = await fetch("/api/account/active-organization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: orgId }),
        });
        if (res.ok) {
          await fetchActiveOrg();
        }
      } catch {
        // ignore
      }
    },
    [fetchActiveOrg]
  );

  const refreshOrganizations = useCallback(async () => {
    await fetchActiveOrg();
  }, [fetchActiveOrg]);

  const isOwner = organization?.userRole === "owner";
  const isAdmin = ["owner", "admin"].includes(organization?.userRole || "");

  return (
    <OrgContext.Provider
      value={{
        organization,
        organizations,
        loading,
        switchOrganization,
        refreshOrganizations,
        isOwner,
        isAdmin,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrganization(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrganization must be used within an OrgProvider");
  return ctx;
}
