"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import Cookies from "js-cookie";

export type UserRole = "admin" | "developer" | "readonly";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    "projects:read",
    "projects:write",
    "projects:delete",
    "branches:read",
    "branches:write",
    "branches:delete",
    "computes:read",
    "computes:write",
    "computes:start",
    "computes:stop",
    "databases:read",
    "databases:write",
    "databases:delete",
    "roles:read",
    "roles:write",
    "roles:delete",
    "sql:execute",
    "settings:read",
    "settings:write",
    "infrastructure:read",
    "users:read",
    "users:write",
  ],
  developer: [
    "projects:read",
    "branches:read",
    "branches:write",
    "computes:read",
    "databases:read",
    "databases:write",
    "roles:read",
    "roles:write",
    "sql:execute",
    "settings:read",
  ],
  readonly: [
    "projects:read",
    "branches:read",
    "computes:read",
    "databases:read",
    "roles:read",
    "settings:read",
  ],
};

// Demo users for development
const DEMO_USERS: Record<string, { password: string; user: User }> = {
  "admin@neon.io": {
    password: "neon",
    user: { id: "1", name: "Admin", email: "admin@neon.io", role: "admin" },
  },
  "dev@neon.io": {
    password: "neon",
    user: { id: "2", name: "Developer", email: "dev@neon.io", role: "developer" },
  },
  "readonly@neon.io": {
    password: "neon",
    user: { id: "3", name: "Viewer", email: "readonly@neon.io", role: "readonly" },
  },
};

const SESSION_COOKIE = "neon_session";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session cookie
    const session = Cookies.get(SESSION_COOKIE);
    if (session) {
      try {
        const parsed = JSON.parse(session) as User;
        setUser(parsed);
      } catch {
        Cookies.remove(SESSION_COOKIE);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Validate against demo users
    const entry = DEMO_USERS[email];
    if (entry && entry.password === password) {
      const sessionUser = entry.user;
      setUser(sessionUser);
      Cookies.set(SESSION_COOKIE, JSON.stringify(sessionUser), {
        expires: 7,
        sameSite: "lax",
      });
      return true;
    }

    // Try API-based auth (for production)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const data = await res.json();
        const sessionUser = data.user as User;
        setUser(sessionUser);
        Cookies.set(SESSION_COOKIE, JSON.stringify(sessionUser), {
          expires: 7,
          sameSite: "lax",
        });
        return true;
      }
    } catch {
      // Fall through to failure
    }

    return false;
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    Cookies.remove(SESSION_COOKIE);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;
      return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
