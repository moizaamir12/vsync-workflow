import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { logout } from "../../src/services/auth";
import { api } from "../../src/services/api";
import type { User } from "@vsync/shared-types";

/** App settings — profile info, version, logout. */
export default function SettingsScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await api.get<User>("/auth/me");
      if (res.data) setUser(res.data);
    })();
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Settings</Text>

      {/* Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.card}>
          <SettingRow label="Name" value={user?.name ?? "—"} />
          <SettingRow label="Email" value={user?.email ?? "—"} />
        </View>
      </View>

      {/* App info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.card}>
          <SettingRow label="Version" value={Constants.expoConfig?.version ?? "0.1.0"} />
          <SettingRow label="SDK" value={`Expo ${Constants.expoConfig?.sdkVersion ?? "—"}`} />
        </View>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  content: { padding: 16 },
  heading: { fontSize: 28, fontWeight: "800", color: "#f8fafc", marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#64748b", marginBottom: 8, textTransform: "uppercase" },
  card: { backgroundColor: "#1e293b", borderRadius: 12, overflow: "hidden" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
  },
  rowLabel: { fontSize: 15, color: "#e2e8f0" },
  rowValue: { fontSize: 15, color: "#94a3b8" },
  logoutButton: {
    backgroundColor: "#450a0a",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  logoutText: { color: "#fca5a5", fontSize: 16, fontWeight: "600" },
});
