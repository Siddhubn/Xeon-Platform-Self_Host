/**
 * Shared in-memory password store for demo mode authentication.
 * In production, passwords would be stored in the database with proper hashing.
 */

interface PasswordEntry {
  email: string;
  password: string;
  name?: string;
  role?: string;
}

// The shared store — all modules importing this get the same object
const PASSWORD_STORE: Record<string, PasswordEntry> = {
  "1": { email: "admin@neon.io", password: "neon", name: "Admin", role: "admin" },
  "2": { email: "dev@neon.io", password: "neon", name: "Developer", role: "developer" },
  "3": { email: "readonly@neon.io", password: "neon", name: "Viewer", role: "readonly" },
};

export function registerPassword(
  userId: string,
  email: string,
  password: string,
  name?: string,
  role?: string
) {
  PASSWORD_STORE[userId] = { email, password, name, role };
}

export function verifyPassword(email: string, password: string): { userId: string; entry: PasswordEntry } | null {
  for (const [userId, entry] of Object.entries(PASSWORD_STORE)) {
    if (entry.email === email && entry.password === password) {
      return { userId, entry };
    }
  }
  return null;
}

export function getPasswordEntry(userId: string): PasswordEntry | undefined {
  return PASSWORD_STORE[userId];
}
