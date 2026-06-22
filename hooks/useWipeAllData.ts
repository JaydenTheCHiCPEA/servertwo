import { router } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { useShift } from "@/context/ShiftContext";
import { useStore } from "@/context/StoreContext";
import { useSync } from "@/context/SyncContext";
import { checkServerHealth, clearAllLocalStorage, getServerUrl, wipeServerStorage } from "@/utils/storage";

export function useWipeAllData() {
  const { currentUser, hasPermission, wipeAllData: wipeAuth, logout } = useAuth();
  const { wipeAllData: wipeStore } = useStore();
  const { wipeAllData: wipeShift } = useShift();
  const { isOnline } = useSync();

  const canWipe =
    currentUser?.role === "admin" && hasPermission("manageSettings");

  async function wipeAllData(): Promise<{ ok: boolean; error?: string }> {
    if (!canWipe) {
      return { ok: false, error: "Only admins with settings access can wipe all data." };
    }

    const serverUrl = getServerUrl();
    if (serverUrl && isOnline && await checkServerHealth(serverUrl)) {
      const serverResult = await wipeServerStorage(serverUrl);
      if (!serverResult.ok) {
        return { ok: false, error: serverResult.error ?? "Server wipe failed. Data was not cleared." };
      }
    }

    await clearAllLocalStorage();
    await wipeAuth();
    await wipeStore();
    await wipeShift();
    logout();
    router.replace("/");

    return { ok: true };
  }

  return { wipeAllData, canWipe };
}
