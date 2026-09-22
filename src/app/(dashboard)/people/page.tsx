"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Shield,
  Mail,
  RefreshCw,
  Search,
  ExternalLink,
} from "lucide-react";
import { useOrganization } from "@/lib/org-context";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function PeoplePage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchMembers = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizations/${organization.id}/members`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-page-enter max-w-[1000px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">People</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Members of {organization?.name || "your organisation"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchMembers} className="neon-btn neon-btn-ghost neon-btn-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin-slow" : ""}`} />
          </button>
          <button
            onClick={() => router.push("/admin/users")}
            className="neon-btn neon-btn-primary neon-btn-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Manage Users
          </button>
        </div>
      </div>

      <div className="search-input-wrapper mb-4">
        <Search className="search-input-icon" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          className="search-input"
        />
      </div>

      <div className="neon-card overflow-hidden">
        <table className="neon-table">
          <thead>
            <tr>
              <th>MEMBER</th>
              <th>ROLE</th>
              <th>JOINED</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="text-center py-12">
                  <div className="w-6 h-6 border-2 border-[var(--neon-green)] border-t-transparent rounded-full animate-spin-slow mx-auto" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12">
                  <Users className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    {search ? "No people match your search" : "No members found"}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--neon-green-bg)] flex items-center justify-center">
                        <span className="text-[12px] font-bold text-[var(--neon-green)]">
                          {member.name[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-[13px] font-medium">{member.name}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)]">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="neon-badge neon-badge-blue capitalize">{member.role}</span>
                  </td>
                  <td className="text-[12px] text-[var(--text-secondary)]">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
