import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { api } from "../../../src/services/api";
import type { Run, Step } from "@vsync/shared-types";

/** Detailed view of a single run with step-by-step breakdown. */
export default function RunDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await api.get<Run>(`/runs/${id}`);
      if (res.data) setRun(res.data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!run) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Run not found</Text>
      </View>
    );
  }

  const steps = (run as unknown as { stepsJson?: Step[] }).stepsJson ?? [];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Run Detail</Text>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <SummaryRow label="ID" value={run.id} />
        <SummaryRow label="Status" value={run.status} />
        <SummaryRow label="Trigger" value={run.triggerType ?? "—"} />
        <SummaryRow label="Duration" value={run.durationMs ? `${run.durationMs}ms` : "—"} />
        <SummaryRow
          label="Started"
          value={run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
        />
        {run.errorMessage && <SummaryRow label="Error" value={run.errorMessage} isError />}
      </View>

      {/* Steps */}
      {steps.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Steps ({steps.length})</Text>
          {steps.map((step, idx) => (
            <View key={step.stepId ?? idx} style={styles.stepCard}>
              <View style={styles.stepHeader}>
                <View style={[styles.dot, dotStyle(step.status)]} />
                <Text style={styles.stepName}>{step.blockName ?? `Step ${idx + 1}`}</Text>
                <Text style={[styles.stepStatus, statusStyle(step.status)]}>
                  {step.status}
                </Text>
              </View>
              <Text style={styles.stepType}>{step.blockType}</Text>
              {step.error && (
                <Text style={styles.stepError}>{step.error.message}</Text>
              )}
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function SummaryRow({
  label,
  value,
  isError = false,
}: {
  label: string;
  value: string;
  isError?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[styles.summaryValue, isError && { color: "#ef4444" }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function dotStyle(status: string) {
  const colorMap: Record<string, string> = {
    completed: "#22c55e",
    running: "#6366f1",
    failed: "#ef4444",
    skipped: "#f59e0b",
    pending: "#475569",
  };
  return { backgroundColor: colorMap[status] ?? "#475569" };
}

function statusStyle(status: string) {
  const colorMap: Record<string, string> = {
    completed: "#22c55e",
    running: "#6366f1",
    failed: "#ef4444",
    skipped: "#f59e0b",
    pending: "#475569",
  };
  return { color: colorMap[status] ?? "#475569" };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" },
  heading: { fontSize: 24, fontWeight: "800", color: "#f8fafc", marginBottom: 16 },
  errorText: { color: "#ef4444", fontSize: 16 },
  summaryCard: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 24 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#0f172a",
  },
  summaryLabel: { fontSize: 13, color: "#94a3b8", fontWeight: "600" },
  summaryValue: { fontSize: 13, color: "#f8fafc", maxWidth: "60%", textAlign: "right" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#f8fafc", marginBottom: 12 },
  stepCard: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stepName: { flex: 1, fontSize: 14, fontWeight: "600", color: "#e2e8f0" },
  stepStatus: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  stepType: { fontSize: 12, color: "#64748b", marginTop: 4, marginLeft: 18 },
  stepError: { fontSize: 12, color: "#f87171", marginTop: 4, marginLeft: 18 },
});
