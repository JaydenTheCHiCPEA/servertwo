import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, useWindowDimensions,
} from "react-native";

import { BarChart, DonutChart, HorizontalBarChart, LineChart } from "@/components/SimpleChart";
import { useStore } from "@/context/StoreContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { formatCurrency } from "@/utils/format";

type Range = "today" | "week" | "month" | "year";

function getRange(r: Range): Date {
  const now = new Date();
  if (r === "today") { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; }
  if (r === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (r === "month") { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
  const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d;
}

/* ── Standalone section wrapper — must NOT be defined inside another component ── */
interface SectionProps {
  title: string;
  children: React.ReactNode;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
}
function ChartSection({ title, children, cardBg, cardBorder, titleColor }: SectionProps) {
  return (
    <View style={st.section}>
      <Text style={[st.sectionTitle, { color: titleColor }]}>{title}</Text>
      <View style={[st.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        {children}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { transactions, categories, items } = useStore();
  const { currencySymbol } = useTheme();

  const [range, setRange] = useState<Range>("today");

  const isWide = Platform.OS === "web" && width >= 800;

  const since = getRange(range);
  const filtered = useMemo(
    () => transactions.filter(t => t.type === "sale" && new Date(t.timestamp) >= since),
    [transactions, range, since]
  );

  /* ── KPIs ── */
  const netSales = filtered.reduce((s, t) => s + t.total, 0);
  const grossProfit = filtered.reduce((s, t) => {
    const cost = t.items.reduce((c, ci) => {
      const item = items.find(i => i.id === ci.itemId);
      return c + (item?.cost ?? 0) * ci.quantity;
    }, 0);
    return s + t.total - cost;
  }, 0);
  const txCount = filtered.length;
  const avgSale = txCount > 0 ? netSales / txCount : 0;
  const discountTotal = filtered.reduce((s, t) => s + t.discountAmount, 0);
  const taxTotal = filtered.reduce((s, t) => s + t.taxAmount, 0);

  /* ── Sales trend (7 slots) ── */
  const salesTrend = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d1 = new Date();
      const d2 = new Date();
      let label = "";
      if (range === "today") {
        const hr = i * 4;
        d1.setHours(hr, 0, 0, 0); d2.setHours(hr + 3, 59, 59, 999);
        label = `${hr}h`;
      } else {
        d1.setDate(d1.getDate() - (6 - i)); d1.setHours(0, 0, 0, 0);
        d2.setDate(d2.getDate() - (6 - i)); d2.setHours(23, 59, 59, 999);
        label = d1.toLocaleDateString("en-US", { weekday: "short" });
      }
      const value = filtered
        .filter(t => { const ts = new Date(t.timestamp); return ts >= d1 && ts <= d2; })
        .reduce((s, t) => s + t.total, 0);
      return { label, value, color: colors.primary };
    });
  }, [filtered, range, colors.primary]);

  /* ── By category ── */
  const byCategory = useMemo(() => {
    const map: Record<string, { value: number; color: string }> = {};
    filtered.forEach(t => {
      t.items.forEach(ci => {
        const item = items.find(i => i.id === ci.itemId);
        const cat = categories.find(c => c.id === item?.categoryId);
        const key = cat?.name ?? "Other";
        if (!map[key]) map[key] = { value: 0, color: cat?.color ?? colors.mutedForeground };
        map[key].value += (ci.price - ci.discountAmount) * ci.quantity;
      });
    });
    return Object.entries(map)
      .map(([label, { value, color }]) => ({ label, value, color }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filtered, categories, items, colors.mutedForeground]);

  /* ── Top items ── */
  const topItems = useMemo(() => {
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    filtered.forEach(t => {
      t.items.forEach(ci => {
        if (!map[ci.itemId]) map[ci.itemId] = { name: ci.name, qty: 0, revenue: 0 };
        map[ci.itemId].qty += ci.quantity;
        map[ci.itemId].revenue += ci.price * ci.quantity;
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filtered]);

  /* ── By employee ── */
  const byEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(t => { map[t.employeeName] = (map[t.employeeName] ?? 0) + t.total; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filtered]);

  /* ── By payment type ── */
  const byPayType = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(t => { map[t.paymentType] = (map[t.paymentType] ?? 0) + t.total; });
    return map;
  }, [filtered]);

  const hasTrend = salesTrend.some(d => d.value > 0);

  const ranges: { key: Range; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "7 Days" },
    { key: "month", label: "Month" },
    { key: "year", label: "Year" },
  ];

  const accentColors = [colors.primary, colors.success, colors.warning, colors.purple, colors.mutedForeground];

  const kpiCards = [
    { label: "Net Sales", value: formatCurrency(netSales, currencySymbol), icon: "trending-up" as const, color: colors.primary },
    { label: "Gross Profit", value: formatCurrency(grossProfit, currencySymbol), icon: "dollar-sign" as const, color: colors.success },
    { label: "Transactions", value: String(txCount), icon: "shopping-bag" as const, color: colors.warning },
    { label: "Avg. Sale", value: formatCurrency(avgSale, currencySymbol), icon: "activity" as const, color: colors.purple },
  ];

  /* shared ChartSection props */
  const sectionBase = { cardBg: colors.card, cardBorder: colors.border, titleColor: colors.mutedForeground };

  return (
    <View style={[st.screen, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[st.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[st.title, { color: colors.foreground }]}>Analytics</Text>
          <Text style={[st.subtitle, { color: colors.mutedForeground }]}>
            {txCount === 0 ? "No transactions yet" : `${txCount} transaction${txCount !== 1 ? "s" : ""}`}
          </Text>
        </View>
        <TouchableOpacity
          style={[st.posBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(pos)")}
        >
          <Feather name="shopping-bag" size={14} color="#fff" />
          <Text style={st.posBtnText}>POS</Text>
        </TouchableOpacity>
      </View>

      {/* ── Range filter ── */}
      <View style={[st.rangeBar, { backgroundColor: colors.header, borderBottomColor: colors.border }]}>
        {ranges.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[
              st.rangeBtn,
              { backgroundColor: range === r.key ? colors.primary : "transparent" },
            ]}
            onPress={() => setRange(r.key)}
          >
            <Text style={[st.rangeTxt, { color: range === r.key ? "#fff" : colors.mutedForeground }]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── KPI grid ── */}
        <View style={[st.kpiGrid, isWide && st.kpiGridWide]}>
          {kpiCards.map(k => (
            <View
              key={k.label}
              style={[
                st.kpiCard,
                isWide && st.kpiCardWide,
                { backgroundColor: k.color + "16", borderColor: k.color + "30" },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <View style={[st.kpiIcon, { backgroundColor: k.color + "22" }]}>
                  <Feather name={k.icon} size={13} color={k.color} />
                </View>
                <Text style={[st.kpiLabel, { color: k.color }]}>{k.label}</Text>
              </View>
              <Text style={[st.kpiVal, { color: k.color }]}>{k.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Empty state ── */}
        {filtered.length === 0 ? (
          <View style={st.empty}>
            <Feather name="bar-chart-2" size={52} color={colors.border} />
            <Text style={[st.emptyTitle, { color: colors.foreground }]}>No data yet</Text>
            <Text style={[st.emptyMsg, { color: colors.mutedForeground }]}>
              {"Complete sales in the POS to see analytics here."}
            </Text>
            <TouchableOpacity
              style={[st.posBtn, { backgroundColor: colors.primary, marginTop: 8 }]}
              onPress={() => router.push("/(pos)")}
            >
              <Feather name="shopping-bag" size={14} color="#fff" />
              <Text style={st.posBtnText}>Open POS</Text>
            </TouchableOpacity>
          </View>
        ) : isWide ? (
          /* ═══════════ WIDE (≥800px) two-column layout ═══════════ */
          <>
            {hasTrend && (
              <ChartSection title="SALES TREND" {...sectionBase}>
                <LineChart
                  data={salesTrend}
                  height={200}
                  lineColor={colors.primary}
                  labelColor={colors.mutedForeground}
                  gridColor={colors.border}
                  formatValue={v => formatCurrency(v, currencySymbol)}
                />
              </ChartSection>
            )}

            <View style={st.wideRow}>
              {byCategory.length > 0 && (
                <View style={st.wideCol}>
                  <ChartSection title="BY CATEGORY" {...sectionBase}>
                    <DonutChart
                      data={byCategory}
                      size={160}
                      thickness={34}
                      labelColor={colors.foreground}
                      mutedColor={colors.mutedForeground}
                      centerLabel={`${currencySymbol}${Math.round(netSales)}`}
                    />
                  </ChartSection>
                </View>
              )}
              {topItems.length > 0 && (
                <View style={st.wideCol}>
                  <ChartSection title="TOP PRODUCTS" {...sectionBase}>
                    <HorizontalBarChart
                      data={topItems.map((it, i) => ({
                        label: it.name,
                        value: it.revenue,
                        meta: `${it.qty} sold`,
                        color: accentColors[i],
                      }))}
                      barColor={colors.primary}
                      bgColor={colors.border}
                      labelColor={colors.foreground}
                      metaColor={colors.mutedForeground}
                      valueColor={colors.primary}
                      formatValue={v => formatCurrency(v, currencySymbol)}
                    />
                  </ChartSection>
                </View>
              )}
            </View>

            <View style={st.wideRow}>
              {byEmployee.length > 0 && (
                <View style={st.wideCol}>
                  <ChartSection title="BY EMPLOYEE" {...sectionBase}>
                    <HorizontalBarChart
                      data={byEmployee.map(([name, amt]) => ({ label: name, value: amt }))}
                      barColor={colors.success}
                      bgColor={colors.border}
                      labelColor={colors.foreground}
                      metaColor={colors.mutedForeground}
                      valueColor={colors.success}
                      formatValue={v => formatCurrency(v, currencySymbol)}
                    />
                  </ChartSection>
                </View>
              )}
              <View style={st.wideCol}>
                <ChartSection title="PAYMENT TYPES" {...sectionBase}>
                  {Object.entries(byPayType).map(([type, amt]) => (
                    <PayRow key={type} type={type} amt={amt} currencySymbol={currencySymbol} colors={colors} />
                  ))}
                </ChartSection>
                <ChartSection title="SUMMARY" {...sectionBase}>
                  <SummaryRow label="Total Discounts" value={formatCurrency(discountTotal, currencySymbol)} color={colors.warning} borderColor={colors.border} muted={colors.mutedForeground} />
                  <SummaryRow label="Tax Collected" value={formatCurrency(taxTotal, currencySymbol)} color={colors.mutedForeground} borderColor={colors.border} muted={colors.mutedForeground} />
                </ChartSection>
              </View>
            </View>
          </>
        ) : (
          /* ═══════════ NARROW (mobile) single column ═══════════ */
          <>
            {hasTrend && (
              <ChartSection title="SALES TREND" {...sectionBase}>
                <BarChart
                  data={salesTrend}
                  height={190}
                  barColor={colors.primary}
                  labelColor={colors.mutedForeground}
                  gridColor={colors.border}
                  formatValue={v => v > 0 ? formatCurrency(v, currencySymbol) : ""}
                />
              </ChartSection>
            )}

            {byCategory.length > 0 && (
              <ChartSection title="BY CATEGORY" {...sectionBase}>
                <DonutChart
                  data={byCategory}
                  size={140}
                  thickness={30}
                  labelColor={colors.foreground}
                  mutedColor={colors.mutedForeground}
                  centerLabel={`${currencySymbol}${Math.round(netSales)}`}
                />
              </ChartSection>
            )}

            {topItems.length > 0 && (
              <ChartSection title="TOP PRODUCTS" {...sectionBase}>
                <HorizontalBarChart
                  data={topItems.map((it, i) => ({
                    label: it.name,
                    value: it.revenue,
                    meta: `${it.qty} sold`,
                    color: accentColors[i],
                  }))}
                  barColor={colors.primary}
                  bgColor={colors.border}
                  labelColor={colors.foreground}
                  metaColor={colors.mutedForeground}
                  valueColor={colors.primary}
                  formatValue={v => formatCurrency(v, currencySymbol)}
                />
              </ChartSection>
            )}

            {byEmployee.length > 0 && (
              <ChartSection title="BY EMPLOYEE" {...sectionBase}>
                <HorizontalBarChart
                  data={byEmployee.map(([name, amt]) => ({ label: name, value: amt }))}
                  barColor={colors.success}
                  bgColor={colors.border}
                  labelColor={colors.foreground}
                  metaColor={colors.mutedForeground}
                  valueColor={colors.success}
                  formatValue={v => formatCurrency(v, currencySymbol)}
                />
              </ChartSection>
            )}

            {Object.keys(byPayType).length > 0 && (
              <ChartSection title="PAYMENT TYPES" {...sectionBase}>
                {Object.entries(byPayType).map(([type, amt]) => (
                  <PayRow key={type} type={type} amt={amt} currencySymbol={currencySymbol} colors={colors} />
                ))}
              </ChartSection>
            )}

            <ChartSection title="SUMMARY" {...sectionBase}>
              <SummaryRow label="Total Discounts" value={formatCurrency(discountTotal, currencySymbol)} color={colors.warning} borderColor={colors.border} muted={colors.mutedForeground} />
              <SummaryRow label="Tax Collected" value={formatCurrency(taxTotal, currencySymbol)} color={colors.mutedForeground} borderColor={colors.border} muted={colors.mutedForeground} />
            </ChartSection>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

/* ── Small helpers (no hooks) ── */
function PayRow({ type, amt, currencySymbol, colors }: {
  type: string; amt: number; currencySymbol: string;
  colors: { primary: string; foreground: string; border: string };
}) {
  const icon = type === "cash" ? "dollar-sign" : type === "card" ? "credit-card" : "more-horizontal";
  return (
    <View style={[st.payRow, { borderBottomColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={[st.payIcon, { backgroundColor: colors.primary + "1A" }]}>
          <Feather name={icon as any} size={14} color={colors.primary} />
        </View>
        <Text style={[st.payLabel, { color: colors.foreground }]}>
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </Text>
      </View>
      <Text style={[st.payVal, { color: colors.primary }]}>{formatCurrency(amt, currencySymbol)}</Text>
    </View>
  );
}

function SummaryRow({ label, value, color, borderColor, muted }: {
  label: string; value: string; color: string; borderColor: string; muted: string;
}) {
  return (
    <View style={[st.payRow, { borderBottomColor: borderColor }]}>
      <Text style={[st.payLabel, { color: muted }]}>{label}</Text>
      <Text style={[st.payVal, { color }]}>{value}</Text>
    </View>
  );
}

/* ── Styles ── */
const st = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 22, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 2 },
  posBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  posBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rangeBar: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8,
    gap: 4, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rangeBtn: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8 },
  rangeTxt: { fontSize: 12, fontWeight: "700" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 10 },
  kpiGridWide: { flexWrap: "nowrap" },
  kpiCard: { flex: 1, minWidth: "45%", padding: 14, borderRadius: 14, borderWidth: 1 },
  kpiCardWide: { minWidth: 0 },
  kpiIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  kpiLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  kpiVal: { fontSize: 22, fontWeight: "800", marginTop: 2 },
  section: { marginHorizontal: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  wideRow: { flexDirection: "row", alignItems: "flex-start" },
  wideCol: { flex: 1 },
  payRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  payIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  payLabel: { fontSize: 13 },
  payVal: { fontSize: 14, fontWeight: "700" },
  empty: { alignItems: "center", padding: 48, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  emptyMsg: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
