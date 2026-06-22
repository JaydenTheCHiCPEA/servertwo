import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useShift } from "@/context/ShiftContext";
import { useStore } from "@/context/StoreContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import type { Transaction } from "@/types";
import { formatCurrency, formatDateTime, formatDuration } from "@/utils/format";

type Tab = "receipts" | "shifts";

function printReceiptWeb(tx: Transaction, storeName: string, storeAddress: string, storePhone: string, footer: string, sym: string) {
  if (typeof window === "undefined") return;
  const subtotalLine = `<div class="row"><span>Subtotal</span><span>${sym}${tx.subtotal.toFixed(2)}</span></div>`;
  const taxLine = `<div class="row"><span>Tax</span><span>${sym}${tx.taxAmount.toFixed(2)}</span></div>`;
  const discLine = tx.discountAmount > 0
    ? `<div class="row green"><span>Discount</span><span>-${sym}${tx.discountAmount.toFixed(2)}</span></div>` : "";
  const itemRows = tx.items.map(ci =>
    `<div class="row"><span>${ci.name} × ${ci.quantity}</span><span>${sym}${((ci.price - ci.discountAmount) * ci.quantity).toFixed(2)}</span></div>`
  ).join("");

  const html = `<!DOCTYPE html><html><head><title>Receipt ${tx.receiptNumber}</title>
<style>
  body{font-family:'Courier New',monospace;max-width:320px;margin:20px auto;font-size:13px;color:#000}
  h2{text-align:center;margin:0;font-size:16px}
  .sub{text-align:center;color:#555;font-size:11px;margin:2px 0}
  .divider{border-top:1px dashed #999;margin:10px 0}
  .row{display:flex;justify-content:space-between;margin:3px 0}
  .total{display:flex;justify-content:space-between;margin:6px 0;font-weight:bold;font-size:15px;border-top:2px solid #000;padding-top:6px}
  .green{color:green}
  .label{font-size:10px;text-transform:uppercase;color:#777;margin-top:10px;margin-bottom:4px}
  .footer{text-align:center;margin-top:14px;font-style:italic;font-size:11px;color:#555}
  @media print{body{margin:0}}
</style></head><body>
<h2>${storeName}</h2>
<p class="sub">${storeAddress}</p>
<p class="sub">${storePhone}</p>
<div class="divider"></div>
<div class="row"><span><b>${tx.receiptNumber}</b></span><span>${formatDateTime(tx.timestamp)}</span></div>
<div class="row"><span>Cashier:</span><span>${tx.employeeName}</span></div>
<div class="divider"></div>
<div class="label">Items</div>
${itemRows}
<div class="divider"></div>
<div class="label">Totals</div>
${subtotalLine}${taxLine}${discLine}
<div class="total"><span>TOTAL</span><span>${sym}${tx.total.toFixed(2)}</span></div>
<div class="label">Payment</div>
<div class="row"><span>Method</span><span style="text-transform:capitalize">${tx.paymentType}</span></div>
${tx.paymentType === "cash" ? `<div class="row"><span>Cash Given</span><span>${sym}${(tx.cashGiven ?? 0).toFixed(2)}</span></div><div class="row"><span>Change</span><span>${sym}${(tx.changeDue ?? 0).toFixed(2)}</span></div>` : ""}
<div class="footer">${footer}</div>
<script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}</script>
</body></html>`;

  const win = window.open("", "_blank", "width=400,height=600");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function ReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, store } = useStore();
  const { allShifts } = useShift();
  const { currencySymbol } = useTheme();

  const [tab, setTab] = useState<Tab>("receipts");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const topPad = Platform.OS === "web" ? 67 : 0;

  const sortedTx = useMemo(() => [...transactions].reverse(), [transactions]);
  const sortedShifts = useMemo(() => [...allShifts].reverse(), [allShifts]);

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
    tabBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
    tabText: { fontSize: 14, fontWeight: "700" },
    card: { margin: 12, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
    typeBadge: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    receipt: { fontSize: 13, fontWeight: "700", color: colors.foreground },
    meta: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    amount: { fontSize: 16, fontWeight: "800" },
    modalScreen: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: insets.top + 20, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
    receiptBody: { padding: 20, gap: 12 },
    section: { gap: 6 },
    sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    rowLabel: { fontSize: 13, color: colors.mutedForeground },
    rowVal: { fontSize: 13, fontWeight: "600", color: colors.foreground },
    itemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, gap: 8 },
    itemName: { flex: 1, fontSize: 13, color: colors.foreground },
    totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    totalLabel: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    totalVal: { fontSize: 16, fontWeight: "800", color: colors.primary },
    shiftCard: { margin: 12, marginBottom: 0, borderRadius: 14, borderWidth: 1, padding: 14 },
    shiftTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    shiftName: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    shiftMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
    diffChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    printBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  });

  return (
    <View style={[s.screen, { paddingTop: topPad }]}>
      <View style={s.tabRow}>
        {([{ key: "receipts", label: "Receipts" }, { key: "shifts", label: "Shifts" }] as { key: Tab; label: string }[]).map(t => (
          <TouchableOpacity key={t.key} style={[s.tabBtn, { borderBottomWidth: 2, borderBottomColor: tab === t.key ? colors.primary : "transparent" }]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabText, { color: tab === t.key ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "receipts" ? (
        <FlatList
          data={sortedTx}
          keyExtractor={t => t.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
              <Feather name="file-text" size={40} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 15, fontWeight: "600" }}>No receipts yet</Text>
            </View>
          }
          renderItem={({ item: tx }) => {
            const isRefund = tx.type === "refund";
            return (
              <TouchableOpacity style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSelectedTx(tx)} activeOpacity={0.8}>
                <View style={[s.typeBadge, { backgroundColor: isRefund ? colors.destructive + "22" : colors.success + "22" }]}>
                  <Feather name={isRefund ? "rotate-ccw" : "check-circle"} size={20} color={isRefund ? colors.destructive : colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.receipt}>{tx.receiptNumber}</Text>
                  <Text style={s.meta}>{formatDateTime(tx.timestamp)} • {tx.employeeName}</Text>
                  <Text style={s.meta}>{tx.items.length} items • {tx.paymentType}</Text>
                </View>
                <Text style={[s.amount, { color: isRefund ? colors.destructive : colors.primary }]}>
                  {isRefund ? "-" : ""}{formatCurrency(tx.total, currencySymbol)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={sortedShifts}
          keyExtractor={s => s.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
              <Feather name="clock" size={40} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 15, fontWeight: "600" }}>No shifts yet</Text>
            </View>
          }
          renderItem={({ item: shift }) => {
            const diff = shift.cashDifference;
            return (
              <View style={[s.shiftCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.shiftTop}>
                  <View>
                    <Text style={s.shiftName}>{shift.employeeName}</Text>
                    <Text style={s.shiftMeta}>{formatDateTime(shift.startTime)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    <View style={[s.diffChip, { backgroundColor: shift.status === "open" ? colors.success + "22" : colors.muted }]}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: shift.status === "open" ? colors.success : colors.mutedForeground, textTransform: "uppercase" }}>{shift.status}</Text>
                    </View>
                    {diff !== null && (
                      <View style={[s.diffChip, { backgroundColor: diff >= 0 ? colors.success + "22" : colors.destructive + "22" }]}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: diff >= 0 ? colors.success : colors.destructive }}>
                          {diff >= 0 ? "+" : ""}{formatCurrency(diff, currencySymbol)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[s.shiftMeta, { marginTop: 8 }]}>
                  Duration: {shift.endTime ? formatDuration(shift.startTime, shift.endTime) : "In progress"}
                </Text>
                <Text style={s.shiftMeta}>Sales: {shift.salesCount} transactions • {formatCurrency(shift.salesTotal, currencySymbol)}</Text>
                <Text style={s.shiftMeta}>Opening: {formatCurrency(shift.openingCash, currencySymbol)}{shift.expectedCash !== null ? ` • Expected: ${formatCurrency(shift.expectedCash, currencySymbol)}` : ""}</Text>
                {shift.cashMovements.length > 0 && <Text style={s.shiftMeta}>{shift.cashMovements.length} cash movement(s)</Text>}
              </View>
            );
          }}
        />
      )}

      {/* Receipt Detail Modal */}
      <Modal visible={!!selectedTx} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedTx(null)}>
        <View style={s.modalScreen}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>{selectedTx?.receiptNumber}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{selectedTx ? formatDateTime(selectedTx.timestamp) : ""}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {Platform.OS === "web" && selectedTx ? (
                <TouchableOpacity
                  style={[s.printBtn, { backgroundColor: colors.primary }]}
                  onPress={() => printReceiptWeb(selectedTx, store.name, store.address ?? "", store.phone ?? "", store.receiptFooter ?? "", currencySymbol)}
                >
                  <Feather name="printer" size={16} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Print</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setSelectedTx(null)}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
          {selectedTx && (
            <ScrollView contentContainerStyle={s.receiptBody}>
              <View style={[{ padding: 20, backgroundColor: colors.surface, borderRadius: 14, gap: 4, alignItems: "center", borderWidth: 1, borderColor: colors.border }]}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>{store.name}</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{store.address}</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{store.phone}</Text>
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>Items</Text>
                {selectedTx.items.map((ci, i) => (
                  <View key={i} style={s.itemRow}>
                    <Text style={s.itemName}>{ci.name} × {ci.quantity}</Text>
                    <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>{formatCurrency((ci.price - ci.discountAmount) * ci.quantity, currencySymbol)}</Text>
                  </View>
                ))}
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>Totals</Text>
                <View style={s.row}><Text style={s.rowLabel}>Subtotal</Text><Text style={s.rowVal}>{formatCurrency(selectedTx.subtotal, currencySymbol)}</Text></View>
                <View style={s.row}><Text style={s.rowLabel}>Tax</Text><Text style={s.rowVal}>{formatCurrency(selectedTx.taxAmount, currencySymbol)}</Text></View>
                {selectedTx.discountAmount > 0 && <View style={s.row}><Text style={[s.rowLabel, { color: colors.success }]}>Discount</Text><Text style={[s.rowVal, { color: colors.success }]}>-{formatCurrency(selectedTx.discountAmount, currencySymbol)}</Text></View>}
                <View style={s.totalRow}><Text style={s.totalLabel}>Total</Text><Text style={s.totalVal}>{formatCurrency(selectedTx.total, currencySymbol)}</Text></View>
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>Payment</Text>
                <View style={s.row}><Text style={s.rowLabel}>Method</Text><Text style={[s.rowVal, { textTransform: "capitalize" }]}>{selectedTx.paymentType}</Text></View>
                {selectedTx.paymentType === "cash" && <View style={s.row}><Text style={s.rowLabel}>Cash Given</Text><Text style={s.rowVal}>{formatCurrency(selectedTx.cashGiven, currencySymbol)}</Text></View>}
                {selectedTx.paymentType === "cash" && <View style={s.row}><Text style={s.rowLabel}>Change</Text><Text style={s.rowVal}>{formatCurrency(selectedTx.changeDue, currencySymbol)}</Text></View>}
              </View>

              <View style={s.section}>
                <Text style={s.sectionTitle}>Served By</Text>
                <View style={s.row}><Text style={s.rowLabel}>Cashier</Text><Text style={s.rowVal}>{selectedTx.employeeName}</Text></View>
              </View>

              {store.receiptFooter ? (
                <View style={{ alignItems: "center", paddingTop: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: "center", fontStyle: "italic" }}>{store.receiptFooter}</Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}
