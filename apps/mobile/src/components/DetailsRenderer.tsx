import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import type { UIDetailsConfig } from "@vsync/shared-types";

interface DetailsRendererProps {
  config: UIDetailsConfig;
}

/**
 * Renders a key-value detail view from a `ui_details` block configuration.
 * Supports list and grid layouts.
 */
export function DetailsRenderer({ config }: DetailsRendererProps) {
  const isGrid = config.layout === "grid";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{config.title}</Text>

      <View style={isGrid ? styles.grid : styles.list}>
        {config.fields.map((field) => {
          const rawValue = config.data[field.key];
          const display = formatValue(rawValue, field.format);

          return (
            <View key={field.key} style={isGrid ? styles.gridItem : styles.listItem}>
              <Text style={styles.label}>{field.label}</Text>
              <Text style={styles.value}>{display}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function formatValue(
  value: unknown,
  format?: "text" | "date" | "number" | "boolean" | "json",
): string {
  if (value === null || value === undefined) return "—";

  switch (format) {
    case "date": {
      const d = new Date(value as string | number);
      return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }
    case "number":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    case "boolean":
      return value ? "Yes" : "No";
    case "json":
      return JSON.stringify(value, null, 2);
    default:
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#f8fafc", marginBottom: 16 },
  list: {},
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  listItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  gridItem: {
    width: "47%",
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 12,
  },
  label: { fontSize: 12, fontWeight: "600", color: "#94a3b8", marginBottom: 4, textTransform: "uppercase" },
  value: { fontSize: 16, color: "#f8fafc" },
});
