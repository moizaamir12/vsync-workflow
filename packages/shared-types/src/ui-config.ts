/**
 * UI block configuration mappers — shared between desktop and mobile.
 *
 * Each `mapBlockLogicToUIConfig` overload transforms the raw `block.logic`
 * Record into a typed configuration object that platform-specific components
 * can render.  The property names follow the `<block_type>_<property>` convention.
 */

/* ── Form ──────────────────────────────────────────────────── */

export interface FormFieldConfig {
  name: string;
  type:
    | "text"
    | "number"
    | "email"
    | "password"
    | "select"
    | "multiselect"
    | "checkbox"
    | "toggle"
    | "date"
    | "textarea";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface UIFormConfig {
  kind: "ui_form";
  title: string;
  fields: FormFieldConfig[];
  submitLabel: string;
}

/* ── Camera ────────────────────────────────────────────────── */

export interface UICameraConfig {
  kind: "ui_camera";
  title: string;
  instructions: string;
  mode: "photo" | "barcode";
  flash: "auto" | "on" | "off";
}

/* ── Table ─────────────────────────────────────────────────── */

export interface UITableColumn {
  key: string;
  label: string;
  width?: number;
}

export interface UITableConfig {
  kind: "ui_table";
  title: string;
  data: unknown[];
  columns: UITableColumn[];
  searchable: boolean;
}

/* ── Details ───────────────────────────────────────────────── */

export interface UIDetailsField {
  key: string;
  label: string;
  format?: "text" | "date" | "number" | "boolean" | "json";
}

export interface UIDetailsConfig {
  kind: "ui_details";
  title: string;
  data: Record<string, unknown>;
  layout: "list" | "grid";
  fields: UIDetailsField[];
}

/* ── Union ─────────────────────────────────────────────────── */

export type UIBlockConfig =
  | UIFormConfig
  | UICameraConfig
  | UITableConfig
  | UIDetailsConfig;

/* ── Mapper ────────────────────────────────────────────────── */

/**
 * Transforms raw `block.logic` into a typed UI configuration object.
 *
 * The `resolvedData` parameter is optional — some blocks (table, details)
 * reference state values that must be resolved by the caller before
 * being passed in.
 */
export function mapBlockLogicToUIConfig(
  blockType: string,
  logic: Record<string, unknown>,
  resolvedData?: unknown,
): UIBlockConfig | null {
  switch (blockType) {
    case "ui_form":
      return mapFormConfig(logic);
    case "ui_camera":
      return mapCameraConfig(logic);
    case "ui_table":
      return mapTableConfig(logic, resolvedData);
    case "ui_details":
      return mapDetailsConfig(logic, resolvedData);
    default:
      return null;
  }
}

/* ── Internal mappers ──────────────────────────────────────── */

function mapFormConfig(logic: Record<string, unknown>): UIFormConfig {
  const rawFields = (logic["ui_form_fields"] ?? []) as Array<Record<string, unknown>>;

  return {
    kind: "ui_form",
    title: (logic["ui_form_title"] as string) ?? "Form",
    fields: rawFields.map((f) => ({
      name: (f["name"] as string) ?? "",
      type: ((f["type"] as string) ?? "text") as FormFieldConfig["type"],
      label: (f["label"] as string) ?? (f["name"] as string) ?? "",
      placeholder: f["placeholder"] as string | undefined,
      required: (f["required"] as boolean) ?? false,
      options: f["options"] as Array<{ label: string; value: string }> | undefined,
    })),
    submitLabel: (logic["ui_form_submit_label"] as string) ?? "Submit",
  };
}

function mapCameraConfig(logic: Record<string, unknown>): UICameraConfig {
  return {
    kind: "ui_camera",
    title: (logic["ui_camera_title"] as string) ?? "Camera",
    instructions: (logic["ui_camera_instructions"] as string) ?? "",
    mode: ((logic["ui_camera_mode"] as string) ?? "photo") as UICameraConfig["mode"],
    flash: ((logic["ui_camera_flash"] as string) ?? "auto") as UICameraConfig["flash"],
  };
}

function mapTableConfig(
  logic: Record<string, unknown>,
  resolvedData?: unknown,
): UITableConfig {
  const data = (resolvedData ?? logic["ui_table_data"] ?? []) as unknown[];
  const rawCols = (logic["ui_table_columns"] ?? []) as Array<Record<string, unknown>>;

  return {
    kind: "ui_table",
    title: (logic["ui_table_title"] as string) ?? "Table",
    data,
    columns: rawCols.map((c) => ({
      key: (c["key"] as string) ?? "",
      label: (c["label"] as string) ?? (c["key"] as string) ?? "",
      width: c["width"] as number | undefined,
    })),
    searchable: (logic["ui_table_searchable"] as boolean) ?? false,
  };
}

function mapDetailsConfig(
  logic: Record<string, unknown>,
  resolvedData?: unknown,
): UIDetailsConfig {
  const data = (resolvedData ?? logic["ui_details_data"] ?? {}) as Record<string, unknown>;
  const rawFields = (logic["ui_details_fields"] ?? []) as Array<Record<string, unknown>>;

  return {
    kind: "ui_details",
    title: (logic["ui_details_title"] as string) ?? "Details",
    data,
    layout: ((logic["ui_details_layout"] as string) ?? "list") as UIDetailsConfig["layout"],
    fields: rawFields.map((f) => ({
      key: (f["key"] as string) ?? "",
      label: (f["label"] as string) ?? (f["key"] as string) ?? "",
      format: f["format"] as UIDetailsField["format"] | undefined,
    })),
  };
}
