/**
 * Server auth API — login and registration against the Render/Neon backend.
 * Falls back gracefully when offline; local AuthContext handles offline login.
 */
import { getServerUrl, setAuthToken } from "@/utils/storage";
import type { User } from "@/types";

export interface AuthResult {
  ok: boolean;
  user?: Omit<User, "password"> & { password?: string };
  token?: string;
  error?: string;
}

async function authFetch(path: string, body: Record<string, unknown>): Promise<AuthResult> {
  const base = getServerUrl();
  if (!base) {
    return { ok: false, error: "Server URL not configured" };
  }

  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: data?.error ?? `Request failed (${res.status})` };
    }

    if (data.token) {
      await setAuthToken(data.token);
    }

    return { ok: true, user: data.user, token: data.token };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("[Auth] Request failed (offline?)", msg);
    return { ok: false, error: msg };
  }
}

export async function serverLogin(username: string, password: string): Promise<AuthResult> {
  return authFetch("/api/auth/login", { username, password });
}

export async function serverRegister(
  name: string,
  username: string,
  password: string,
): Promise<AuthResult> {
  return authFetch("/api/auth/register", { name, username, password });
}

export async function clearServerAuth(): Promise<void> {
  await setAuthToken(null);
}
