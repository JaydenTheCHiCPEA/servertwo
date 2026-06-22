import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert, FlatList, Modal, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, getDefaultPermissions } from "@/context/AuthContext";
import { useShift } from "@/context/ShiftContext";
import { useTheme } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import type { User, UserRole } from "@/types";
import { formatCurrency, formatDateTime, formatDuration } from "@/utils/format";

const ASSIGNABLE_ROLES: UserRole[] = ["cashier", "manager"];
const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#ED4245",
  manager: "#FAA61A",
  cashier: "#3BA55D",
};

export default function EmployeesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { users, addUser, updateUser, deleteUser } = useAuth();
  const { allShifts } = useShift();
  const { currencySymbol } = useTheme();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [showTimecard, setShowTimecard] = useState<User | null>(null);

  const [fname, setFname] = useState("");
  const [fusername, setFusername] = useState("");
  const [fpassword, setFpassword] = useState("");
  const [frole, setFrole] = useState<UserRole>("cashier");
  const [fsalary, setFsalary] = useState("");
  const [fhourly, setFhourly] = useState("");
  const [showPw, setShowPw] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : 0;

  function openAdd() {
    setEditing(null);
    setFname(""); setFusername(""); setFpassword(""); setFrole("cashier"); setFsalary(""); setFhourly("");
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setFname(u.name); setFusername(u.username); setFpassword(u.password);
    setFrole(u.role); setFsalary(String(u.salary)); setFhourly(String(u.hourlyRate));
    setShowModal(true);
  }

  function handleSave() {
    if (!fname.trim() || !fusername.trim() || !fpassword.trim()) {
      Alert.alert("Missing Info", "Name, username, and password are required.");
      return;
    }
    if (!editing && frole === "admin") {
      Alert.alert("Not Allowed", "Additional admin accounts cannot be created.");
      return;
    }
    const data = {
      name: fname.trim(), username: fusername.trim().toLowerCase(), password: fpassword,
      role: frole, salary: parseFloat(fsalary) || 0, hourlyRate: parseFloat(fhourly) || 0,
      permissions: editing ? editing.permissions : getDefaultPermissions(frole),
      active: true,
    };
    if (editing) { updateUser(editing.id, data); }
    else { addUser(data); }
    setShowModal(false);
  }

  function handleDelete(u: User) {
    Alert.alert("Remove Employee", `Remove ${u.name} from the system?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteUser(u.id) },
    ]);
  }

  function getUserShifts(userId: string) {
    return allShifts.filter(s => s.employeeId === userId);
  }

  function getTotalHours(userId: string): string {
    const shifts = getUserShifts(userId).filter(s => s.status === "closed");
    let totalMs = 0;
    shifts.forEach(s => {
      if (s.endTime) totalMs += new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
    });
    const hrs = Math.floor(totalMs / 3600000);
    const mins = Math.floor((totalMs % 3600000) / 60000);
    return `${hrs}h ${mins}m`;
  }

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
    headerTitle: { fontSize: 16, fontWeight: "700", color: colors.foreground },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
    addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    empCard: { margin: 12, marginTop: 4, borderRadius: 14, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    avatarText: { fontSize: 20, fontWeight: "800", color: "#fff" },
    empName: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    empMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginTop: 4 },
    roleText: { fontSize: 10, fontWeight: "700" },
    modalScreen: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, paddingTop: insets.top + 20, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground },
    field: { paddingHorizontal: 20, marginTop: 16 },
    fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
    fieldInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, color: colors.foreground, fontSize: 15, backgroundColor: colors.surface, borderColor: colors.border },
    rowInput: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, height: 48, backgroundColor: colors.surface, borderColor: colors.border },
    optionRow: { flexDirection: "row", gap: 8 },
    optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
    saveBtn: { margin: 20, backgroundColor: colors.primary, borderRadius: 12, height: 52, alignItems: "center", justifyContent: "center" },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    twoCol: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 16 },
    halfField: { flex: 1 },
    shiftCard: { margin: 12, marginTop: 4, borderRadius: 12, borderWidth: 1, padding: 14 },
    shiftDate: { fontSize: 13, fontWeight: "700", color: colors.foreground },
    shiftMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  });

  return (
    <View style={[s.screen, { paddingTop: topPad }]}>
      <View style={s.headerRow}>
        <Text style={s.headerTitle}>{users.length} employees</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Feather name="user-plus" size={14} color="#fff" />
          <Text style={s.addBtnText}>Add Employee</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={u => u.id}
        renderItem={({ item: u }) => {
          const roleColor = ROLE_COLORS[u.role];
          const hours = getTotalHours(u.id);
          return (
            <TouchableOpacity style={[s.empCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => openEdit(u)} activeOpacity={0.8}>
              <View style={[s.avatar, { backgroundColor: roleColor }]}>
                <Text style={s.avatarText}>{u.name[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.empName}>{u.name}</Text>
                <Text style={s.empMeta}>@{u.username}</Text>
                <View style={[s.roleBadge, { backgroundColor: roleColor + "22" }]}>
                  <Text style={[s.roleText, { color: roleColor }]}>{u.role.toUpperCase()}</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                {u.salary > 0 && <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>{formatCurrency(u.salary, currencySymbol)}<Text style={{ fontSize: 10, fontWeight: "400", color: colors.mutedForeground }}>/mo</Text></Text>}
                <TouchableOpacity onPress={() => setShowTimecard(u)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="clock" size={12} color={colors.primary} />
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>{hours}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(u)}>
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
            <Feather name="users" size={40} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 15, fontWeight: "600" }}>No employees</Text>
          </View>
        }
      />

      {/* Add/Edit Employee Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalScreen}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{editing ? "Edit Employee" : "New Employee"}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={s.field}>
              <Text style={s.fieldLabel}>Full Name</Text>
              <TextInput style={s.fieldInput} value={fname} onChangeText={setFname} placeholder="John Smith" placeholderTextColor={colors.mutedForeground} />
            </View>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Username</Text>
              <TextInput style={s.fieldInput} value={fusername} onChangeText={setFusername} placeholder="john.smith" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
            </View>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Password</Text>
              <View style={s.rowInput}>
                <TextInput style={{ flex: 1, color: colors.foreground, fontSize: 15 }} value={fpassword} onChangeText={setFpassword} secureTextEntry={!showPw} placeholder="Password" placeholderTextColor={colors.mutedForeground} />
                <TouchableOpacity onPress={() => setShowPw(!showPw)}><Feather name={showPw ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} /></TouchableOpacity>
              </View>
            </View>
            <View style={s.field}>
              <Text style={s.fieldLabel}>Role</Text>
              <View style={s.optionRow}>
                {(editing?.role === "admin" ? (["admin"] as UserRole[]) : ASSIGNABLE_ROLES).map(role => (
                  <TouchableOpacity key={role} style={[s.optionChip, { backgroundColor: frole === role ? ROLE_COLORS[role] + "22" : colors.surface, borderColor: frole === role ? ROLE_COLORS[role] : colors.border }]} onPress={() => setFrole(role)}>
                    <Text style={{ color: frole === role ? ROLE_COLORS[role] : colors.foreground, fontWeight: "700", fontSize: 13, textTransform: "capitalize" }}>{role}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.twoCol}>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Monthly Salary ({currencySymbol})</Text>
                <TextInput style={s.fieldInput} value={fsalary} onChangeText={setFsalary} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} />
              </View>
              <View style={s.halfField}>
                <Text style={s.fieldLabel}>Hourly Rate ({currencySymbol})</Text>
                <TextInput style={s.fieldInput} value={fhourly} onChangeText={setFhourly} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.mutedForeground} />
              </View>
            </View>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
              <Text style={s.saveBtnText}>{editing ? "Save Changes" : "Add Employee"}</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Time Card Modal */}
      <Modal visible={!!showTimecard} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTimecard(null)}>
        <View style={s.modalScreen}>
          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>{showTimecard?.name}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>Time Card • Total: {showTimecard ? getTotalHours(showTimecard.id) : ""}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowTimecard(null)}><Feather name="x" size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <FlatList
            data={showTimecard ? getUserShifts(showTimecard.id).reverse() : []}
            keyExtractor={s => s.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            ListEmptyComponent={<View style={{ alignItems: "center", padding: 40 }}><Text style={{ color: colors.mutedForeground }}>No shifts recorded</Text></View>}
            renderItem={({ item: shift }) => (
              <View style={[s.shiftCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={s.shiftDate}>{formatDateTime(shift.startTime)}</Text>
                  <View style={[{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }, { backgroundColor: shift.status === "open" ? colors.success + "22" : colors.muted }]}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: shift.status === "open" ? colors.success : colors.mutedForeground, textTransform: "uppercase" }}>{shift.status}</Text>
                  </View>
                </View>
                <Text style={s.shiftMeta}>Duration: {shift.endTime ? formatDuration(shift.startTime, shift.endTime) : "In progress"}</Text>
                <Text style={s.shiftMeta}>Sales: {shift.salesCount} • {formatCurrency(shift.salesTotal, currencySymbol)}</Text>
                {shift.closingCash !== null && <Text style={s.shiftMeta}>Closing cash: {formatCurrency(shift.closingCash, currencySymbol)}</Text>}
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}