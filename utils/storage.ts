import AsyncStorage from "@react-native-async-storage/async-storage";

export const SYNC_STORAGE_KEYS = [
  "items",
  "categories",
  "tax_rates",
  "transactions",
  "discount_rules",
  "store",
  "shifts",
  "users",
  "theme_option",
  "currency_symbol",
];

const PENDING_SYNC_KEY = "sync_pending";
const AUTH_TOKEN_KEY = "auth_token";

let syncTrigger: (() => void) | null = null;

export function registerSyncTrigger(fn: () => void) {
  syncTrigger = fn;
}

export function getServerUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();
  if (!domain) return "";
  return domain.replace(/\/$/, "");
}

/** Dev-only sync logging — visible in Metro / Expo logs, not in the app UI. */
export function devLog(level: string, message: string, detail?: string): void {
  const prefix = `[Sync ${level.toUpperCase()}]`;
  if (detail) {
    console.log(prefix, message, detail);
  } else {
    console.log(prefix, message);
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

export async function isSyncPending(): Promise<boolean> {
  const val = await AsyncStorage.getItem(PENDING_SYNC_KEY);
  return val === "true";
}

async function setSyncPending(pending: boolean): Promise<void> {
  if (pending) {
    await AsyncStorage.setItem(PENDING_SYNC_KEY, "true");
  } else {
    await AsyncStorage.removeItem(PENDING_SYNC_KEY);
  }
}

export async function loadData<T>(key: string, fallback: T): Promise<T> {
  try {
    const json = await AsyncStorage.getItem(key);
    if (json === null) return fallback;
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function saveData<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    if (SYNC_STORAGE_KEYS.includes(key)) {
      await setSyncPending(true);
      syncTrigger?.();
    }
  } catch {}
}

export async function clearData(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

/** Clear all synced keys plus auth and pending sync flags. */
export async function clearAllLocalStorage(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([...SYNC_STORAGE_KEYS, PENDING_SYNC_KEY, AUTH_TOKEN_KEY]);
  } catch {
    // ignore
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function syncAllToServer(
  url: string,
  keys: string[],
): Promise<{ ok: boolean; error?: string }> {
  const base = url.replace(/\/$/, "");
  if (!base) {
    return { ok: false, error: "Server URL not configured (EXPO_PUBLIC_DOMAIN)" };
  }

  try {
    const storage: Record<string, unknown> = {};
    for (const key of keys) {
      try {
        const v = await AsyncStorage.getItem(key);
        storage[key] = v === null ? null : JSON.parse(v);
      } catch {
        storage[key] = null;
      }
    }

    const endpoint = `${base}/api/storage/sync`;
    devLog("info", `POST ${endpoint}`, `Pushing ${keys.length} keys`);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ storage }),
    });

    const txt = await res.text();
    if (!res.ok) {
      devLog("error", `Push failed (${res.status})`, txt.slice(0, 300));
      return { ok: false, error: `server error: ${res.status} ${txt}` };
    }

    devLog("success", "Pushed local data to server");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    devLog("error", "Push failed", msg);
    return { ok: false, error: msg };
  }
}

export async function fetchAllFromServer(
  url: string,
  keys: string[],
): Promise<{ ok: boolean; error?: string }> {
  const base = url.replace(/\/$/, "");
  if (!base) {
    return { ok: false, error: "Server URL not configured (EXPO_PUBLIC_DOMAIN)" };
  }

  try {
    const endpoint = `${base}/api/storage`;
    devLog("info", `GET ${endpoint}`);

    const res = await fetch(endpoint, { headers: await authHeaders() });
    if (!res.ok) {
      devLog("error", `Pull failed (${res.status})`);
      return { ok: false, error: `server error ${res.status}` };
    }

    const data = await res.json();
    const storage = data?.storage ?? {};
    let replacedCount = 0;

    for (const key of keys) {
      if (!(key in storage)) continue;

      try {
        await AsyncStorage.setItem(key, JSON.stringify(storage[key]));
        replacedCount++;
      } catch {
        // ignore per-key errors
      }
    }

    devLog("success", "Pulled server data", `Replaced ${replacedCount} keys`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    devLog("error", "Pull failed", msg);
    return { ok: false, error: msg };
  }
}

export async function syncBothDirections(
  url: string,
  keys: string[],
): Promise<{ ok: boolean; error?: string }> {
  devLog("info", "Starting sync", url || "(no url)");

  const push = await syncAllToServer(url, keys);
  if (!push.ok) return push;

  const pull = await fetchAllFromServer(url, keys);
  if (!pull.ok) return pull;

  await setSyncPending(false);
  devLog("success", "Sync complete");
  return { ok: true };
}

export async function wipeServerStorage(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const base = url.replace(/\/$/, "");
  if (!base) {
    return { ok: false, error: "Server URL not configured (EXPO_PUBLIC_DOMAIN)" };
  }

  try {
    const endpoint = `${base}/api/storage/wipe`;
    devLog("info", `POST ${endpoint}`);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: await authHeaders(),
    });

    const txt = await res.text();
    if (!res.ok) {
      devLog("error", `Wipe failed (${res.status})`, txt.slice(0, 300));
      return { ok: false, error: `server wipe failed: ${res.status} ${txt}` };
    }

    devLog("success", "Server storage wiped");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    devLog("error", "Wipe failed", msg);
    return { ok: false, error: msg };
  }
}

export async function checkServerHealth(url: string): Promise<boolean> {
  const base = url.replace(/\/$/, "");
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/healthz`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}