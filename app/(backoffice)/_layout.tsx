import { Feather } from "@expo/vector-icons";
import { router, Tabs } from "expo-router";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function BackofficeLayout() {
  const colors = useColors();
  const { currentUser, hasPermission } = useAuth();

  useEffect(() => {
    if (!currentUser) { router.replace("/"); return; }
    if (!hasPermission("accessBackOffice")) { router.replace("/(pos)"); }
  }, [currentUser]);

  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: isIOS ? "transparent" : colors.sidebar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          ...(Platform.OS === "web" ? { height: 84 } : {}),
        },
        tabBarBackground: () => isIOS ? <BlurView intensity={80} tint="dark" style={{ flex: 1 }} /> : undefined,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color }) => <Feather name="bar-chart-2" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Items",
          tabBarLabel: "Items",
          tabBarIcon: ({ color }) => <Feather name="package" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="employees"
        options={{
          title: "Team",
          tabBarLabel: "Team",
          tabBarIcon: ({ color }) => <Feather name="users" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: "Reports",
          tabBarLabel: "Reports",
          tabBarIcon: ({ color }) => <Feather name="file-text" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
