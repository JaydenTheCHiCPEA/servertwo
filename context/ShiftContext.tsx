import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadData, saveData } from "@/utils/storage";
import { generateId } from "@/utils/format";
import { useSync } from "@/context/SyncContext";
import { EMPTY_SHIFTS } from "@/utils/empty-data";
import type { Shift, CashMovement, Transaction } from "@/types";

interface ShiftContextValue {
  currentShift: Shift | null;
  allShifts: Shift[];
  isClocked: boolean;
  clockIn: (employeeId: string, employeeName: string, openingCash: number) => void;
  clockOut: (actualCash: number) => void;
  addCashMovement: (type: "in" | "out", amount: number, note: string) => void;
  recordSale: (total: number) => void;
  getExpectedCash: () => number;
  wipeAllData: () => Promise<void>;
}

export const ShiftContext = createContext<ShiftContextValue | null>(null);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const { registerReload } = useSync();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);

  const reloadFromStorage = useCallback(async () => {
    const shifts = await loadData<Shift[]>("shifts", []);
    setAllShifts(shifts);
    const open = shifts.find((s) => s.status === "open");
    setCurrentShift(open ?? null);
  }, []);

  useEffect(() => {
    void reloadFromStorage();
  }, [reloadFromStorage]);

  useEffect(() => registerReload(reloadFromStorage), [registerReload, reloadFromStorage]);

  function save(shifts: Shift[]) {
    setAllShifts(shifts);
    saveData("shifts", shifts);
  }

  function clockIn(employeeId: string, employeeName: string, openingCash: number) {
    const shift: Shift = {
      id: generateId(),
      employeeId,
      employeeName,
      startTime: new Date().toISOString(),
      endTime: null,
      openingCash,
      closingCash: null,
      expectedCash: null,
      cashDifference: null,
      cashMovements: [],
      salesCount: 0,
      salesTotal: 0,
      status: "open",
    };
    setCurrentShift(shift);
    const updated = [...allShifts, shift];
    save(updated);
  }

  function clockOut(actualCash: number) {
    if (!currentShift) return;
    const expected = getExpectedCash();
    const updated: Shift = {
      ...currentShift,
      endTime: new Date().toISOString(),
      closingCash: actualCash,
      expectedCash: expected,
      cashDifference: actualCash - expected,
      status: "closed",
    };
    setCurrentShift(null);
    const all = allShifts.map((s) => (s.id === updated.id ? updated : s));
    save(all);
  }

  function addCashMovement(type: "in" | "out", amount: number, note: string) {
    if (!currentShift) return;
    const movement: CashMovement = {
      id: generateId(),
      type,
      amount,
      note,
      timestamp: new Date().toISOString(),
    };
    const updated: Shift = {
      ...currentShift,
      cashMovements: [...currentShift.cashMovements, movement],
    };
    setCurrentShift(updated);
    const all = allShifts.map((s) => (s.id === updated.id ? updated : s));
    save(all);
  }

  function recordSale(total: number) {
    if (!currentShift) return;
    const updated: Shift = {
      ...currentShift,
      salesCount: currentShift.salesCount + 1,
      salesTotal: currentShift.salesTotal + total,
    };
    setCurrentShift(updated);
    const all = allShifts.map((s) => (s.id === updated.id ? updated : s));
    save(all);
  }

  function getExpectedCash(): number {
    if (!currentShift) return 0;
    const cashIn = currentShift.cashMovements
      .filter((m) => m.type === "in")
      .reduce((a, m) => a + m.amount, 0);
    const cashOut = currentShift.cashMovements
      .filter((m) => m.type === "out")
      .reduce((a, m) => a + m.amount, 0);
    return currentShift.openingCash + cashIn - cashOut + currentShift.salesTotal;
  }

  async function wipeAllData(): Promise<void> {
    setCurrentShift(null);
    setAllShifts(EMPTY_SHIFTS);
  }

  return (
    <ShiftContext.Provider
      value={{
        currentShift,
        allShifts,
        isClocked: currentShift !== null,
        clockIn,
        clockOut,
        addCashMovement,
        recordSale,
        getExpectedCash,
        wipeAllData,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be inside ShiftProvider");
  return ctx;
}