"use client";

import { useState } from "react";
import { Settings, Server, Database, Globe, Shield, Save, Check, AlertTriangle } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState({
    storageControllerUrl: "http://localhost:1234",
    pageserverUrl: "http://localhost:9898",
    endpointStorageUrl: "http://localhost:9993",
    postgresHost: "localhost",
    postgresPort: "5432",
    postgresUser: "neondb_owner",
    postgresDatabase: "neondb",
    minioEndpoint: "localhost",
    minioPort: "9000",
    minioBucket: "neon-data",
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="animate-page-enter max-w-[800px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Settings</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
            Configure your platform connection and preferences
          </p>
        </div>
        <button onClick={handleSave} className="neon-btn neon-btn-primary">
          {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Save success banner */}
      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--status-active-bg)] border border-green-200 text-[var(--status-active)] text-[13px] flex items-center gap-2 animate-card-enter">
          <Check className="w-4 h-4" />
          Settings saved successfully. Restart the server for changes to take effect.
        </div>
      )}

      <div className="space-y-5">
        {/* Storage Controller */}
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)]">
            <h3 className="text-[14px] font-semibold flex items-center gap-2">
              <Server className="w-4 h-4 text-[var(--neon-green)]" />
              Storage Controller
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <Field label="Controller URL" value={config.storageControllerUrl} onChange={(v) => setConfig({ ...config, storageControllerUrl: v })} />
            <Field label="Pageserver URL" value={config.pageserverUrl} onChange={(v) => setConfig({ ...config, pageserverUrl: v })} />
            <Field label="Endpoint Storage URL" value={config.endpointStorageUrl} onChange={(v) => setConfig({ ...config, endpointStorageUrl: v })} />
          </div>
        </div>

        {/* PostgreSQL */}
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)]">
            <h3 className="text-[14px] font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--neon-green)]" />
              PostgreSQL
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Host" value={config.postgresHost} onChange={(v) => setConfig({ ...config, postgresHost: v })} />
              <Field label="Port" value={config.postgresPort} onChange={(v) => setConfig({ ...config, postgresPort: v })} />
              <Field label="User" value={config.postgresUser} onChange={(v) => setConfig({ ...config, postgresUser: v })} />
              <Field label="Database" value={config.postgresDatabase} onChange={(v) => setConfig({ ...config, postgresDatabase: v })} />
            </div>
          </div>
        </div>

        {/* MinIO */}
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)]">
            <h3 className="text-[14px] font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--neon-green)]" />
              Object Storage (MinIO)
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Endpoint" value={config.minioEndpoint} onChange={(v) => setConfig({ ...config, minioEndpoint: v })} />
              <Field label="Port" value={config.minioPort} onChange={(v) => setConfig({ ...config, minioPort: v })} />
              <div className="col-span-2">
                <Field label="Bucket" value={config.minioBucket} onChange={(v) => setConfig({ ...config, minioBucket: v })} />
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="neon-card">
          <div className="px-5 py-3 border-b border-[var(--border-default)]">
            <h3 className="text-[14px] font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--neon-green)]" />
              About
            </h3>
          </div>
          <div className="p-5 space-y-3">
            <InfoRow label="Platform Version" value="0.1.0" />
            <InfoRow label="SDK Version" value="0.1.0" />
            <InfoRow label="Runtime" value="Next.js 16 + React 19" />
            <InfoRow label="Host OS" value="Ubuntu 24.04 LTS" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="neon-input font-mono text-[13px]"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
      <span className="text-[13px] font-mono text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
