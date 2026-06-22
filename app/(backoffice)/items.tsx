import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import {
  Animated, FlatList, Image, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";

import { useStore } from "@/context/StoreContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import type { Item } from "@/types";
import { formatCurrency } from "@/utils/format";

type ConfirmState = { msg: string; onOk: () => void } | null;

export default function ItemsScreen() {
  const colors = useColors();
  const { items, categories, taxRates, addItem, updateItem, deleteItem } = useStore();
  const { currencySymbol } = useTheme();

  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  const [fname, setFname] = useState("");
  const [fprice, setFprice] = useState("");
  const [fcost, setFcost] = useState("");
  const [fcatId, setFcatId] = useState("");
  const [fstock, setFstock] = useState("");
  const [fminStock, setFminStock] = useState("");
  const [ftaxId, setFtaxId] = useState("");
  const [fimageUri, setFimageUri] = useState<string | null>(null);

  const filteredItems = useMemo(() =>
    items.filter(i =>
      (!selectedCat || i.categoryId === selectedCat) &&
      i.name.toLowerCase().includes(search.toLowerCase())
    ), [items, selectedCat, search]);

  async function pickImage() {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { showToast("Photo library access denied."); return; }
    }
    setImageLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setFimageUri(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setFimageUri(asset.uri);
        }
      }
    } catch {
      showToast("Could not load image.");
    } finally {
      setImageLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setFname(""); setFprice(""); setFcost("");
    setFcatId(categories[0]?.id ?? "");
    setFstock("0"); setFminStock("5");
    setFtaxId(taxRates.find(t => t.isDefault)?.id ?? "");
    setFimageUri(null);
    setShowModal(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setFname(item.name); setFprice(String(item.price)); setFcost(String(item.cost));
    setFcatId(item.categoryId); setFstock(String(item.stock)); setFminStock(String(item.minStock));
    setFtaxId(item.taxRateId ?? "");
    setFimageUri(item.imageUri);
    setShowModal(true);
  }

  function handleSave() {
    if (!fname.trim()) { showToast("Item name is required."); return; }
    const price = parseFloat(fprice);
    const cost = parseFloat(fcost);
    if (isNaN(price) || price < 0) { showToast("Enter a valid price."); return; }
    const data = {
      name: fname.trim(), price, cost: isNaN(cost) ? 0 : cost,
      categoryId: fcatId, stock: parseInt(fstock) || 0,
      minStock: parseInt(fminStock) || 0, taxRateId: ftaxId || null,
      imageUri: fimageUri, barcode: null, active: true,
    };
    if (editing) { updateItem(editing.id, data); showToast("Item updated."); }
    else { addItem(data); showToast("Item added."); }
    setShowModal(false);
  }

  function confirmDelete(item: Item) {
    setConfirmState({ msg: `Delete "${item.name}"?`, onOk: () => { deleteItem(item.id); showToast("Item deleted."); } });
  }

  function getMarkup(price: number, cost: number) {
    if (cost <= 0) return "—";
    return `${(((price - cost) / cost) * 100).toFixed(0)}%`;
  }

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Search row */}
      <View style={[s.searchRow, { borderBottomColor: colors.border }]}>
        <View style={[s.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput style={[s.searchTxt, { color: colors.foreground }]} value={search} onChangeText={setSearch} placeholder="Search items…" placeholderTextColor={colors.mutedForeground} />
          {search !== "" ? <TouchableOpacity onPress={() => setSearch("")}><Feather name="x" size={14} color={colors.mutedForeground} /></TouchableOpacity> : null}
        </View>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
          <Feather name="plus" size={15} color="#fff" />
          <Text style={s.addBtnTxt}>Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.catScroll, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={[s.catChip, { backgroundColor: !selectedCat ? colors.primary : colors.surface, borderColor: !selectedCat ? colors.primary : colors.border }]} onPress={() => setSelectedCat(null)}>
          <Text style={{ color: !selectedCat ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 12 }}>All</Text>
        </TouchableOpacity>
        {categories.map(cat => (
          <TouchableOpacity key={cat.id} style={[s.catChip, { backgroundColor: selectedCat === cat.id ? cat.color + "33" : colors.surface, borderColor: selectedCat === cat.id ? cat.color : colors.border }]} onPress={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}>
            <View style={[s.catDot, { backgroundColor: cat.color }]} />
            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 12 }}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items list */}
      <FlatList
        data={filteredItems}
        keyExtractor={i => i.id}
        renderItem={({ item }) => {
          const cat = categories.find(c => c.id === item.categoryId);
          const isLow = item.stock <= item.minStock;
          const markup = getMarkup(item.price, item.cost);
          return (
            <View style={[s.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity onPress={() => openEdit(item)} style={[s.itemTouchable, { flex: 1 }]} activeOpacity={0.8}>
                <View style={s.imgWrap}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={s.imgThumb} />
                  ) : (
                    <View style={[s.imgPlaceholder, { backgroundColor: (cat?.color ?? colors.primary) + "22" }]}>
                      <Feather name="package" size={22} color={cat?.color ?? colors.mutedForeground} />
                    </View>
                  )}
                  <View style={[s.stockBadge, { backgroundColor: isLow ? colors.destructive : colors.success }]}>
                    <Text style={s.stockBadgeTxt}>{item.stock}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemName, { color: colors.foreground }]}>{item.name}</Text>
                  <Text style={[s.itemMeta, { color: colors.mutedForeground }]}>
                    {cat?.name}
                    {item.cost > 0 ? `  ·  Cost: ${formatCurrency(item.cost, currencySymbol)}  ·  Markup: ${markup}` : ""}
                  </Text>
                  <Text style={[s.itemPrice, { color: colors.primary }]}>{formatCurrency(item.price, currencySymbol)}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)} style={s.deleteBtn}>
                <Feather name="trash-2" size={16} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Feather name="package" size={40} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15, fontWeight: "600", marginTop: 12 }}>No items found</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[s.modal, { backgroundColor: colors.background }]}>
          <View style={[s.modalHdr, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>{editing ? "Edit Item" : "New Item"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Image picker */}
            <View style={s.imgPickerRow}>
              <TouchableOpacity onPress={pickImage} style={s.imgPickerBtn} activeOpacity={0.8} disabled={imageLoading}>
                {fimageUri ? (
                  <Image source={{ uri: fimageUri }} style={s.imgPickerImg} />
                ) : (
                  <View style={[s.imgPickerPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Feather name={imageLoading ? "loader" : "camera"} size={28} color={colors.mutedForeground} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 6 }}>
                      {imageLoading ? "Loading…" : "Add Photo"}
                    </Text>
                  </View>
                )}
                <View style={[s.imgPickerBadge, { backgroundColor: colors.primary }]}>
                  <Feather name="camera" size={13} color="#fff" />
                </View>
              </TouchableOpacity>
              {fimageUri ? (
                <TouchableOpacity onPress={() => setFimageUri(null)} style={{ marginTop: 8 }}>
                  <Text style={{ color: colors.destructive, fontSize: 12, fontWeight: "600" }}>Remove Photo</Text>
                </TouchableOpacity>
              ) : null}
              {fimageUri ? (
                <Text style={{ color: colors.success, fontSize: 11, marginTop: 4, textAlign: "center" }}>
                  ✓ Image saved with item
                </Text>
              ) : null}
            </View>

            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Item Name</Text>
              <TextInput style={[s.fieldInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} value={fname} onChangeText={setFname} placeholder="e.g. Burger" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{"Price (" + currencySymbol + ")"}</Text>
                <TextInput style={[s.fieldInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} value={fprice} onChangeText={setFprice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{"Cost (" + currencySymbol + ")"}</Text>
                <TextInput style={[s.fieldInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} value={fcost} onChangeText={setFcost} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>
            {fprice !== "" && fcost !== "" && parseFloat(fcost) > 0 ? (
              <View style={[s.markupHint, { backgroundColor: colors.success + "1A" }]}>
                <Text style={{ color: colors.success, fontSize: 12, fontWeight: "600" }}>
                  {"Markup: " + getMarkup(parseFloat(fprice), parseFloat(fcost)) + "  ·  Profit: " + formatCurrency(parseFloat(fprice) - parseFloat(fcost), currencySymbol)}
                </Text>
              </View>
            ) : null}
            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Stock</Text>
                <TextInput style={[s.fieldInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} value={fstock} onChangeText={setFstock} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Min Stock Alert</Text>
                <TextInput style={[s.fieldInput, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border }]} value={fminStock} onChangeText={setFminStock} keyboardType="number-pad" placeholder="5" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
              <View style={s.optionRow}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat.id} style={[s.optionChip, { backgroundColor: fcatId === cat.id ? cat.color + "33" : colors.surface, borderColor: fcatId === cat.id ? cat.color : colors.border }]} onPress={() => setFcatId(cat.id)}>
                    <View style={[s.catDot, { backgroundColor: cat.color }]} />
                    <Text style={{ color: fcatId === cat.id ? cat.color : colors.foreground, fontWeight: "600", fontSize: 13 }}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Tax Rate</Text>
              <View style={s.optionRow}>
                <TouchableOpacity style={[s.optionChip, { backgroundColor: !ftaxId ? colors.primary + "22" : colors.surface, borderColor: !ftaxId ? colors.primary : colors.border }]} onPress={() => setFtaxId("")}>
                  <Text style={{ color: !ftaxId ? colors.primary : colors.foreground, fontWeight: "600", fontSize: 13 }}>No Tax</Text>
                </TouchableOpacity>
                {taxRates.map(tax => (
                  <TouchableOpacity key={tax.id} style={[s.optionChip, { backgroundColor: ftaxId === tax.id ? colors.primary + "22" : colors.surface, borderColor: ftaxId === tax.id ? colors.primary : colors.border }]} onPress={() => setFtaxId(tax.id)}>
                    <Text style={{ color: ftaxId === tax.id ? colors.primary : colors.foreground, fontWeight: "600", fontSize: 13 }}>{tax.name + " (" + tax.rate + "%)"}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
              <Text style={s.saveBtnTxt}>{editing ? "Save Changes" : "Add Item"}</Text>
            </TouchableOpacity>
            <View style={{ height: 60 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Toast */}
      {toast !== null ? (
        <View style={[s.toast, { backgroundColor: colors.foreground }]}>
          <Text style={{ color: colors.background, fontWeight: "700", fontSize: 13 }}>{toast}</Text>
        </View>
      ) : null}

      {/* Confirm dialog */}
      <Modal visible={confirmState !== null} animationType="fade" transparent onRequestClose={() => setConfirmState(null)}>
        <View style={s.confirmOverlay}>
          <View style={[s.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.confirmMsg, { color: colors.foreground }]}>{confirmState?.msg}</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.confirmBtn, { backgroundColor: colors.muted }]} onPress={() => setConfirmState(null)}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.confirmBtn, { backgroundColor: colors.destructive }]} onPress={() => { confirmState?.onOk(); setConfirmState(null); }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, height: 38 },
  searchTxt: { flex: 1, fontSize: 14 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  addBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  catScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1 },
  catChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 5 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  itemCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginVertical: 5, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  itemTouchable: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  imgWrap: { position: "relative", width: 64, height: 64, flexShrink: 0 },
  imgThumb: { width: 64, height: 64, borderRadius: 10 },
  imgPlaceholder: { width: 64, height: 64, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stockBadge: { position: "absolute", top: -7, right: -7, minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff" },
  stockBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  itemName: { fontSize: 14, fontWeight: "700" },
  itemMeta: { fontSize: 11, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  deleteBtn: { padding: 16 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 60 },
  modal: { flex: 1 },
  modalHdr: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: Platform.OS === "web" ? 20 : 56, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  imgPickerRow: { alignItems: "center", padding: 20, paddingBottom: 8 },
  imgPickerBtn: { position: "relative" },
  imgPickerImg: { width: 100, height: 100, borderRadius: 16 },
  imgPickerPlaceholder: { width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  imgPickerBadge: { position: "absolute", bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  field: { paddingHorizontal: 20, marginTop: 16 },
  fieldLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 15 },
  twoCol: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 16 },
  markupHint: { marginHorizontal: 20, marginTop: 8, padding: 10, borderRadius: 8 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  saveBtn: { marginHorizontal: 20, marginTop: 24, borderRadius: 12, height: 52, alignItems: "center", justifyContent: "center" },
  saveBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  toast: { position: "absolute", bottom: 40, alignSelf: "center", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 40 },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 32 },
  confirmBox: { borderRadius: 16, borderWidth: 1, padding: 24, width: "100%", maxWidth: 340 },
  confirmMsg: { fontSize: 16, fontWeight: "600" },
  confirmBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
