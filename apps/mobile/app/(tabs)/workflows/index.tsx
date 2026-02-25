import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { api } from "../../../src/services/api";
import type { Workflow } from "@vsync/shared-types";

/** All workflows with search filtering. */
export default function WorkflowListScreen() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    const res = await api.get<Workflow[]>("/workflows");
    if (res.data) setWorkflows(res.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchWorkflows();
  }, [fetchWorkflows]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchWorkflows();
  }, [fetchWorkflows]);

  const filtered = search.trim()
    ? workflows.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          (w.description ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : workflows;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Workflows</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search workflows..."
        placeholderTextColor="#64748b"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(tabs)/workflows/${item.id}`)}
          >
            <Text style={styles.cardName}>{item.name}</Text>
            {item.description && (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>v{item.activeVersion ?? 0}</Text>
              <Text style={styles.metaText}>
                {item.isPublic ? "Public" : "Private"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {search ? "No workflows match your search" : "No workflows yet"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  heading: { fontSize: 28, fontWeight: "800", color: "#f8fafc", marginBottom: 16 },
  searchInput: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#f8fafc",
    fontSize: 15,
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardName: { fontSize: 16, fontWeight: "700", color: "#f8fafc" },
  cardDesc: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  cardMeta: { flexDirection: "row", gap: 12, marginTop: 10 },
  metaText: { fontSize: 12, color: "#64748b", fontWeight: "500" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: "#64748b", fontSize: 14 },
});
