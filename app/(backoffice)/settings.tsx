import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal, Platform, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useSync } from "@/context/SyncContext";
import { useTheme } from "@/context/ThemeContext";
import { useWipeAllData } from "@/hooks/useWipeAllData";
import { useColors } from "@/hooks/useColors";
import type { Category, DiscountRule, TaxRate } from "@/types";

type Section = "store" | "categories" | "taxes" | "discounts" | "access" | "appearance" | "sync";
type Confirm = { msg: string; onOk: () => void } | null;

const PRESET_COLORS = ["#5865F2","#ED4245","#3BA55D","#FAA61A","#EB459E","#1ABC9C","#E67E22","#9B59B6","#3498DB","#2ECC71"];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { users, updateUser } = useAuth();
  const { store, categories, taxRates, discountRules, updateStore, addCategory, updateCategory, deleteCategory, addTaxRate, updateTaxRate, deleteTaxRate, addDiscountRule, updateDiscountRule, deleteDiscountRule } = useStore();
  const { theme, setThemeOption, currencySymbol, setCurrencySymbol } = useTheme();
  const { isOnline, isSyncing, lastSyncAt, pendingSync, serverUrl, syncNow } = useSync();
  const { wipeAllData, canWipe } = useWipeAllData();

  const [activeSection, setActiveSection] = useState<Section>("store");
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [wipeModal, setWipeModal] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }
  function showConfirm(msg: string, onOk: () => void) {
    setConfirm({ msg, onOk });
  }

  // Store form
  const [storeName, setStoreName] = useState(store.name);
  const [storeAddress, setStoreAddress] = useState(store.address ?? "");
  const [storePhone, setStorePhone] = useState(store.phone ?? "");
  const [storeEmail, setStoreEmail] = useState(store.email ?? "");
  const [storeFooter, setStoreFooter] = useState(store.receiptFooter ?? "");
  const [currency, setCurrency] = useState(currencySymbol);

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);

  // Tax modal
  const [taxModal, setTaxModal] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRate | null>(null);
  const [taxName, setTaxName] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [taxDefault, setTaxDefault] = useState(false);

  // Discount modal
  const [discModal, setDiscModal] = useState(false);
  const [editingDisc, setEditingDisc] = useState<DiscountRule | null>(null);
  const [discName, setDiscName] = useState("");
  const [discType, setDiscType] = useState<"percent" | "amount">("percent");
  const [discVal, setDiscVal] = useState("");
  const [discReqApproval, setDiscReqApproval] = useState(false);

  function saveStore() {
    if (!storeName.trim()) { showToast("Store name is required."); return; }
    updateStore({ name: storeName.trim(), address: storeAddress, phone: storePhone, email: storeEmail, receiptFooter: storeFooter });
    setCurrencySymbol(currency || "$");
    showToast("Store settings saved.");
  }

  function saveCat() {
    if (!catName.trim()) return;
    if (editingCat) { updateCategory(editingCat.id, { name: catName.trim(), color: catColor }); }
    else { addCategory({ name: catName.trim(), color: catColor }); }
    setCatModal(false);
    showToast(editingCat ? "Category updated." : "Category added.");
  }

  function saveTax() {
    if (!taxName.trim()) return;
    const rate = parseFloat(taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { showToast("Tax rate must be 0 – 100."); return; }
    if (editingTax) { updateTaxRate(editingTax.id, { name: taxName.trim(), rate, isDefault: taxDefault }); }
    else { addTaxRate({ name: taxName.trim(), rate, isDefault: taxDefault }); }
    setTaxModal(false);
    showToast(editingTax ? "Tax rate updated." : "Tax rate added.");
  }

  function saveDisc() {
    if (!discName.trim()) return;
    const val = parseFloat(discVal);
    if (isNaN(val) || val <= 0) return;
    if (editingDisc) { updateDiscountRule(editingDisc.id, { name: discName.trim(), type: discType, value: val, requiresApproval: discReqApproval, active: true }); }
    else { addDiscountRule({ name: discName.trim(), type: discType, value: val, requiresApproval: discReqApproval, active: true }); }
    setDiscModal(false);
    showToast(editingDisc ? "Discount updated." : "Discount rule added.");
  }

  const SECTIONS: { key: Section; label: string; icon: string }[] = [
    { key: "store", label: "Store", icon: "shopping-bag" },
    { key: "appearance", label: "Appearance", icon: "sun" },
    { key: "categories", label: "Categories", icon: "tag" },
    { key: "taxes", label: "Taxes", icon: "percent" },
    { key: "discounts", label: "Discounts", icon: "gift" },
    { key: "sync", label: "Sync", icon: "cloud" },
    { key: "access", label: "Access Rights", icon: "shield" },
  ];

  const PERMISSION_LABELS: Record<string, string> = {
    acceptPayments: "Accept Payments",
    applyDiscounts: "Apply Discounts",
    applyRestrictedDiscounts: "Apply Restricted Discounts",
    changeTaxes: "Change Taxes",
    manageOpenTickets: "Manage Open Tickets",
    voidSavedItems: "Void Saved Items",
    openCashDrawer: "Manage Cash Drawer",
    viewCosts: "View Cost Prices",
    viewReceipts: "View Receipts",
    performRefunds: "Process Refunds",
    accessBackOffice: "Access Back Office",
    manageItems: "Manage Inventory",
    manageEmployees: "Manage Employees",
    viewReports: "View Reports",
    manageSettings: "Manage Settings",
  };

  /* ── Section renderers ── */

  function renderStore() {
    return (
      <ScrollView contentContainerStyle={st.section} keyboardShouldPersistTaps="handled">
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Store Information</Text>
        {[
          { label: "Store Name", value: storeName, setter: setStoreName, placeholder: "My Store" },
          { label: "Address", value: storeAddress, setter: setStoreAddress, placeholder: "123 Main St" },
          { label: "Phone", value: storePhone, setter: setStorePhone, placeholder: "+1 (555) 000-0000" },
          { label: "Email", value: storeEmail, setter: setStoreEmail, placeholder: "store@example.com" },
          { label: "Receipt Footer", value: storeFooter, setter: setStoreFooter, placeholder: "Thank you for your purchase!" },
          { label: "Currency Symbol", value: currency, setter: setCurrency, placeholder: "$" },
        ].map(f => (
          <View key={f.label} style={st.field}>
            <Text style={[st.label, { color: colors.mutedForeground }]}>{f.label}</Text>
            <TextInput style={[st.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={f.value} onChangeText={f.setter} placeholder={f.placeholder} placeholderTextColor={colors.mutedForeground} />
          </View>
        ))}
        <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.primary }]} onPress={saveStore}>
          <Text style={st.saveBtnText}>Save Store Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderAppearance() {
    return (
      <ScrollView contentContainerStyle={st.section} keyboardShouldPersistTaps="handled">
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Appearance</Text>
        <View style={[st.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Feather name={theme === "dark" ? "moon" : "sun"} size={20} color={colors.foreground} />
            <Text style={[st.rowLabel, { color: colors.foreground }]}>{theme === "dark" ? "Dark Mode" : "Light Mode"}</Text>
          </View>
          <Switch value={theme === "dark"} onValueChange={v => setThemeOption(v ? "dark" : "light")} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor="#fff" />
        </View>
      </ScrollView>
    );
  }

  function renderCategories() {
    return (
      <ScrollView contentContainerStyle={[st.section, { gap: 8 }]}>
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Categories</Text>
        {categories.map(cat => (
          <View key={cat.id} style={[st.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
              onPress={() => { setEditingCat(cat); setCatName(cat.name); setCatColor(cat.color); setCatModal(true); }}
            >
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: cat.color }} />
              <Text style={[st.listName, { color: colors.foreground }]}>{cat.name}</Text>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={st.deleteBtn}
              onPress={() => showConfirm(`Delete category "${cat.name}"?`, () => { deleteCategory(cat.id); showToast("Category deleted."); })}
            >
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={[st.addRowBtn, { borderColor: colors.border }]} onPress={() => { setEditingCat(null); setCatName(""); setCatColor(PRESET_COLORS[0]); setCatModal(true); }}>
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Add Category</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderTaxes() {
    return (
      <ScrollView contentContainerStyle={[st.section, { gap: 8 }]}>
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Tax Rates</Text>
        {taxRates.map(tax => (
          <View key={tax.id} style={[st.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
              onPress={() => { setEditingTax(tax); setTaxName(tax.name); setTaxRate(String(tax.rate)); setTaxDefault(tax.isDefault); setTaxModal(true); }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.warning + "22", alignItems: "center", justifyContent: "center" }}>
                <Feather name="percent" size={16} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.listName, { color: colors.foreground }]}>{tax.name}</Text>
                <Text style={[st.listMeta, { color: colors.mutedForeground }]}>
                  {tax.rate}
                  {"%" + (tax.isDefault ? " · Default" : "")}
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={st.deleteBtn}
              onPress={() => showConfirm(`Delete tax rate "${tax.name}"?`, () => { deleteTaxRate(tax.id); showToast("Tax rate deleted."); })}
            >
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={[st.addRowBtn, { borderColor: colors.border }]} onPress={() => { setEditingTax(null); setTaxName(""); setTaxRate(""); setTaxDefault(false); setTaxModal(true); }}>
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Add Tax Rate</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderDiscounts() {
    return (
      <ScrollView contentContainerStyle={[st.section, { gap: 8 }]}>
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Discount Rules</Text>
        {discountRules.map(rule => (
          <View key={rule.id} style={[st.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
              onPress={() => { setEditingDisc(rule); setDiscName(rule.name); setDiscType(rule.type); setDiscVal(String(rule.value)); setDiscReqApproval(rule.requiresApproval); setDiscModal(true); }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.success + "22", alignItems: "center", justifyContent: "center" }}>
                <Feather name="gift" size={16} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.listName, { color: colors.foreground }]}>{rule.name}</Text>
                <Text style={[st.listMeta, { color: colors.mutedForeground }]}>
                  {rule.type === "percent" ? `${rule.value}% off` : `${currencySymbol}${rule.value} off`}
                  {rule.requiresApproval ? " · Manager required" : ""}
                </Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={st.deleteBtn}
              onPress={() => showConfirm(`Delete discount "${rule.name}"?`, () => { deleteDiscountRule(rule.id); showToast("Discount deleted."); })}
            >
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={[st.addRowBtn, { borderColor: colors.border }]} onPress={() => { setEditingDisc(null); setDiscName(""); setDiscType("percent"); setDiscVal(""); setDiscReqApproval(false); setDiscModal(true); }}>
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Add Discount Rule</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  function renderSync() {
    const statusColor = isSyncing ? colors.warning : isOnline ? colors.success : colors.destructive;
    const statusLabel = isSyncing ? "Syncing…" : isOnline ? "Online" : "Offline";

    return (
      <ScrollView contentContainerStyle={st.section}>
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Cloud Sync</Text>

        <View style={[st.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[st.statusDot, { backgroundColor: statusColor }]} />
        </View>

        <View style={[st.syncCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={st.syncRow}>
            <Text style={[st.syncLabel, { color: colors.mutedForeground }]}>Status</Text>
            <Text style={[st.syncVal, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <View style={st.syncRow}>
            <Text style={[st.syncLabel, { color: colors.mutedForeground }]}>Last sync</Text>
            <Text style={[st.syncVal, { color: colors.foreground }]}>
              {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Never"}
            </Text>
          </View>
          <View style={st.syncRow}>
            <Text style={[st.syncLabel, { color: colors.mutedForeground }]}>Pending changes</Text>
            <Text style={[st.syncVal, { color: pendingSync ? colors.warning : colors.success }]}>
              {pendingSync ? "Yes — will sync when online" : "None"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[st.saveBtn, { backgroundColor: isSyncing ? colors.muted : colors.primary }]}
          onPress={async () => {
            const ok = await syncNow();
            showToast(ok ? "Sync complete." : "Sync failed — check connection and try again.");
          }}
          disabled={isSyncing}
        >
          <Text style={st.saveBtnText}>{isSyncing ? "Syncing…" : "Sync Now"}</Text>
        </TouchableOpacity>

        {canWipe ? (
          <>
            <Text style={[st.sectionTitle, { color: colors.destructive, marginTop: 24 }]}>Danger Zone</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>
              Permanently deletes all items, sales, employees, shifts, and settings on this device and in the cloud. This cannot be undone.
            </Text>
            <TouchableOpacity
              style={[st.saveBtn, { backgroundColor: colors.destructive }]}
              onPress={() => { setWipeConfirmText(""); setWipeModal(true); }}
              disabled={wiping}
            >
              <Text style={st.saveBtnText}>{wiping ? "Wiping…" : "Wipe All Data"}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    );
  }

  function renderAccessRights() {
    return (
      <ScrollView contentContainerStyle={st.section}>
        <Text style={[st.sectionTitle, { color: colors.foreground }]}>Access Rights</Text>
        {users.map(u => (
          <View key={u.id} style={[st.accessCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{u.name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                {"@" + u.username + " · " + u.role}
              </Text>
            </View>
            {Object.entries(u.permissions).map(([perm, val]) => (
              <View key={perm} style={st.permRow}>
                <Text style={[st.permLabel, { color: colors.foreground }]}>{PERMISSION_LABELS[perm] ?? perm}</Text>
                <Switch
                  value={val as boolean}
                  onValueChange={v => updateUser(u.id, { permissions: { ...u.permissions, [perm]: v } })}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  }

  const sectionContent: Record<Section, React.ReactNode> = {
    store: renderStore(),
    appearance: renderAppearance(),
    categories: renderCategories(),
    taxes: renderTaxes(),
    discounts: renderDiscounts(),
    sync: renderSync(),
    access: renderAccessRights(),
  };

  return (
    <View style={[st.screen, { backgroundColor: colors.background }]}>
      {/* Sidebar / tab row */}
      {Platform.OS === "web" ? (
        <View style={[st.sidebar, { backgroundColor: colors.sidebar, borderRightColor: colors.border }]}>
          <ScrollView contentContainerStyle={{ padding: 8 }}>
            {SECTIONS.map(sec => (
              <TouchableOpacity key={sec.key} style={[st.navBtn, { backgroundColor: activeSection === sec.key ? colors.primary + "22" : "transparent" }]} onPress={() => setActiveSection(sec.key)}>
                <Feather name={sec.icon as any} size={16} color={activeSection === sec.key ? colors.primary : colors.mutedForeground} />
                <Text style={[st.navText, { color: activeSection === sec.key ? colors.primary : colors.foreground }]}>{sec.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: "center" }}>
          {SECTIONS.map(sec => (
            <TouchableOpacity key={sec.key} style={[{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 6 }, { backgroundColor: activeSection === sec.key ? colors.primary : colors.surface, borderColor: activeSection === sec.key ? colors.primary : colors.border }]} onPress={() => setActiveSection(sec.key)}>
              <Feather name={sec.icon as any} size={13} color={activeSection === sec.key ? "#fff" : colors.mutedForeground} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: activeSection === sec.key ? "#fff" : colors.foreground }}>{sec.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={{ flex: 1 }}>{sectionContent[activeSection]}</View>

      {/* Category Modal */}
      <Modal visible={catModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCatModal(false)}>
        <View style={[st.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[st.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 20 }]}>
            <Text style={[st.modalTitle, { color: colors.foreground }]}>{editingCat ? "Edit Category" : "New Category"}</Text>
            <TouchableOpacity onPress={() => setCatModal(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={st.mField}>
              <Text style={[st.mLabel, { color: colors.mutedForeground }]}>Category Name</Text>
              <TextInput style={[st.mInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={catName} onChangeText={setCatName} placeholder="e.g. Food" placeholderTextColor={colors.mutedForeground} autoFocus />
            </View>
            <View style={st.mField}>
              <Text style={[st.mLabel, { color: colors.mutedForeground }]}>Color</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {PRESET_COLORS.map(c => (
                  <TouchableOpacity key={c} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: catColor === c ? 3 : 0, borderColor: "#fff", opacity: catColor === c ? 1 : 0.7 }} onPress={() => setCatColor(c)} />
                ))}
              </View>
              {catColor ? <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: catColor, marginTop: 8 }} /> : null}
            </View>
            <TouchableOpacity style={[st.mSave, { backgroundColor: colors.primary }]} onPress={saveCat}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{editingCat ? "Save Changes" : "Add Category"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Tax Modal */}
      <Modal visible={taxModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTaxModal(false)}>
        <View style={[st.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[st.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 20 }]}>
            <Text style={[st.modalTitle, { color: colors.foreground }]}>{editingTax ? "Edit Tax" : "New Tax Rate"}</Text>
            <TouchableOpacity onPress={() => setTaxModal(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={st.mField}>
              <Text style={[st.mLabel, { color: colors.mutedForeground }]}>Tax Name</Text>
              <TextInput style={[st.mInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={taxName} onChangeText={setTaxName} placeholder="e.g. GCT" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={st.mField}>
              <Text style={[st.mLabel, { color: colors.mutedForeground }]}>Rate (%)</Text>
              <TextInput style={[st.mInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={taxRate} onChangeText={setTaxRate} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={[st.mField, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
              <Text style={[st.mLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Set as Default</Text>
              <Switch value={taxDefault} onValueChange={setTaxDefault} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor="#fff" />
            </View>
            <TouchableOpacity style={[st.mSave, { backgroundColor: colors.primary }]} onPress={saveTax}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{editingTax ? "Save Changes" : "Add Tax"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Discount Modal */}
      <Modal visible={discModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDiscModal(false)}>
        <View style={[st.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[st.modalHeader, { borderBottomColor: colors.border, paddingTop: insets.top + 20 }]}>
            <Text style={[st.modalTitle, { color: colors.foreground }]}>{editingDisc ? "Edit Discount" : "New Discount Rule"}</Text>
            <TouchableOpacity onPress={() => setDiscModal(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={st.mField}>
              <Text style={[st.mLabel, { color: colors.mutedForeground }]}>Name</Text>
              <TextInput style={[st.mInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={discName} onChangeText={setDiscName} placeholder="e.g. Senior Discount" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={st.mField}>
              <Text style={[st.mLabel, { color: colors.mutedForeground }]}>Discount Type</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {(["percent", "amount"] as const).map(t => (
                  <TouchableOpacity key={t} style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1.5, alignItems: "center", backgroundColor: discType === t ? colors.primary + "22" : colors.surface, borderColor: discType === t ? colors.primary : colors.border }} onPress={() => setDiscType(t)}>
                    <Text style={{ color: discType === t ? colors.primary : colors.foreground, fontWeight: "700", fontSize: 13 }}>{t === "percent" ? "Percent (%)" : "Fixed Amount"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={st.mField}>
              <Text style={[st.mLabel, { color: colors.mutedForeground }]}>Value</Text>
              <TextInput style={[st.mInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]} value={discVal} onChangeText={setDiscVal} keyboardType="decimal-pad" placeholder="10" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={[st.mField, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
              <Text style={[st.mLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>Requires Manager Approval</Text>
              <Switch value={discReqApproval} onValueChange={setDiscReqApproval} trackColor={{ false: colors.muted, true: colors.primary }} thumbColor="#fff" />
            </View>
            <TouchableOpacity style={[st.mSave, { backgroundColor: colors.primary }]} onPress={saveDisc}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{editingDisc ? "Save Changes" : "Add Discount"}</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Toast */}
      {toast !== null ? (
        <View style={[st.toast, { backgroundColor: colors.foreground }]}>
          <Text style={{ color: colors.background, fontWeight: "700", fontSize: 13 }}>{toast}</Text>
        </View>
      ) : null}

      {/* Confirm dialog */}
      <Modal visible={confirm !== null} animationType="fade" transparent onRequestClose={() => setConfirm(null)}>
        <View style={st.confirmOverlay}>
          <View style={[st.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[st.confirmMsg, { color: colors.foreground }]}>{confirm?.msg}</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[st.confirmBtn, { backgroundColor: colors.muted }]} onPress={() => setConfirm(null)}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.confirmBtn, { backgroundColor: colors.destructive }]} onPress={() => { confirm?.onOk(); setConfirm(null); }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Wipe all data dialog */}
      <Modal visible={wipeModal} animationType="fade" transparent onRequestClose={() => !wiping && setWipeModal(false)}>
        <View style={st.confirmOverlay}>
          <View style={[st.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[st.confirmMsg, { color: colors.foreground }]}>Wipe All Data</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20, marginTop: 8 }}>
              This permanently deletes all items, sales, employees, shifts, and settings on device and cloud. You will be logged out. Type DELETE to confirm.
            </Text>
            <TextInput
              style={[st.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, marginTop: 16 }]}
              value={wipeConfirmText}
              onChangeText={setWipeConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              editable={!wiping}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[st.confirmBtn, { backgroundColor: colors.muted }]} onPress={() => setWipeModal(false)} disabled={wiping}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.confirmBtn, { backgroundColor: wipeConfirmText === "DELETE" ? colors.destructive : colors.muted }]}
                disabled={wipeConfirmText !== "DELETE" || wiping}
                onPress={async () => {
                  setWiping(true);
                  const result = await wipeAllData();
                  setWiping(false);
                  setWipeModal(false);
                  if (!result.ok) {
                    showToast(result.error ?? "Wipe failed.");
                  }
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>{wiping ? "Wiping…" : "Wipe Everything"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column" },
  sidebar: { width: 180, borderRightWidth: 1 },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginVertical: 1 },
  navText: { fontSize: 13, fontWeight: "600" },
  section: { padding: 20, gap: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15 },
  saveBtn: { borderRadius: 10, height: 48, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 12, borderWidth: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  listItem: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  listName: { flex: 1, fontSize: 14, fontWeight: "600" },
  listMeta: { fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 14 },
  addRowBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", justifyContent: "center" },
  accessCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  permRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  permLabel: { fontSize: 13, flex: 1 },
  modalScreen: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  mField: { paddingHorizontal: 20, marginTop: 16, gap: 6 },
  mLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  mInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15 },
  mSave: { margin: 20, borderRadius: 12, height: 52, alignItems: "center", justifyContent: "center" },
  toast: { position: "absolute", bottom: 40, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 40, maxWidth: 360 },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 32 },
  confirmBox: { borderRadius: 16, borderWidth: 1, padding: 24, width: "100%", maxWidth: 340, gap: 4 },
  confirmMsg: { fontSize: 16, fontWeight: "600" },
  confirmBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  syncCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
  syncRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  syncLabel: { fontSize: 13 },
  syncVal: { fontSize: 13, fontWeight: "600" },
});