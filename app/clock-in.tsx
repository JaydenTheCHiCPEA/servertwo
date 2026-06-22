import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useShift } from "@/context/ShiftContext";
import { useColors } from "@/hooks/useColors";

export default function ClockInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currentUser, logout } = useAuth();
  const { clockIn } = useShift();
  const [openingCash, setOpeningCash] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  function handleClockIn() {
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) {
      setErrorMsg("Please enter a valid opening cash amount.");
      return;
    }
    setErrorMsg(null);
    clockIn(currentUser!.id, currentUser!.name, amount);
    router.replace("/(pos)");
  }

  function handleLogout() {
    setLogoutConfirm(true);
  }

  function confirmLogout() {
    setLogoutConfirm(false);
    logout();
    router.replace("/");
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const roleColors: Record<string, string> = {
    admin: colors.destructive,
    manager: colors.warning,
    cashier: colors.success,
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.header, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerName, { color: colors.foreground }]}>{currentUser?.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleColors[currentUser?.role ?? "cashier"] + "33" }]}>
            <Text style={[styles.roleText, { color: roleColors[currentUser?.role ?? "cashier"] }]}>
              {currentUser?.role?.toUpperCase()}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: colors.surface }]}>
          <Feather name="log-out" size={18} color={colors.mutedForeground} />
          <Text style={[styles.logoutText, { color: colors.mutedForeground }]}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.content, { paddingBottom: botPad + 24 }]}>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="clock" size={36} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>Start Your Shift</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Enter the opening cash amount in the register to begin your shift.
              </Text>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Opening Cash Amount</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: errorMsg ? colors.destructive : colors.border }]}>
                <Text style={[styles.currencySign, { color: colors.foreground }]}>$</Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={openingCash}
                  onChangeText={v => { setOpeningCash(v); setErrorMsg(null); }}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleClockIn}
                />
              </View>

              {errorMsg ? (
                <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive + "44" }]}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={{ color: colors.destructive, fontSize: 12, fontWeight: "600", flex: 1 }}>{errorMsg}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.clockInBtn, { backgroundColor: colors.primary }]}
                onPress={handleClockIn}
                activeOpacity={0.85}
              >
                <Feather name="play-circle" size={20} color="#fff" />
                <Text style={styles.clockInText}>Clock In & Start Shift</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Feather name="info" size={16} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                You must clock in before accessing the POS.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sign out confirm modal */}
      <Modal visible={logoutConfirm} transparent animationType="fade" onRequestClose={() => setLogoutConfirm(false)}>
        <View style={styles.overlay}>
          <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.confirmTitle, { color: colors.foreground }]}>Sign Out?</Text>
            <Text style={[styles.confirmMsg, { color: colors.mutedForeground }]}>Are you sure you want to sign out?</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.muted }]} onPress={() => setLogoutConfirm(false)}>
                <Text style={[styles.confirmBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.destructive }]} onPress={confirmLogout}>
                <Text style={[styles.confirmBtnText, { color: "#fff" }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1,
  },
  headerName: { fontSize: 18, fontWeight: "700" },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, alignSelf: "flex-start" },
  roleText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  logoutText: { fontSize: 13, fontWeight: "600" },
  content: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: "center", gap: 12 },
  iconBox: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, alignSelf: "flex-start", marginTop: 8 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, width: "100%",
  },
  currencySign: { fontSize: 20, fontWeight: "700", marginRight: 4 },
  input: { flex: 1, height: 52, fontSize: 22, fontWeight: "600" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 10, borderWidth: 1, width: "100%" },
  clockInBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 12, height: 52, paddingHorizontal: 24, width: "100%", justifyContent: "center", marginTop: 8,
  },
  clockInText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  infoCard: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 32 },
  confirmBox: { borderRadius: 16, borderWidth: 1, padding: 24, width: "100%", maxWidth: 340 },
  confirmTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  confirmMsg: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  confirmRow: { flexDirection: "row", gap: 10 },
  confirmBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  confirmBtnText: { fontWeight: "700", fontSize: 14 },
});
