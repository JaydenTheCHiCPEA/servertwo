import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList, Image, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useShift } from "@/context/ShiftContext";
import { useStore } from "@/context/StoreContext";
import { useSync } from "@/context/SyncContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import type { CartItem, Item } from "@/types";
import { formatCurrency, formatDuration, generateReceiptNumber } from "@/utils/format";

/* ── helpers ── */
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export default function POSScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { currentUser, hasPermission, logout } = useAuth();
  const { currentShift, clockOut, addCashMovement, recordSale, getExpectedCash } = useShift();
  const { items, categories, taxRates, transactions, discountRules, store, addTransaction, reduceStock, getLowStockItems, getDefaultTax } = useStore();
  const { currencySymbol } = useTheme();
  const { isOnline, pendingSync, isSyncing } = useSync();

  const isWide = Platform.OS === "web" && width >= 820;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 0 : insets.bottom;

  /* ── auth guard ── */
  useEffect(() => {
    if (!currentUser) { router.replace("/"); return; }
    if (!currentShift) { router.replace("/clock-in"); }
  }, [currentUser, currentShift]);

  /* ── shift timer ── */
  const [shiftTime, setShiftTime] = useState("0h 0m");
  useEffect(() => {
    if (!currentShift) return;
    const update = () => setShiftTime(formatDuration(currentShift.startTime));
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [currentShift?.startTime]);

  /* ── toast / confirm ── */
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDlg, setConfirmDlg] = useState<{ title: string; msg: string; onOk: () => void } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2800);
  }
  function showConfirm(title: string, msg: string, onOk: () => void) {
    setConfirmDlg({ title, msg, onOk });
  }

  /* ── cart state ── */
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [overallDiscountType, setOverallDiscountType] = useState<"percent" | "amount">("percent");
  const [overallDiscountVal, setOverallDiscountVal] = useState(0);

  /* ── modal visibility ── */
  const [cartVisible, setCartVisible] = useState(false);
  const [payVisible, setPayVisible] = useState(false);
  const [discountVisible, setDiscountVisible] = useState(false);
  const [addCashVisible, setAddCashVisible] = useState(false);
  const [closeShiftVisible, setCloseShiftVisible] = useState(false);
  const [refundVisible, setRefundVisible] = useState(false);

  /* ── form state ── */
  const [payType, setPayType] = useState<"cash" | "card" | "other">("cash");
  const [cashInput, setCashInput] = useState("");
  const [customDiscInput, setCustomDiscInput] = useState("");
  const [actualCashInput, setActualCashInput] = useState("");
  const [cashMoveAmt, setCashMoveAmt] = useState("");
  const [cashMoveNote, setCashMoveNote] = useState("");
  const [cashMoveType, setCashMoveType] = useState<"in" | "out">("in");

  /* ── computed ── */
  const filteredItems = useMemo(() =>
    items.filter(i => i.active &&
      (!selectedCat || i.categoryId === selectedCat) &&
      i.name.toLowerCase().includes(search.toLowerCase())
    ), [items, selectedCat, search]);

  const cartSubtotal = cart.reduce((s, ci) => s + (ci.price - ci.discountAmount) * ci.quantity, 0);
  const cartTax = cart.reduce((s, ci) => s + (ci.price - ci.discountAmount) * ci.quantity * (ci.taxRate / 100), 0);
  const overallDiscAmt = overallDiscountType === "percent"
    ? cartSubtotal * (overallDiscountVal / 100)
    : Math.min(overallDiscountVal, cartSubtotal);
  const cartTotal = Math.max(0, cartSubtotal + cartTax - overallDiscAmt);
  const cartCount = cart.reduce((s, ci) => s + ci.quantity, 0);
  const changeAmt = parseFloat(cashInput) - cartTotal;
  const lowStockItems = getLowStockItems();

  /* ── cart actions ── */
  function addToCart(item: Item) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const taxRate = taxRates.find(t => t.id === item.taxRateId)?.rate ?? getDefaultTax()?.rate ?? 0;
    setCart(prev => {
      const existing = prev.find(ci => ci.itemId === item.id);
      if (existing) return prev.map(ci => ci.itemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci);
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: 1, discountAmount: 0, taxRate }];
    });
  }

  function updateQty(itemId: string, qty: number) {
    if (qty <= 0) { removeFromCart(itemId); return; }
    setCart(prev => prev.map(ci => ci.itemId === itemId ? { ...ci, quantity: qty } : ci));
  }

  function removeFromCart(itemId: string) {
    setCart(prev => prev.filter(ci => ci.itemId !== itemId));
  }

  function clearCart() {
    showConfirm("Clear Cart", "Remove all items from the cart?", () => setCart([]));
  }

  /* ── discounts ── */
  function applyPresetDiscount(ruleId: string) {
    const rule = discountRules.find(r => r.id === ruleId);
    if (!rule) return;
    if (rule.requiresApproval && !hasPermission("applyRestrictedDiscounts")) {
      showToast("Manager approval required for this discount.", false);
      return;
    }
    setOverallDiscountType(rule.type);
    setOverallDiscountVal(rule.value);
    setDiscountVisible(false);
  }

  function applyCustomDiscount() {
    const val = parseFloat(customDiscInput);
    if (isNaN(val) || val < 0) return;
    setOverallDiscountVal(val);
    setCustomDiscInput("");
    setDiscountVisible(false);
  }

  /* ── payment ── */
  function processPayment() {
    if (cart.length === 0) { showToast("Cart is empty.", false); return; }
    if (payType === "cash") {
      const given = parseFloat(cashInput);
      if (isNaN(given) || given < cartTotal) {
        showToast(`Minimum cash: ${formatCurrency(cartTotal, currencySymbol)}`, false);
        return;
      }
    }
    const cashGiven = payType === "cash" ? parseFloat(cashInput) : cartTotal;
    const receipt = generateReceiptNumber();
    const tx = {
      receiptNumber: receipt,
      items: [...cart],
      subtotal: cartSubtotal,
      discountAmount: overallDiscAmt,
      taxAmount: cartTax,
      total: cartTotal,
      paymentType: payType,
      cashGiven,
      changeDue: payType === "cash" ? cashGiven - cartTotal : 0,
      employeeId: currentUser!.id,
      employeeName: currentUser!.name,
      shiftId: currentShift!.id,
      timestamp: new Date().toISOString(),
      type: "sale" as const,
      notes: "",
    };
    addTransaction(tx);
    if (payType === "cash") addCashMovement("in", cartTotal, `Sale ${receipt}`);
    recordSale(cartTotal);
    cart.forEach(ci => reduceStock(ci.itemId, ci.quantity));
    const changeStr = payType === "cash" && cashGiven > cartTotal
      ? `  Change: ${formatCurrency(cashGiven - cartTotal, currencySymbol)}`
      : "";
    showToast(`Sale complete! ${receipt}${changeStr}`);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCart([]);
    setOverallDiscountVal(0);
    setPayVisible(false);
    setCartVisible(false);
    setCashInput("");
  }

  /* ── cash drawer ── */
  function handleAddCash() {
    const amt = parseFloat(cashMoveAmt);
    if (isNaN(amt) || amt <= 0) { showToast("Enter a valid amount.", false); return; }
    addCashMovement(cashMoveType, amt, cashMoveNote || (cashMoveType === "in" ? "Cash added" : "Cash removed"));
    showToast(`Cash ${cashMoveType === "in" ? "added" : "removed"}: ${formatCurrency(amt, currencySymbol)}`);
    setCashMoveAmt(""); setCashMoveNote(""); setAddCashVisible(false);
  }

  /* ── close shift ── */
  function handleCloseShift() {
    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) { showToast("Enter actual cash amount.", false); return; }
    showConfirm("Close Shift", "This will end your shift and sign you out. Continue?", () => {
      clockOut(actual);
      setCloseShiftVisible(false);
      logout();
      router.replace("/");
    });
  }

  const expectedCash = getExpectedCash();
  const cashDiff = actualCashInput !== "" && !isNaN(parseFloat(actualCashInput))
    ? parseFloat(actualCashInput) - expectedCash
    : null;

  /* ── helpers ── */
  const getCategoryColor = (cid: string) => categories.find(c => c.id === cid)?.color ?? colors.primary;

  /* ── item card ── */
  function ItemCard({ item }: { item: Item }) {
    const inCartItem = cart.find(ci => ci.itemId === item.id);
    const catColor = getCategoryColor(item.categoryId);
    const isLow = item.stock <= item.minStock;
    return (
      <TouchableOpacity
        style={[iCS.card, { backgroundColor: colors.itemCard, borderColor: inCartItem ? colors.primary : colors.border }]}
        onPress={() => addToCart(item)}
        activeOpacity={0.75}
      >
        {/* Image / color bar area */}
        <View style={{ position: "relative" }}>
          {item.imageUri ? (
            <Image source={{ uri: item.imageUri }} style={iCS.itemImg} resizeMode="cover" />
          ) : (
            <View style={[iCS.colorBar, { backgroundColor: catColor }]} />
          )}
          {/* Stock count badge */}
          <View style={[iCS.stockBadge, { backgroundColor: isLow ? colors.destructive : colors.primary }]}>
            <Text style={iCS.stockBadgeTxt}>{item.stock}</Text>
          </View>
          {/* In-cart qty badge */}
          {inCartItem ? (
            <View style={[iCS.cartBadge, { backgroundColor: colors.primary }]}>
              <Text style={iCS.cartBadgeTxt}>{inCartItem.quantity}</Text>
            </View>
          ) : null}
        </View>
        <View style={iCS.body}>
          <Text style={[iCS.name, { color: colors.foreground }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[iCS.price, { color: colors.primary }]}>{formatCurrency(item.price, currencySymbol)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  /* ── cart item row ── */
  function CartItemRow({ ci }: { ci: CartItem }) {
    const [localQty, setLocalQty] = useState(String(ci.quantity));

    function commitQty() {
      const n = parseInt(localQty);
      if (!isNaN(n) && n > 0) updateQty(ci.itemId, n);
      else if (n === 0) removeFromCart(ci.itemId);
      else setLocalQty(String(ci.quantity));
    }

    return (
      <View style={[cS.cartRow, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[cS.cartName, { color: colors.foreground }]} numberOfLines={1}>{ci.name}</Text>
          <Text style={[cS.cartMeta, { color: colors.mutedForeground }]}>
            {formatCurrency(ci.price - ci.discountAmount, currencySymbol)}
            {ci.taxRate > 0 ? ` + ${ci.taxRate}% tax` : ""}
          </Text>
        </View>
        <View style={cS.qtyRow}>
          <TouchableOpacity style={[cS.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => updateQty(ci.itemId, ci.quantity - 1)}>
            <Feather name="minus" size={12} color={colors.foreground} />
          </TouchableOpacity>
          <TextInput
            style={[cS.qtyInput, { color: colors.foreground, borderColor: colors.border }]}
            value={localQty}
            onChangeText={setLocalQty}
            onBlur={commitQty}
            onSubmitEditing={commitQty}
            keyboardType="number-pad"
            selectTextOnFocus
          />
          <TouchableOpacity style={[cS.qtyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => updateQty(ci.itemId, ci.quantity + 1)}>
            <Feather name="plus" size={12} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <Text style={[cS.cartTotal, { color: colors.primary }]}>
          {formatCurrency((ci.price - ci.discountAmount) * ci.quantity, currencySymbol)}
        </Text>
        <TouchableOpacity onPress={() => removeFromCart(ci.itemId)} style={{ paddingLeft: 8 }}>
          <Feather name="trash-2" size={14} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    );
  }

  /* ── cart footer ── */
  function CartTotals({ compact }: { compact?: boolean }) {
    return (
      <View style={[cS.totals, { borderTopColor: colors.border }]}>
        <View style={cS.totRow}><Text style={[cS.totLabel, { color: colors.mutedForeground }]}>Subtotal</Text><Text style={[cS.totVal, { color: colors.foreground }]}>{formatCurrency(cartSubtotal, currencySymbol)}</Text></View>
        <View style={cS.totRow}><Text style={[cS.totLabel, { color: colors.mutedForeground }]}>Tax</Text><Text style={[cS.totVal, { color: colors.foreground }]}>{formatCurrency(cartTax, currencySymbol)}</Text></View>
        {overallDiscAmt > 0 ? <View style={cS.totRow}><Text style={[cS.totLabel, { color: colors.success }]}>Discount</Text><Text style={[cS.totVal, { color: colors.success }]}>{"-"}{formatCurrency(overallDiscAmt, currencySymbol)}</Text></View> : null}
        <View style={[cS.totRow, cS.grandRow]}>
          <Text style={[cS.grandLabel, { color: colors.foreground }]}>Total</Text>
          <Text style={[cS.grandVal, { color: colors.primary }]}>{formatCurrency(cartTotal, currencySymbol)}</Text>
        </View>
      </View>
    );
  }

  /* ── web cart panel ── */
  function WebCartPanel() {
    return (
      <View style={[wS.panel, { backgroundColor: colors.cartBackground, borderLeftColor: colors.border }]}>
        <View style={[wS.panelHeader, { borderBottomColor: colors.border }]}>
          <Text style={[wS.panelTitle, { color: colors.foreground }]}>
            {`Cart (${cartCount} items)`}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[wS.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setDiscountVisible(true)}>
              <Feather name="tag" size={15} color={overallDiscountVal > 0 ? colors.success : colors.mutedForeground} />
            </TouchableOpacity>
            {cartCount > 0 ? (
              <TouchableOpacity style={[wS.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={clearCart}>
                <Feather name="trash-2" size={15} color={colors.destructive} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <FlatList
          data={cart}
          keyExtractor={ci => ci.itemId}
          style={{ flex: 1 }}
          renderItem={({ item: ci }) => <CartItemRow ci={ci} />}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 }}>
              <Feather name="shopping-cart" size={36} color={colors.border} />
              <Text style={{ color: colors.mutedForeground, marginTop: 12, fontSize: 13 }}>Cart is empty</Text>
            </View>
          }
        />
        <CartTotals />
        <View style={[wS.panelActions, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[wS.chargeBtn, { backgroundColor: cart.length > 0 ? colors.primary : colors.muted }]}
            onPress={() => { setPayVisible(true); setCashInput(""); }}
            disabled={cart.length === 0}
          >
            <Feather name="credit-card" size={18} color={cart.length > 0 ? "#fff" : colors.mutedForeground} />
            <Text style={[wS.chargeBtnText, { color: cart.length > 0 ? "#fff" : colors.mutedForeground }]}>
              {`Charge ${formatCurrency(cartTotal, currencySymbol)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { backgroundColor: colors.posBackground }]}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: topPad + 8, backgroundColor: colors.header, borderBottomColor: colors.border }]}>
        <View style={s.headerLeft}>
          <Text style={[s.storeName, { color: colors.foreground }]} numberOfLines={1}>{store.name}</Text>
          <Text style={[s.userLine, { color: colors.mutedForeground }]}>
            {`${currentUser?.name}  ·  ${shiftTime}`}
          </Text>
        </View>
        <View style={s.headerRight}>
          <View style={[s.syncIndicator, { backgroundColor: (isSyncing ? colors.warning : isOnline && !pendingSync ? colors.success : colors.destructive) + "22", borderColor: (isSyncing ? colors.warning : isOnline && !pendingSync ? colors.success : colors.destructive) + "44" }]}>
            <Feather name="cloud" size={13} color={isSyncing ? colors.warning : isOnline && !pendingSync ? colors.success : colors.destructive} />
          </View>
          {hasPermission("openCashDrawer") ? (
            <TouchableOpacity style={[s.hBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setAddCashVisible(true)}>
              <Feather name="dollar-sign" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
          {hasPermission("performRefunds") ? (
            <TouchableOpacity style={[s.hBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setRefundVisible(true)}>
              <Feather name="rotate-ccw" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
          {hasPermission("accessBackOffice") ? (
            <TouchableOpacity style={[s.hBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push("/(backoffice)")}>
              <Feather name="grid" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[s.closeBtn, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "44" }]} onPress={() => setCloseShiftVisible(true)}>
            <Feather name="x-circle" size={13} color={colors.destructive} />
            <Text style={[s.closeBtnTxt, { color: colors.destructive }]}>Close Shift</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Low stock bar ── */}
      {lowStockItems.length > 0 ? (
        <View style={[s.lowBar, { backgroundColor: colors.warning + "22", borderBottomColor: colors.warning + "44" }]}>
          <Feather name="alert-triangle" size={13} color={colors.warning} />
          <Text style={[s.lowBarTxt, { color: colors.warning }]} numberOfLines={1}>
            {`Low stock: ${lowStockItems.map(i => i.name).join(", ")}`}
          </Text>
        </View>
      ) : null}

      {/* ── Search ── */}
      <View style={[s.searchRow, { backgroundColor: colors.header, borderBottomColor: colors.border }]}>
        <View style={[s.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[s.searchInput, { color: colors.foreground }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search items…"
            placeholderTextColor={colors.mutedForeground}
          />
          {search !== "" ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* ── Category chips ── */}
      <View style={[s.catBar, { backgroundColor: colors.header, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catScroll}>
          <TouchableOpacity
            style={[s.chip, { backgroundColor: !selectedCat ? colors.primary : colors.surface, borderColor: !selectedCat ? colors.primary : colors.border }]}
            onPress={() => setSelectedCat(null)}
          >
            <Text style={[s.chipTxt, { color: !selectedCat ? "#fff" : colors.foreground }]}>All</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[s.chip, { backgroundColor: selectedCat === cat.id ? cat.color + "33" : colors.surface, borderColor: selectedCat === cat.id ? cat.color : colors.border }]}
              onPress={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
            >
              <View style={[s.catDot, { backgroundColor: cat.color }]} />
              <Text style={[s.chipTxt, { color: colors.foreground }]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Main area ── */}
      <View style={[s.mainArea, isWide && s.mainAreaWide]}>
        <FlatList
          data={filteredItems}
          numColumns={isWide ? 4 : 3}
          key={isWide ? "wide" : "narrow"}
          keyExtractor={i => i.id}
          renderItem={({ item }) => <ItemCard item={item} />}
          contentContainerStyle={[s.grid, { paddingBottom: botPad + (isWide ? 20 : 90) }]}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Feather name="package" size={36} color={colors.mutedForeground} />
              <Text style={[s.emptyTxt, { color: colors.mutedForeground }]}>No items found</Text>
            </View>
          }
        />
        {isWide ? <WebCartPanel /> : null}
      </View>

      {/* ── Mobile bottom bar ── */}
      {!isWide ? (
        <View style={[s.bottomBar, { backgroundColor: colors.cartBackground, borderTopColor: colors.border, paddingBottom: botPad + 10 }]}>
          <TouchableOpacity style={s.discBtn} onPress={() => setDiscountVisible(true)} disabled={cart.length === 0}>
            <Feather name="tag" size={18} color={overallDiscountVal > 0 ? colors.success : colors.mutedForeground} />
            {overallDiscountVal > 0 ? (
              <View style={[s.discBadge, { backgroundColor: colors.success }]}>
                <Text style={s.discBadgeTxt}>
                  {overallDiscountType === "percent" ? `${overallDiscountVal}%` : formatCurrency(overallDiscountVal, currencySymbol)}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity style={s.cartSummary} onPress={() => setCartVisible(true)} activeOpacity={0.8}>
            {cartCount > 0 ? (
              <View style={[s.cartBadge, { backgroundColor: colors.primary }]}>
                <Text style={s.cartBadgeTxt}>{cartCount}</Text>
              </View>
            ) : null}
            <Feather name="shopping-cart" size={20} color={colors.foreground} />
            <Text style={[s.cartTotal, { color: colors.foreground }]}>{formatCurrency(cartTotal, currencySymbol)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.checkoutBtn, { backgroundColor: cart.length > 0 ? colors.primary : colors.muted }]}
            onPress={() => { setPayVisible(true); setCashInput(""); }}
            disabled={cart.length === 0}
          >
            <Text style={[s.checkoutTxt, { color: cart.length > 0 ? "#fff" : colors.mutedForeground }]}>
              {`Charge ${formatCurrency(cartTotal, currencySymbol)}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ════ CART MODAL (mobile) ════ */}
      <Modal visible={cartVisible && !isWide} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCartVisible(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHdr, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>{`Cart (${cartCount})`}</Text>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              {cartCount > 0 ? <TouchableOpacity onPress={clearCart}><Text style={{ color: colors.destructive, fontWeight: "700", fontSize: 14 }}>Clear</Text></TouchableOpacity> : null}
              <TouchableOpacity onPress={() => setCartVisible(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={cart}
            keyExtractor={ci => ci.itemId}
            style={{ flex: 1 }}
            renderItem={({ item: ci }) => <CartItemRow ci={ci} />}
            ListEmptyComponent={<View style={s.emptyState}><Feather name="shopping-cart" size={36} color={colors.mutedForeground} /><Text style={[s.emptyTxt, { color: colors.mutedForeground }]}>Cart is empty</Text></View>}
          />
          <CartTotals />
          <View style={[s.modalFooter, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
            <TouchableOpacity
              style={[s.checkoutBtn, { backgroundColor: cart.length > 0 ? colors.primary : colors.muted, flex: 1 }]}
              onPress={() => { setCartVisible(false); setPayVisible(true); setCashInput(""); }}
              disabled={cart.length === 0}
            >
              <Text style={[s.checkoutTxt, { color: "#fff" }]}>Proceed to Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════ PAYMENT MODAL ════ */}
      <Modal visible={payVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPayVisible(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHdr, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Payment</Text>
            <TouchableOpacity onPress={() => setPayVisible(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={[s.totalChip, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "44" }]}>
              <Text style={[s.totalChipLbl, { color: colors.mutedForeground }]}>Amount Due</Text>
              <Text style={[s.totalChipVal, { color: colors.primary }]}>{formatCurrency(cartTotal, currencySymbol)}</Text>
            </View>

            <Text style={[s.secLbl, { color: colors.mutedForeground }]}>Payment Method</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["cash", "card", "other"] as const).map(pt => (
                <TouchableOpacity
                  key={pt}
                  style={[s.payTypeBtn, { backgroundColor: payType === pt ? colors.primary : colors.surface, borderColor: payType === pt ? colors.primary : colors.border }]}
                  onPress={() => setPayType(pt)}
                >
                  <Feather name={pt === "cash" ? "dollar-sign" : pt === "card" ? "credit-card" : "more-horizontal"} size={16} color={payType === pt ? "#fff" : colors.foreground} />
                  <Text style={{ color: payType === pt ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 13 }}>
                    {pt === "cash" ? "Cash" : pt === "card" ? "Card" : "Other"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {payType === "cash" ? (
              <>
                <Text style={[s.secLbl, { color: colors.mutedForeground }]}>Cash Received</Text>
                <View style={[s.amtRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[s.amtSign, { color: colors.foreground }]}>{currencySymbol}</Text>
                  <TextInput style={[s.amtInput, { color: colors.foreground }]} value={cashInput} onChangeText={setCashInput} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} autoFocus />
                </View>
                {cashInput !== "" && parseFloat(cashInput) >= cartTotal ? (
                  <View style={[s.changeBox, { backgroundColor: colors.success + "1A", borderColor: colors.success + "44" }]}>
                    <Text style={[s.changeLbl, { color: colors.success }]}>Change Due</Text>
                    <Text style={[s.changeVal, { color: colors.success }]}>{formatCurrency(changeAmt, currencySymbol)}</Text>
                  </View>
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[5, 10, 20, 50, 100].map(amt => (
                    <TouchableOpacity key={amt} style={[s.quickAmt, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setCashInput(String(Math.ceil(cartTotal / amt) * amt))}>
                      <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>{`${currencySymbol}${amt}`}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[s.quickAmt, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "44" }]} onPress={() => setCashInput(cartTotal.toFixed(2))}>
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Exact</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            <TouchableOpacity style={[s.checkoutBtn, { backgroundColor: colors.success }]} onPress={processPayment}>
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={[s.checkoutTxt, { color: "#fff" }]}>Complete Sale</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ════ DISCOUNT MODAL ════ */}
      <Modal visible={discountVisible} animationType="slide" transparent onRequestClose={() => setDiscountVisible(false)}>
        <View style={s.sheetOverlay}>
          <View style={[s.sheet, { backgroundColor: colors.cartBackground, paddingBottom: insets.bottom + 24 }]}>
            <View style={[s.modalHdr, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Apply Discount</Text>
              <TouchableOpacity onPress={() => setDiscountVisible(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
              {discountRules.filter(r => r.active).map(rule => (
                <TouchableOpacity key={rule.id} style={[s.discRule, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => applyPresetDiscount(rule.id)}>
                  <Feather name="tag" size={18} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>{rule.name}</Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                      {rule.type === "percent" ? `${rule.value}% off` : `${formatCurrency(rule.value, currencySymbol)} off`}
                      {rule.requiresApproval ? "  ·  Manager required" : ""}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
              <View style={[s.divider, { borderTopColor: colors.border }]} />
              <Text style={[s.secLbl, { color: colors.mutedForeground }]}>Custom Discount</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TouchableOpacity style={[s.typeToggle, { backgroundColor: overallDiscountType === "percent" ? colors.primary : colors.surface, borderColor: colors.border }]} onPress={() => setOverallDiscountType("percent")}>
                  <Text style={{ color: overallDiscountType === "percent" ? "#fff" : colors.foreground, fontWeight: "700" }}>%</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.typeToggle, { backgroundColor: overallDiscountType === "amount" ? colors.primary : colors.surface, borderColor: colors.border }]} onPress={() => setOverallDiscountType("amount")}>
                  <Text style={{ color: overallDiscountType === "amount" ? "#fff" : colors.foreground, fontWeight: "700" }}>{currencySymbol}</Text>
                </TouchableOpacity>
                <View style={[s.discInput, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
                  <TextInput style={{ color: colors.foreground, fontSize: 15, flex: 1 }} value={customDiscInput} onChangeText={setCustomDiscInput} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={colors.mutedForeground} />
                </View>
                <TouchableOpacity style={[s.applyBtn, { backgroundColor: colors.primary }]} onPress={applyCustomDiscount}>
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Apply</Text>
                </TouchableOpacity>
              </View>
              {overallDiscountVal > 0 ? (
                <TouchableOpacity style={[s.removeDiscBtn, { borderColor: colors.destructive + "44" }]} onPress={() => { setOverallDiscountVal(0); setDiscountVisible(false); }}>
                  <Feather name="x-circle" size={15} color={colors.destructive} />
                  <Text style={{ color: colors.destructive, fontWeight: "600", fontSize: 13 }}>Remove Discount</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ ADD CASH MODAL ════ */}
      <Modal visible={addCashVisible} animationType="slide" transparent onRequestClose={() => setAddCashVisible(false)}>
        <View style={s.sheetOverlay}>
          <View style={[s.sheet, { backgroundColor: colors.cartBackground, paddingBottom: insets.bottom + 24 }]}>
            <View style={[s.modalHdr, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Cash Drawer</Text>
              <TouchableOpacity onPress={() => setAddCashVisible(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
            </View>
            <View style={{ padding: 20, gap: 16 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {(["in", "out"] as const).map(t => (
                  <TouchableOpacity key={t} style={[s.toggleBtn, { flex: 1, backgroundColor: cashMoveType === t ? (t === "in" ? colors.success : colors.destructive) : colors.surface, borderColor: colors.border }]} onPress={() => setCashMoveType(t)}>
                    <Feather name={t === "in" ? "plus-circle" : "minus-circle"} size={15} color={cashMoveType === t ? "#fff" : colors.mutedForeground} />
                    <Text style={{ color: cashMoveType === t ? "#fff" : colors.mutedForeground, fontWeight: "600" }}>{t === "in" ? "Add Cash" : "Remove Cash"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.secLbl, { color: colors.mutedForeground }]}>Amount</Text>
              <View style={[s.amtRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[s.amtSign, { color: colors.foreground }]}>{currencySymbol}</Text>
                <TextInput style={[s.amtInput, { color: colors.foreground }]} value={cashMoveAmt} onChangeText={setCashMoveAmt} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} />
              </View>
              <Text style={[s.secLbl, { color: colors.mutedForeground }]}>Note (optional)</Text>
              <View style={[s.amtRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput style={{ flex: 1, color: colors.foreground, fontSize: 15, paddingVertical: 14 }} value={cashMoveNote} onChangeText={setCashMoveNote} placeholder="Reason…" placeholderTextColor={colors.mutedForeground} />
              </View>
              <TouchableOpacity style={[s.checkoutBtn, { backgroundColor: cashMoveType === "in" ? colors.success : colors.destructive }]} onPress={handleAddCash}>
                <Feather name={cashMoveType === "in" ? "plus" : "minus"} size={16} color="#fff" />
                <Text style={[s.checkoutTxt, { color: "#fff" }]}>{cashMoveType === "in" ? "Add Cash to Drawer" : "Remove Cash from Drawer"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════ CLOSE SHIFT MODAL ════ */}
      <Modal visible={closeShiftVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCloseShiftVisible(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHdr, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Close Shift</Text>
            <TouchableOpacity onPress={() => setCloseShiftVisible(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            <View style={[s.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.summaryTitle, { color: colors.foreground }]}>Shift Summary</Text>
              {[
                { label: "Employee", val: currentUser?.name ?? "" },
                { label: "Duration", val: shiftTime },
                { label: "Transactions", val: String(currentShift?.salesCount ?? 0) },
                { label: "Sales Total", val: formatCurrency(currentShift?.salesTotal ?? 0, currencySymbol) },
                { label: "Opening Cash", val: formatCurrency(currentShift?.openingCash ?? 0, currencySymbol) },
                { label: "Expected Cash", val: formatCurrency(expectedCash, currencySymbol) },
              ].map(row => (
                <View key={row.label} style={s.summaryRow}>
                  <Text style={[s.summaryLbl, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[s.summaryVal, { color: colors.foreground }]}>{row.val}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.secLbl, { color: colors.mutedForeground }]}>Actual Cash in Drawer</Text>
            <View style={[s.amtRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.amtSign, { color: colors.foreground }]}>{currencySymbol}</Text>
              <TextInput style={[s.amtInput, { color: colors.foreground }]} value={actualCashInput} onChangeText={setActualCashInput} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} />
            </View>

            {cashDiff !== null ? (
              <View style={[s.diffBox, { backgroundColor: cashDiff >= 0 ? colors.success + "1A" : colors.destructive + "1A", borderColor: cashDiff >= 0 ? colors.success + "44" : colors.destructive + "44" }]}>
                <Text style={[s.diffLbl, { color: colors.mutedForeground }]}>Difference</Text>
                <Text style={[s.diffVal, { color: cashDiff >= 0 ? colors.success : colors.destructive }]}>
                  {cashDiff >= 0 ? "+" : ""}{formatCurrency(cashDiff, currencySymbol)}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={[s.checkoutBtn, { backgroundColor: colors.destructive }]} onPress={handleCloseShift}>
              <Feather name="log-out" size={16} color="#fff" />
              <Text style={[s.checkoutTxt, { color: "#fff" }]}>Close Shift {"&"} Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ════ REFUND MODAL ════ */}
      <Modal visible={refundVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setRefundVisible(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHdr, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Refund / Void</Text>
            <TouchableOpacity onPress={() => setRefundVisible(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <FlatList
            data={transactions.filter(t => t.type === "sale" && t.shiftId === currentShift?.id).reverse()}
            keyExtractor={t => t.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            ListEmptyComponent={<View style={s.emptyState}><Text style={{ color: colors.mutedForeground }}>No transactions this shift</Text></View>}
            renderItem={({ item: tx }) => (
              <View style={[s.txCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.txReceipt, { color: colors.foreground }]}>{tx.receiptNumber}</Text>
                  <Text style={[s.txMeta, { color: colors.mutedForeground }]}>{`${tx.items.length} items · ${tx.paymentType}`}</Text>
                </View>
                <Text style={[s.txTotal, { color: colors.primary }]}>{formatCurrency(tx.total, currencySymbol)}</Text>
                <TouchableOpacity
                  style={[s.refundBtn, { backgroundColor: colors.destructive + "1A", borderColor: colors.destructive + "44" }]}
                  onPress={() => {
                    showConfirm("Refund", `Refund ${formatCurrency(tx.total, currencySymbol)} for ${tx.receiptNumber}?`, () => {
                      const { id: _id, ...txData } = tx;
                      addTransaction({ ...txData, type: "refund", receiptNumber: `REF-${tx.receiptNumber}`, refundedTransactionId: tx.id, timestamp: new Date().toISOString() });
                      if (tx.paymentType === "cash") addCashMovement("out", tx.total, `Refund ${tx.receiptNumber}`);
                      showToast(`Refund of ${formatCurrency(tx.total, currencySymbol)} processed.`);
                      setRefundVisible(false);
                    });
                  }}
                >
                  <Text style={{ color: colors.destructive, fontWeight: "700", fontSize: 12 }}>Refund</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* ════ TOAST ════ */}
      {toast !== null ? (
        <View style={[s.toast, { backgroundColor: toast.ok ? colors.success : colors.destructive }]} pointerEvents="none">
          <Feather name={toast.ok ? "check-circle" : "alert-circle"} size={15} color="#fff" />
          <Text style={s.toastTxt}>{toast.msg}</Text>
        </View>
      ) : null}

      {/* ════ CONFIRM DIALOG ════ */}
      <Modal visible={confirmDlg !== null} animationType="fade" transparent onRequestClose={() => setConfirmDlg(null)}>
        <View style={s.confirmOverlay}>
          <View style={[s.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.confirmTitle, { color: colors.foreground }]}>{confirmDlg?.title}</Text>
            <Text style={[s.confirmMsg, { color: colors.mutedForeground }]}>{confirmDlg?.msg}</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={[s.confirmBtn, { backgroundColor: colors.muted }]} onPress={() => setConfirmDlg(null)}>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confirmBtn, { backgroundColor: colors.primary }]} onPress={() => { confirmDlg?.onOk(); setConfirmDlg(null); }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ── Item card styles ── */
const iCS = StyleSheet.create({
  card: { flex: 1, margin: 4, borderRadius: 10, borderWidth: 1.5, overflow: "hidden", minHeight: 108 },
  colorBar: { height: 4 },
  itemImg: { width: "100%", height: 70 },
  body: { flex: 1, padding: 8, gap: 3 },
  name: { fontSize: 12, fontWeight: "600", lineHeight: 15 },
  price: { fontSize: 13, fontWeight: "700" },
  stockBadge: { position: "absolute", top: -4, right: -4, minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, borderWidth: 2, borderColor: "#fff" },
  stockBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cartBadge: { position: "absolute", top: -4, left: -4, minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff" },
  cartBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
});

/* ── Cart row styles ── */
const cS = StyleSheet.create({
  cartRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  cartName: { fontSize: 13, fontWeight: "600" },
  cartMeta: { fontSize: 11, marginTop: 2 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  qtyBtn: { width: 26, height: 26, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 36, height: 26, textAlign: "center", fontWeight: "700", fontSize: 14, borderBottomWidth: 1 },
  cartTotal: { fontSize: 13, fontWeight: "700", minWidth: 58, textAlign: "right" },
  totals: { borderTopWidth: 1, padding: 14, gap: 6 },
  totRow: { flexDirection: "row", justifyContent: "space-between" },
  totLabel: { fontSize: 13 },
  totVal: { fontSize: 13, fontWeight: "600" },
  grandRow: { marginTop: 6, paddingTop: 6 },
  grandLabel: { fontSize: 17, fontWeight: "700" },
  grandVal: { fontSize: 20, fontWeight: "800" },
});

/* ── Web cart panel styles ── */
const wS = StyleSheet.create({
  panel: { width: 340, borderLeftWidth: 1, flexDirection: "column" },
  panelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: 1 },
  panelTitle: { fontSize: 16, fontWeight: "700" },
  iconBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  panelActions: { borderTopWidth: 1, padding: 14 },
  chargeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 12, height: 52 },
  chargeBtnText: { fontWeight: "800", fontSize: 16 },
});

/* ── Main styles ── */
const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1 },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  storeName: { fontSize: 16, fontWeight: "700" },
  userLine: { fontSize: 11, marginTop: 2 },
  hBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  syncIndicator: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  closeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  closeBtnTxt: { fontSize: 12, fontWeight: "700" },
  lowBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1 },
  lowBarTxt: { flex: 1, fontSize: 12, fontWeight: "600" },
  searchRow: { paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1 },
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, gap: 8, height: 36 },
  searchInput: { flex: 1, fontSize: 14 },
  catBar: { borderBottomWidth: 1 },
  catScroll: { paddingHorizontal: 10, paddingVertical: 7, gap: 7 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 5 },
  catDot: { width: 7, height: 7, borderRadius: 4 },
  chipTxt: { fontSize: 12, fontWeight: "600" },
  mainArea: { flex: 1, flexDirection: "column" },
  mainAreaWide: { flexDirection: "row" },
  grid: { padding: 4 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
  emptyTxt: { fontSize: 14, fontWeight: "500" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 10 },
  discBtn: { padding: 10, position: "relative" },
  discBadge: { position: "absolute", top: 2, right: -2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 8 },
  discBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  cartSummary: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, position: "relative" },
  cartBadge: { position: "absolute", top: -8, left: -8, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cartBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  cartTotal: { fontSize: 16, fontWeight: "700" },
  checkoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12 },
  checkoutTxt: { fontSize: 15, fontWeight: "700" },
  modal: { flex: 1 },
  modalHdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalFooter: { borderTopWidth: 1, padding: 14 },
  totalChip: { borderRadius: 14, borderWidth: 1, padding: 18, alignItems: "center", gap: 6 },
  totalChipLbl: { fontSize: 13 },
  totalChipVal: { fontSize: 34, fontWeight: "800" },
  secLbl: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  payTypeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5 },
  amtRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14 },
  amtSign: { fontSize: 22, fontWeight: "700", marginRight: 4 },
  amtInput: { flex: 1, height: 56, fontSize: 26, fontWeight: "700" },
  changeBox: { borderRadius: 12, borderWidth: 1, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  changeLbl: { fontSize: 14, fontWeight: "600" },
  changeVal: { fontSize: 22, fontWeight: "800" },
  quickAmt: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%" },
  discRule: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 12 },
  divider: { borderTopWidth: 1, marginVertical: 4 },
  typeToggle: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  discInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 40 },
  applyBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  removeDiscBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, justifyContent: "center" },
  toggleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  summaryTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLbl: { fontSize: 13 },
  summaryVal: { fontSize: 13, fontWeight: "600" },
  diffBox: { borderRadius: 12, borderWidth: 1, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  diffLbl: { fontSize: 14, fontWeight: "600" },
  diffVal: { fontSize: 22, fontWeight: "800" },
  txCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 10 },
  txReceipt: { fontSize: 13, fontWeight: "700" },
  txMeta: { fontSize: 11, marginTop: 2 },
  txTotal: { fontSize: 15, fontWeight: "700", marginRight: 6 },
  refundBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  toast: { position: "absolute", bottom: 120, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 40, maxWidth: 360 },
  toastTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 32 },
  confirmBox: { borderRadius: 16, borderWidth: 1, padding: 24, gap: 12, width: "100%", maxWidth: 360 },
  confirmTitle: { fontSize: 18, fontWeight: "700" },
  confirmMsg: { fontSize: 14, lineHeight: 20 },
  confirmBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  confirmBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
