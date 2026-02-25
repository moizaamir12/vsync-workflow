import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { api } from "../../../src/services/api";
import type { Run } from "@vsync/shared-types";

/** Run history — list past runs with status badges. */
export default function RunHistoryScreen() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRuns = useCallback(async () => {
    const res = await api.get<Run[]>("/runs");
    if (res.data) setRuns(res.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchRuns();
  }, [fetchRuns]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Run History</Text>

      <FlatList
        data={runs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(tabs)/runs/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardId} numberOfLines={1}>
                {item.id}
              </Text>
              <View style={[styles.badge, badgeColor(item.status)]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>
                {item.triggerType ?? "manual"} • {item.durationMs ? `${item.durationMs}ms` : "—"}
              </Text>
              <Text style={styles.metaText}>
                {item.startedAt ? new Date(item.startedAt).toLocaleString() : "—"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No runs yet</Text>
          </View>
        }
      />
    </View>
  );
}

function badgeColor(status: string) {
  switch (status) {
    case "completed": return { backgroundColor: "#052e16" };
    case "running": return { backgroundColor: "#1e1b4b" };
    case "failed": return { backgroundColor: "#450a0a" };
    case "awaiting_action": return { backgroundColor: "#422006" };
    default: return { backgroundColor: "#1e293b" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  heading: { fontSize: 28, fontWeight: "800", color: "#f8fafc", marginBottom: 16 },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardId: { flex: 1, fontSize: 14, fontWeight: "600", color: "#e2e8f0", marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#e2e8f0", textTransform: "uppercase" },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  metaText: { fontSize: 12, color: "#64748b" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: "#64748b", fontSize: 14 },
});
