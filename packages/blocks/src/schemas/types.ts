/**
 * Shape of a single optional field definition inside a block schema.
 * `default` is the fallback value when the field is omitted.
 * `enum` restricts the field to a known set of values.
 */
export interface FieldDef {
  default: unknown;
  enum?: readonly string[];
}

/**
 * Every block schema follows this structure:
 *  - `required`  — fields that MUST be present in `block.logic`
 *  - `optional`  — fields with defaults and optional enum constraints
 *  - `commonMistakes` — typo / shorthand corrections (wrong → correct)
 */
export interface BlockSchema {
  required: readonly string[];
  optional: Readonly<Record<string, FieldDef>>;
  commonMistakes: Readonly<Record<string, string>>;
}
