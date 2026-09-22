"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Database, Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await login(email, password);
    if (success) {
      router.push("/projects");
    } else {
      setError("Invalid email or password. Try \"admin@neon.io\" / \"neon\"");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-surface-secondary)" }}>
      {/* Left panel — Branding / Hero */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between" style={{ background: "var(--sidebar-bg)" }}>
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glow orbs */}
        <div className="absolute top-[15%] left-[20%] w-[400px] h-[400px] rounded-full bg-[var(--neon-green)] opacity-[0.04] blur-[100px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[300px] h-[300px] rounded-full bg-[#3b82f6] opacity-[0.03] blur-[80px]" />

        {/* Content */}
        <div className="relative z-10 px-16 py-12 flex flex-col flex-1">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--neon-green)" }}>
              <Database className="w-5 h-5" style={{ color: "var(--accent-foreground)" }} strokeWidth={2.5} />
            </div>
            <span className="text-[18px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              neon
            </span>
          </div>

          {/* Hero */}
          <div className="my-auto max-w-md">
            <h1 className="text-[42px] font-bold leading-[1.1] tracking-tight mb-5" style={{ color: "var(--text-primary)" }}>
              The database
              <br />
              built for the
              <br />
              <span style={{ color: "var(--neon-green)" }}>AI&nbsp;era.</span>
            </h1>
            <p className="text-[16px] leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
              Serverless Postgres with branching, autoscaling, and a fully
              featured web console. Manage your self-hosted Neon platform with
              confidence.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: "🌳", label: "Branching", desc: "Copy-on-write clones" },
                { icon: "⚡", label: "Autoscaling", desc: "Scale to zero" },
                { icon: "🔗", label: "Connection Pooling", desc: "PgBouncer built-in" },
                { icon: "📊", label: "Monitoring", desc: "Real-time metrics" },
                { icon: "🛡️", label: "Roles & Databases", desc: "Full PG management" },
                { icon: "🖥️", label: "SQL Editor", desc: "Browser-based queries" },
              ].map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-start gap-3 p-3 rounded-lg" style={{ border: "1px solid var(--border-default)", background: "var(--bg-hover)" }}
                >
                  <span className="text-lg">{feature.icon}</span>
                  <div>
                    <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>
                      {feature.label}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer info */}
          <div className="flex items-center justify-between pt-8" style={{ borderTop: "1px solid var(--border-default)" }}>
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              Self-hosted on Ubuntu 24.04 LTS
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              Powered by neon-platform-sdk
            </span>
          </div>
        </div>
      </div>

      {/* Right panel — Login Form */}
      <div className="flex-1 flex items-center justify-center px-12 py-12">
        <div className="w-full max-w-[380px] animate-page-enter">
          {/* Mobile logo */}            <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-[var(--neon-green)] flex items-center justify-center">
              <Database className="w-5 h-5" style={{ color: "var(--accent-foreground)" }} strokeWidth={2.5} />
            </div>
            <span className="text-[18px] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>neon</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-[24px] font-bold text-[var(--text-primary)] tracking-tight mb-1.5">
              Welcome back
            </h2>
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
              Sign in to your Neon Platform Console
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3 rounded-lg text-[13px] animate-card-enter flex items-start gap-3" style={{ background: "var(--status-error-bg)", border: "1px solid var(--status-error)", color: "var(--text-primary)", opacity: 0.9 }}>
              <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "var(--status-error)" }}>
                <span className="text-[10px] font-bold" style={{ color: "var(--text-inverse)" }}>!</span>
              </div>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-[13px] font-medium text-[var(--text-primary)] mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="neon-input"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-[13px] font-medium text-[var(--text-primary)]"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-[12px] text-[var(--text-link)] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="neon-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="neon-btn neon-btn-primary w-full h-[42px] text-[14px]"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin-slow" style={{ color: "var(--accent-foreground)" }} />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-[var(--border-default)]" />
            <span className="text-[11px] text-[var(--text-tertiary)] font-medium uppercase tracking-wider">
              or
            </span>
            <div className="flex-1 h-px bg-[var(--border-default)]" />
          </div>

          {/* Social login placeholder */}
          <button className="neon-btn neon-btn-secondary w-full h-[42px]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            Continue with GitHub
          </button>

          {/* Sign up link */}
          <p className="mt-8 text-center text-[13px] text-[var(--text-secondary)]">
            Don&apos;t have an account?{" "}
            <a
              href="#"
              className="text-[var(--text-link)] font-medium hover:underline"
            >
              Sign up
            </a>
          </p>

          {/* Demo hint */}
          <div className="mt-5 p-3 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-default)]">
            <p className="text-[11px] text-[var(--text-secondary)] text-center">
              Demo credentials:{" "}
              <code className="font-mono text-[11px] px-1 py-0.5 rounded border border-[var(--border-default)]" style={{ background: "var(--bg-inset)" }}>
                admin@neon.io
              </code>{" "}
              /{" "}
              <code className="font-mono text-[11px] px-1 py-0.5 rounded border border-[var(--border-default)]" style={{ background: "var(--bg-inset)" }}>
                neon
              </code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
