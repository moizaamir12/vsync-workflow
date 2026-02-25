import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native";
import type { UITableConfig } from "@vsync/shared-types";

interface TableRendererProps {
  config: UITableConfig;
}

/**
 * Renders a scrollable table from a `ui_table` block configuration.
 * Supports optional search filtering across all visible columns.
 */
export function TableRenderer({ config }: TableRendererProps) {
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    if (!search.trim()) return config.data;

    const term = search.toLowerCase();
    return config.data.filter((row) => {
      if (typeof row !== "object" || row === null) return false;
      const record = row as Record<string, unknown>;
      return config.columns.some((col) => {
        const val = record[col.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
      });
    });
  }, [config.data, config.columns, search]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{config.title}</Text>

      {config.searchable && (
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          {/* Header row */}
          <View style={styles.headerRow}>
            {config.columns.map((col) => (
              <View key={col.key} style={[styles.cell, col.width ? { width: col.width } : {}]}>
                <Text style={styles.headerText}>{col.label}</Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          <ScrollView style={styles.bodyScroll}>
            {filteredData.map((row, idx) => {
              const record = (row ?? {}) as Record<string, unknown>;
              return (
                <View
                  key={idx}
                  style={[styles.dataRow, idx % 2 === 0 ? styles.evenRow : styles.oddRow]}
                >
                  {config.columns.map((col) => (
                    <View key={col.key} style={[styles.cell, col.width ? { width: col.width } : {}]}>
                      <Text style={styles.cellText} numberOfLines={2}>
                        {formatCellValue(record[col.key])}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
            {filteredData.length === 0 && (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>No data</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#f8fafc", marginBottom: 12 },
  searchInput: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 14,
    marginBottom: 12,
  },
  headerRow: { flexDirection: "row", backgroundColor: "#1e293b", borderRadius: 8 },
  headerText: { color: "#94a3b8", fontSize: 13, fontWeight: "700", textTransform: "uppercase" },
  bodyScroll: { maxHeight: 400 },
  dataRow: { flexDirection: "row" },
  evenRow: { backgroundColor: "#0f172a" },
  oddRow: { backgroundColor: "#1e293b" },
  cell: { width: 140, paddingHorizontal: 12, paddingVertical: 10 },
  cellText: { color: "#e2e8f0", fontSize: 14 },
  emptyRow: { padding: 24, alignItems: "center" },
  emptyText: { color: "#64748b", fontSize: 14 },
});
