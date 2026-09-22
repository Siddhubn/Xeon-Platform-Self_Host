"use client";

import { useState, useEffect, useCallback } from "react";
import { Server, RefreshCw, Activity, Wifi, WifiOff } from "lucide-react";
import { ComputeSkeleton } from "@/components/Skeleton";

interface Node {
  id: number;
  availability: string;
  scheduling: string;
  listenHttpAddr: string;
  listenHttpPort: number;
  listenPgAddr: string;
  listenPgPort: number;
  primaryShardCount: number;
  secondaryShardCount: number;
  availabilityZoneId: string;
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/nodes");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNodes(data.nodes || []);
      }
    } catch {
      setError("Failed to fetch nodes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const availabilityColor = (a: string) => {
    switch (a) {
      case "Active": return "neon-badge-green";
      case "WarmingUp": return "neon-badge-yellow";
      case "Offline": return "neon-badge-red";
      default: return "neon-badge-gray";
    }
  };

  return (
    <div className="animate-page-enter max-w-[1200px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Nodes</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Pageserver infrastructure nodes and their status
          </p>
        </div>
        <button onClick={fetchNodes} disabled={loading} className="neon-btn neon-btn-ghost neon-btn-sm">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin-slow" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-[var(--status-error-bg)] border border-red-200 text-[var(--status-error)] text-[13px]">
          {error}
        </div>
      )}

      {loading && nodes.length === 0 ? (
        <ComputeSkeleton />
      ) : nodes.length === 0 ? (
        <div className="neon-card p-16 text-center">
          <Server className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
          <h3 className="text-[16px] font-semibold mb-1">No nodes found</h3>
          <p className="text-[13px] text-[var(--text-secondary)] max-w-sm mx-auto">
            Pageserver nodes will appear here once they are registered with the Storage Controller.
          </p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {nodes.map((node) => (
            <div key={node.id} className="neon-card">
              <div className="px-5 py-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-inset)] flex items-center justify-center">
                    <Server className="w-5 h-5 text-[var(--text-secondary)]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">Node {node.id}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[12px] text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1">
                        <Wifi className="w-3 h-3" />
                        {node.listenHttpAddr}:{node.listenHttpPort}
                      </span>
                      <span className="flex items-center gap-1">
                        PG: {node.listenPgAddr}:{node.listenPgPort}
                      </span>
                      {node.availabilityZoneId && (
                        <span>AZ: {node.availabilityZoneId}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`neon-badge ${availabilityColor(node.availability)}`}>
                    <span className={`neon-status-dot ${
                      node.availability === "Active" ? "neon-status-dot-active" : 
                      node.availability === "Offline" ? "neon-status-dot-error" : "neon-status-dot-idle"
                    } w-1.5 h-1.5`} />
                    {node.availability}
                  </span>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-[var(--border-default)] flex items-center gap-6 text-[12px] text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3 h-3" />
                  Scheduling: {node.scheduling}
                </span>
                <span>Primary shards: {node.primaryShardCount}</span>
                <span>Secondary shards: {node.secondaryShardCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
