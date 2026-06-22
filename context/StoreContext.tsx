import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadData, saveData, SYNC_STORAGE_KEYS } from "@/utils/storage";
import { generateId } from "@/utils/format";
import { useSync } from "@/context/SyncContext";
import type { Item, Category, TaxRate, Transaction, DiscountRule, Store } from "@/types";

const DEFAULT_CATEGORIES: Category[] = [
];

const DEFAULT_TAX_RATES: TaxRate[] = [
  { id: "tax1", name: "GCT", rate: 15, isDefault: true },
  { id: "tax2", name: "None", rate: 0, isDefault: false },
];

const DEFAULT_ITEMS: Item[] = [
];

const DEFAULT_DISCOUNT_RULES: DiscountRule[] = [
  { id: "d3", name: "$5 Off", type: "amount", value: 5, requiresApproval: false, active: true },
];

const DEFAULT_STORE: Store = {
  id: "store1",
  name: "D.L. Wright Store",
  address: "123 Main Street, Kingston",
  phone: "(876) 555-0100",
  email: "info@dlwright.com",
  taxId: "TRN-001",
  receiptFooter: "Thank you for your business!",
};

const ALL_STORAGE_KEYS = SYNC_STORAGE_KEYS.filter((k) => k !== "users" && k !== "theme_option" && k !== "currency_symbol");

interface StoreContextValue {
  items: Item[];
  categories: Category[];
  taxRates: TaxRate[];
  transactions: Transaction[];
  discountRules: DiscountRule[];
  store: Store;
  addItem: (i: Omit<Item, "id">) => void;
  updateItem: (id: string, i: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  addCategory: (c: Omit<Category, "id">) => void;
  updateCategory: (id: string, c: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  addTaxRate: (t: Omit<TaxRate, "id">) => void;
  updateTaxRate: (id: string, t: Partial<TaxRate>) => void;
  deleteTaxRate: (id: string) => void;
  addTransaction: (t: Omit<Transaction, "id">) => void;
  addDiscountRule: (d: Omit<DiscountRule, "id">) => void;
  updateDiscountRule: (id: string, d: Partial<DiscountRule>) => void;
  deleteDiscountRule: (id: string) => void;
  updateStore: (s: Partial<Store>) => void;
  reduceStock: (itemId: string, qty: number) => void;
  getLowStockItems: () => Item[];
  getDefaultTax: () => TaxRate | null;
  wipeAllData: () => Promise<void>;
}

export const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { registerReload } = useSync();
  const [items, setItems] = useState<Item[]>(DEFAULT_ITEMS);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [taxRates, setTaxRates] = useState<TaxRate[]>(DEFAULT_TAX_RATES);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>(DEFAULT_DISCOUNT_RULES);
  const [store, setStore] = useState<Store>(DEFAULT_STORE);

  const reloadFromStorage = useCallback(async () => {
    const [loadedItems, loadedCategories, loadedTaxRates, loadedTransactions, loadedDiscountRules, loadedStore] =
      await Promise.all([
        loadData<Item[]>("items", DEFAULT_ITEMS),
        loadData<Category[]>("categories", DEFAULT_CATEGORIES),
        loadData<TaxRate[]>("tax_rates", DEFAULT_TAX_RATES),
        loadData<Transaction[]>("transactions", []),
        loadData<DiscountRule[]>("discount_rules", DEFAULT_DISCOUNT_RULES),
        loadData<Store>("store", DEFAULT_STORE),
      ]);
    setItems(loadedItems);
    setCategories(loadedCategories);
    setTaxRates(loadedTaxRates);
    setTransactions(loadedTransactions);
    setDiscountRules(loadedDiscountRules);
    setStore(loadedStore);
  }, []);

  useEffect(() => {
    void reloadFromStorage();
  }, [reloadFromStorage]);

  useEffect(() => registerReload(reloadFromStorage), [registerReload, reloadFromStorage]);

  function addItem(i: Omit<Item, "id">) {
    const n = { ...i, id: generateId() };
    const u = [...items, n]; setItems(u); saveData("items", u);
  }
  function updateItem(id: string, i: Partial<Item>) {
    const u = items.map(x => x.id === id ? { ...x, ...i } : x); setItems(u); saveData("items", u);
  }
  function deleteItem(id: string) {
    const u = items.filter(x => x.id !== id); setItems(u); saveData("items", u);
  }
  function addCategory(c: Omit<Category, "id">) {
    const n = { ...c, id: generateId() };
    const u = [...categories, n]; setCategories(u); saveData("categories", u);
  }
  function updateCategory(id: string, c: Partial<Category>) {
    const u = categories.map(x => x.id === id ? { ...x, ...c } : x); setCategories(u); saveData("categories", u);
  }
  function deleteCategory(id: string) {
    const u = categories.filter(x => x.id !== id); setCategories(u); saveData("categories", u);
  }
  function addTaxRate(t: Omit<TaxRate, "id">) {
    const n = { ...t, id: generateId() };
    const u = [...taxRates, n]; setTaxRates(u); saveData("tax_rates", u);
  }
  function updateTaxRate(id: string, t: Partial<TaxRate>) {
    const u = taxRates.map(x => x.id === id ? { ...x, ...t } : x); setTaxRates(u); saveData("tax_rates", u);
  }
  function deleteTaxRate(id: string) {
    const u = taxRates.filter(x => x.id !== id); setTaxRates(u); saveData("tax_rates", u);
  }
  function addTransaction(t: Omit<Transaction, "id">) {
    const n = { ...t, id: generateId() };
    const u = [...transactions, n]; setTransactions(u); saveData("transactions", u);
  }
  function addDiscountRule(d: Omit<DiscountRule, "id">) {
    const n = { ...d, id: generateId() };
    const u = [...discountRules, n]; setDiscountRules(u); saveData("discount_rules", u);
  }
  function updateDiscountRule(id: string, d: Partial<DiscountRule>) {
    const u = discountRules.map(x => x.id === id ? { ...x, ...d } : x); setDiscountRules(u); saveData("discount_rules", u);
  }
  function deleteDiscountRule(id: string) {
    const u = discountRules.filter(x => x.id !== id); setDiscountRules(u); saveData("discount_rules", u);
  }
  function updateStore(s: Partial<Store>) {
    const u = { ...store, ...s }; setStore(u); saveData("store", u);
  }
  function reduceStock(itemId: string, qty: number) {
    const u = items.map(x => x.id === itemId ? { ...x, stock: Math.max(0, x.stock - qty) } : x);
    setItems(u); saveData("items", u);
  }
  function getLowStockItems(): Item[] {
    return items.filter(i => i.stock <= i.minStock && i.active);
  }
  function getDefaultTax(): TaxRate | null {
    return taxRates.find(t => t.isDefault) ?? null;
  }

  async function wipeAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(ALL_STORAGE_KEYS);
    } catch {}
    setItems(DEFAULT_ITEMS);
    setCategories(DEFAULT_CATEGORIES);
    setTaxRates(DEFAULT_TAX_RATES);
    setTransactions([]);
    setDiscountRules(DEFAULT_DISCOUNT_RULES);
    setStore(DEFAULT_STORE);
  }

  return (
    <StoreContext.Provider value={{
      items, categories, taxRates, transactions, discountRules, store,
      addItem, updateItem, deleteItem,
      addCategory, updateCategory, deleteCategory,
      addTaxRate, updateTaxRate, deleteTaxRate,
      addTransaction, addDiscountRule, updateDiscountRule, deleteDiscountRule,
      updateStore, reduceStock, getLowStockItems, getDefaultTax,
      wipeAllData,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}