import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useShift } from "@/context/ShiftContext";
import { useSync } from "@/context/SyncContext";
import { useColors } from "@/hooks/useColors";

type Mode = "login" | "register";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, register, currentUser } = useAuth();
  const { isClocked } = useShift();
  const { syncNow, isSyncing, isOnline, pendingSync } = useSync();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (isClocked) {
        router.replace("/(pos)");
      } else {
        router.replace("/clock-in");
      }
    }
  }, [currentUser, isClocked]);

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setError(null);
    setLoading(true);
    await syncNow();

    if (mode === "register") {
      const result = await register(name.trim(), username.trim(), password.trim());
      setLoading(false);
      if (!result.ok) {
        setError(result.error ?? "Registration failed.");
        shakeForm();
      }
    } else {
      const ok = await login(username.trim(), password.trim());
      setLoading(false);
      if (!ok) {
        setError("Invalid username or password.");
        shakeForm();
      }
    }
  }

  function shakeForm() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setName("");
    setUsername("");
    setPassword("");
  }

  const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    inner: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingTop: insets.top + 20,
      paddingBottom: insets.bottom + 20,
    },
    logo: { alignItems: "center", marginBottom: 40 },
    logoBox: {
      width: 80, height: 80, borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center", marginBottom: 18,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
    appName: { fontSize: 26, fontWeight: "800", color: colors.foreground, letterSpacing: 1 },
    appSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, letterSpacing: 0.5 },
    modeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
    modeBtn: {
      flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
      borderWidth: 1.5,
    },
    modeBtnText: { fontWeight: "700", fontSize: 14 },
    label: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground, marginBottom: 6, marginTop: 16, letterSpacing: 0.8, textTransform: "uppercase" },
    inputRow: {
      flexDirection: "row", alignItems: "center",
      backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: 14,
    },
    input: { flex: 1, height: 50, color: colors.foreground, fontSize: 15, paddingLeft: 10 },
    loginBtn: {
      marginTop: 28, backgroundColor: colors.primary, borderRadius: 12,
      height: 52, alignItems: "center", justifyContent: "center",
    },
    loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    errorBox: {
      marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.destructive + "18",
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: colors.destructive + "44",
    },
    errorText: { color: colors.destructive, fontSize: 13, fontWeight: "600", flex: 1 },
    hint: { marginTop: 16, fontSize: 12, color: colors.mutedForeground, textAlign: "center" },
  });

  return (
    <View style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={[s.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={s.logo}>
              <View style={s.logoBox}>
                <Feather name="shopping-bag" size={34} color="#fff" />
              </View>
              <Text style={s.appName}>D.L. WRIGHT POS</Text>
              <Text style={s.appSub}>Point of Sale System</Text>
              {!isOnline || pendingSync ? (
                <Text style={[s.appSub, { marginTop: 8, color: pendingSync ? colors.warning : colors.mutedForeground }]}>
                  {isSyncing ? "Syncing data…" : pendingSync ? "Offline — saved locally" : ""}
                </Text>
              ) : null}
            </View>

            <View style={s.modeRow}>
              <TouchableOpacity
                style={[s.modeBtn, { borderColor: mode === "login" ? colors.primary : colors.border, backgroundColor: mode === "login" ? colors.primary + "18" : colors.surface }]}
                onPress={() => switchMode("login")}
              >
                <Text style={[s.modeBtnText, { color: mode === "login" ? colors.primary : colors.foreground }]}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, { borderColor: mode === "register" ? colors.primary : colors.border, backgroundColor: mode === "register" ? colors.primary + "18" : colors.surface }]}
                onPress={() => switchMode("register")}
              >
                <Text style={[s.modeBtnText, { color: mode === "register" ? colors.primary : colors.foreground }]}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {mode === "register" ? (
              <>
                <Text style={s.label}>Your Name</Text>
                <View style={s.inputRow}>
                  <Feather name="user" size={18} color={colors.mutedForeground} />
                  <TextInput
                    style={s.input}
                    value={name}
                    onChangeText={(v) => { setName(v); setError(null); }}
                    placeholder="Store owner name"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="words"
                  />
                </View>
              </>
            ) : null}

            <Text style={s.label}>Username</Text>
            <View style={s.inputRow}>
              <Feather name="at-sign" size={18} color={colors.mutedForeground} />
              <TextInput
                style={s.input}
                value={username}
                onChangeText={(v) => { setUsername(v); setError(null); }}
                placeholder="Enter username"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <Feather name="lock" size={18} color={colors.mutedForeground} />
              <TextInput
                style={s.input}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(null); }}
                placeholder="Enter password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPw}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name={showPw ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={s.loginBtn} onPress={handleSubmit} activeOpacity={0.85} disabled={loading}>
              {loading ? (
                <Feather name="loader" size={20} color="#fff" />
              ) : (
                <Text style={s.loginBtnText}>{mode === "register" ? "Create Admin Account" : "Sign In"}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}