import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  checkServerHealth,
  devLog,
  getServerUrl,
  isSyncPending,
  registerSyncTrigger,
  syncBothDirections,
  SYNC_STORAGE_KEYS,
} from "@/utils/storage";

interface SyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingSync: boolean;
  serverUrl: string;
  syncNow: () => Promise<boolean>;
  registerReload: (fn: () => Promise<void>) => () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const SYNC_DEBOUNCE_MS = 2500;
const RETRY_INTERVAL_MS = 45000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(false);

  const reloadCallbacks = useRef<Set<() => Promise<void>>>(new Set());
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);

  const serverUrl = getServerUrl();

  const registerReload = useCallback((fn: () => Promise<void>) => {
    reloadCallbacks.current.add(fn);
    return () => {
      reloadCallbacks.current.delete(fn);
    };
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([...reloadCallbacks.current].map((fn) => fn()));
  }, []);

  const refreshPending = useCallback(async () => {
    setPendingSync(await isSyncPending());
  }, []);

  const runSync = useCallback(async (): Promise<boolean> => {
    if (syncingRef.current) return false;
    if (!serverUrl) {
      devLog("warn", "Sync skipped — EXPO_PUBLIC_DOMAIN not set");
      return false;
    }

    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const online = await checkServerHealth(serverUrl);
      setIsOnline(online);

      if (!online) {
        devLog("warn", "Offline — changes saved locally, will sync when online");
        setPendingSync(true);
        return false;
      }

      const result = await syncBothDirections(serverUrl, SYNC_STORAGE_KEYS);
      if (result.ok) {
        setLastSyncAt(new Date().toISOString());
        setPendingSync(false);
        await reloadAll();
        return true;
      }
      setPendingSync(true);
      return false;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [reloadAll, serverUrl]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      void runSync().then(refreshPending);
    }, SYNC_DEBOUNCE_MS);
  }, [runSync, refreshPending]);

  useEffect(() => {
    registerSyncTrigger(scheduleSync);

    void refreshPending();

    if (serverUrl) {
      devLog("info", "App started", `Server: ${serverUrl}`);
      void runSync();
    } else {
      devLog("warn", "No server URL configured — set EXPO_PUBLIC_DOMAIN");
    }

    const interval = setInterval(() => {
      void isSyncPending().then((p) => {
        if (p) void runSync().then(refreshPending);
      });
    }, RETRY_INTERVAL_MS);

    const onAppState = (state: AppStateStatus) => {
      if (state === "active") {
        void runSync().then(refreshPending);
      }
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      registerSyncTrigger(() => {});
      if (syncTimer.current) clearTimeout(syncTimer.current);
      clearInterval(interval);
      sub.remove();
    };
  }, [runSync, scheduleSync, refreshPending, serverUrl]);

  const syncNow = useCallback(async () => {
    const ok = await runSync();
    await refreshPending();
    return ok;
  }, [runSync, refreshPending]);

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        lastSyncAt,
        pendingSync,
        serverUrl,
        syncNow,
        registerReload,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be inside SyncProvider");
  return ctx;
}
