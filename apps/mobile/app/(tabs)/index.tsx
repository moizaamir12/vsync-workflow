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
import { api } from "../../src/services/api";
import type { Workflow, Run } from "@vsync/shared-types";

/** Dashboard — workflow list + recent runs summary. */
export default function DashboardScreen() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    const [wfRes, runRes] = await Promise.all([
      api.get<Workflow[]>("/workflows"),
      api.get<Run[]>("/runs"),
    ]);
    if (wfRes.data) setWorkflows(wfRes.data);
    if (runRes.data) setRecentRuns(runRes.data.slice(0, 5));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Dashboard</Text>

      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{workflows.length}</Text>
          <Text style={styles.statLabel}>Workflows</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{recentRuns.length}</Text>
          <Text style={styles.statLabel}>Recent Runs</Text>
        </View>
      </View>

      {/* Recent runs */}
      <Text style={styles.sectionTitle}>Recent Runs</Text>
      <FlatList
        data={recentRuns}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.runCard}
            onPress={() => router.push(`/(tabs)/runs/${item.id}`)}
          >
            <View style={styles.runInfo}>
              <Text style={styles.runId} numberOfLines={1}>{item.id}</Text>
              <Text style={styles.runWorkflow}>Workflow: {item.workflowId}</Text>
            </View>
            <View style={[styles.statusBadge, statusColor(item.status)]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No recent runs</Text>
          </View>
        }
      />
    </View>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "completed": return { backgroundColor: "#052e16" };
    case "running": return { backgroundColor: "#1e1b4b" };
    case "failed": return { backgroundColor: "#450a0a" };
    default: return { backgroundColor: "#1e293b" };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  heading: { fontSize: 28, fontWeight: "800", color: "#f8fafc", marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  statNumber: { fontSize: 28, fontWeight: "700", color: "#6366f1" },
  statLabel: { fontSize: 13, color: "#94a3b8", marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#f8fafc", marginBottom: 12 },
  runCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  runInfo: { flex: 1 },
  runId: { fontSize: 14, fontWeight: "600", color: "#e2e8f0" },
  runWorkflow: { fontSize: 12, color: "#64748b", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "700", color: "#e2e8f0", textTransform: "uppercase" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: "#64748b", fontSize: 14 },
});
