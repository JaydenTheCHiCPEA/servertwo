import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadData, saveData } from "@/utils/storage";
import { generateId } from "@/utils/format";
import { serverLogin, serverRegister, clearServerAuth } from "@/utils/api";
import { checkServerHealth, getServerUrl } from "@/utils/storage";
import { useSync } from "@/context/SyncContext";
import { EMPTY_USERS, saveEmptyBusinessData } from "@/utils/empty-data";
import type { User, UserRole, Permissions } from "@/types";

const ADMIN_PERMISSIONS: Permissions = {
  acceptPayments: true, applyDiscounts: true, applyRestrictedDiscounts: true,
  changeTaxes: true, manageOpenTickets: true, voidSavedItems: true,
  openCashDrawer: true, viewCosts: true, viewReceipts: true, performRefunds: true,
  accessBackOffice: true, manageItems: true, manageEmployees: true,
  viewReports: true, manageSettings: true,
};
const MANAGER_PERMISSIONS: Permissions = {
  acceptPayments: true, applyDiscounts: true, applyRestrictedDiscounts: true,
  changeTaxes: true, manageOpenTickets: true, voidSavedItems: true,
  openCashDrawer: true, viewCosts: true, viewReceipts: true, performRefunds: true,
  accessBackOffice: true, manageItems: true, manageEmployees: false,
  viewReports: true, manageSettings: false,
};
const CASHIER_PERMISSIONS: Permissions = {
  acceptPayments: true, applyDiscounts: true, applyRestrictedDiscounts: false,
  changeTaxes: false, manageOpenTickets: false, voidSavedItems: false,
  openCashDrawer: true, viewCosts: false, viewReceipts: true, performRefunds: false,
  accessBackOffice: false, manageItems: false, manageEmployees: false,
  viewReports: false, manageSettings: false,
};

export function getDefaultPermissions(role: UserRole): Permissions {
  if (role === "admin") return { ...ADMIN_PERMISSIONS };
  if (role === "manager") return { ...MANAGER_PERMISSIONS };
  return { ...CASHIER_PERMISSIONS };
}

interface AuthContextValue {
  currentUser: User | null;
  users: User[];
  login: (username: string, password: string) => Promise<boolean>;
  register: (name: string, username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  addUser: (u: Omit<User, "id">) => void;
  updateUser: (id: string, u: Partial<User>) => void;
  deleteUser: (id: string) => void;
  hasPermission: (p: keyof Permissions) => boolean;
  wipeAllData: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { registerReload } = useSync();
  const [users, setUsers] = useState<User[]>(EMPTY_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const reloadFromStorage = useCallback(async () => {
    const loaded = await loadData<User[]>("users", EMPTY_USERS);
    setUsers(loaded);
    setCurrentUser((prev) => {
      if (!prev) return prev;
      return loaded.find((u) => u.id === prev.id) ?? prev;
    });
  }, []);

  useEffect(() => {
    void reloadFromStorage();
  }, [reloadFromStorage]);

  useEffect(() => registerReload(reloadFromStorage), [registerReload, reloadFromStorage]);

  async function login(username: string, password: string): Promise<boolean> {
    const freshUsers = await loadData<User[]>("users", EMPTY_USERS);
    const localUser = freshUsers.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password && u.active,
    );

    const serverUrl = getServerUrl();
    if (serverUrl && await checkServerHealth(serverUrl)) {
      const result = await serverLogin(username, password);
      if (result.ok && result.user) {
        const serverUser = { ...result.user, password } as User;
        const merged = freshUsers.some((u) => u.id === serverUser.id)
          ? freshUsers.map((u) => (u.id === serverUser.id ? { ...u, ...serverUser, password } : u))
          : [...freshUsers, serverUser];
        setUsers(merged);
        saveData("users", merged);
        setCurrentUser(serverUser);
        return true;
      }
    }

    if (localUser) {
      setCurrentUser(localUser);
      return true;
    }
    return false;
  }

  async function register(name: string, username: string, password: string): Promise<{ ok: boolean; error?: string }> {
    const freshUsers = await loadData<User[]>("users", EMPTY_USERS);

    if (freshUsers.length > 0) {
      return { ok: false, error: "A business account already exists. Sign in instead." };
    }

    if (freshUsers.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: "Username already exists" };
    }

    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters" };
    }

    const newUser: User = {
      id: generateId(),
      username: username.toLowerCase(),
      password,
      name,
      role: "admin",
      salary: 0,
      hourlyRate: 0,
      permissions: { ...ADMIN_PERMISSIONS },
      active: true,
    };

    const updated = [newUser];
    setUsers(updated);
    await saveData("users", updated);
    await saveEmptyBusinessData(saveData);

    const serverUrl = getServerUrl();
    if (serverUrl && await checkServerHealth(serverUrl)) {
      const result = await serverRegister(name, username, password);
      if (!result.ok) {
        setUsers(EMPTY_USERS);
        await saveData("users", EMPTY_USERS);
        await saveEmptyBusinessData(saveData);
        return { ok: false, error: result.error ?? "Server registration failed" };
      }
    }

    setCurrentUser(newUser);
    return { ok: true };
  }

  function logout() {
    setCurrentUser(null);
    void clearServerAuth();
  }

  function addUser(u: Omit<User, "id">) {
    if (u.role === "admin") return;
    const newUser = { ...u, id: generateId() };
    const updated = [...users, newUser];
    setUsers(updated);
    saveData("users", updated);
  }

  function updateUser(id: string, u: Partial<User>) {
    const updated = users.map((usr) => (usr.id === id ? { ...usr, ...u } : usr));
    setUsers(updated);
    saveData("users", updated);
    if (currentUser?.id === id) setCurrentUser((prev) => (prev ? { ...prev, ...u } : prev));
  }

  function deleteUser(id: string) {
    const updated = users.filter((u) => u.id !== id);
    setUsers(updated);
    saveData("users", updated);
  }

  function hasPermission(p: keyof Permissions): boolean {
    return currentUser?.permissions[p] === true;
  }

  async function wipeAllData(): Promise<void> {
    setUsers(EMPTY_USERS);
    setCurrentUser(null);
  }

  return (
    <AuthContext.Provider value={{ currentUser, users, login, register, logout, addUser, updateUser, deleteUser, hasPermission, wipeAllData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}