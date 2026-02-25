import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import type { UIFormConfig, FormFieldConfig } from "@vsync/shared-types";

interface FormRendererProps {
  config: UIFormConfig;
  onSubmit: (values: Record<string, unknown>) => void;
}

/**
 * Renders a dynamic form from a `ui_form` block configuration.
 *
 * Supports: text, number, email, password, select, multiselect,
 * checkbox, toggle, date, textarea.
 */
export function FormRenderer({ config, onSubmit }: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(values);
  }, [values, onSubmit]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{config.title}</Text>

      {config.fields.map((field) => (
        <FieldRenderer
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={(v) => setValue(field.name, v)}
        />
      ))}

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitText}>{config.submitLabel}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/* ── Individual field renderers ─────────────────────────────── */

interface FieldRendererProps {
  field: FormFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  const label = `${field.label}${field.required ? " *" : ""}`;

  switch (field.type) {
    case "text":
    case "email":
    case "password":
      return (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={field.placeholder}
            placeholderTextColor="#9ca3af"
            value={(value as string) ?? ""}
            onChangeText={onChange}
            secureTextEntry={field.type === "password"}
            keyboardType={field.type === "email" ? "email-address" : "default"}
            autoCapitalize={field.type === "email" ? "none" : "sentences"}
          />
        </View>
      );

    case "number":
      return (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={field.placeholder}
            placeholderTextColor="#9ca3af"
            value={value !== undefined ? String(value) : ""}
            onChangeText={(t) => onChange(t === "" ? undefined : Number(t))}
            keyboardType="numeric"
          />
        </View>
      );

    case "textarea":
      return (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={field.placeholder}
            placeholderTextColor="#9ca3af"
            value={(value as string) ?? ""}
            onChangeText={onChange}
            multiline
            numberOfLines={4}
          />
        </View>
      );

    case "checkbox":
    case "toggle":
      return (
        <View style={[styles.fieldContainer, styles.toggleRow]}>
          <Text style={styles.label}>{label}</Text>
          <Switch
            value={!!value}
            onValueChange={onChange}
            trackColor={{ false: "#374151", true: "#6366f1" }}
            thumbColor={Platform.OS === "android" ? "#fff" : undefined}
          />
        </View>
      );

    case "select":
      return (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.optionGroup}>
            {(field.options ?? []).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionButton,
                  value === opt.value && styles.optionSelected,
                ]}
                onPress={() => onChange(opt.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    value === opt.value && styles.optionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );

    case "multiselect": {
      const selected = (value as string[]) ?? [];
      return (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.optionGroup}>
            {(field.options ?? []).map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.optionButton,
                    isSelected && styles.optionSelected,
                  ]}
                  onPress={() => {
                    const next = isSelected
                      ? selected.filter((v) => v !== opt.value)
                      : [...selected, opt.value];
                    onChange(next);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    case "date":
      return (
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            placeholder={field.placeholder ?? "YYYY-MM-DD"}
            placeholderTextColor="#9ca3af"
            value={(value as string) ?? ""}
            onChangeText={onChange}
          />
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#f8fafc", marginBottom: 20 },
  fieldContainer: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", color: "#e2e8f0", marginBottom: 6 },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f8fafc",
    fontSize: 16,
  },
  textarea: { height: 100, textAlignVertical: "top" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  optionGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
  },
  optionSelected: { borderColor: "#6366f1", backgroundColor: "#312e81" },
  optionText: { color: "#94a3b8", fontSize: 14 },
  optionTextSelected: { color: "#c7d2fe", fontWeight: "600" },
  submitButton: {
    marginTop: 12,
    backgroundColor: "#6366f1",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
