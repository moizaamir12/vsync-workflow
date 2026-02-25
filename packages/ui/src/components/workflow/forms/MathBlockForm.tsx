import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface MathBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function MathBlockForm({ block, onChange, level }: MathBlockFormProps) {
  const logic = block.logic;

  const update = useCallback(
    (key: string, value: unknown) => onChange({ [key]: value }),
    [onChange],
  );

  const inputCn = cn(
    "w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]",
    "px-3 py-1.5 text-sm font-mono text-[hsl(var(--foreground))]",
    "placeholder:text-[hsl(var(--muted-foreground))]",
    "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]",
  );

  return (
    <div className="space-y-3">
      <FormField label="Operation" level={level}>
        <select
          value={(logic["math_operation"] as string) ?? "expression"}
          onChange={(e) => update("math_operation", e.target.value)}
          className={inputCn}
        >
          <option value="expression">Expression</option>
          <option value="add">Add</option>
          <option value="subtract">Subtract</option>
          <option value="multiply">Multiply</option>
          <option value="divide">Divide</option>
          <option value="modulo">Modulo</option>
          <option value="round">Round</option>
          <option value="floor">Floor</option>
          <option value="ceil">Ceil</option>
          <option value="abs">Absolute</option>
          <option value="min">Min</option>
          <option value="max">Max</option>
          <option value="random">Random</option>
        </select>
      </FormField>

      {(logic["math_operation"] === "expression" || !logic["math_operation"]) && (
        <FormField label="Expression" hint="Math expression — e.g. $price * 1.1" level={level}>
          <input
            type="text"
            value={(logic["math_expression"] as string) ?? ""}
            onChange={(e) => update("math_expression", e.target.value)}
            placeholder="$a + $b * 2"
            className={inputCn}
          />
        </FormField>
      )}

      {["add", "subtract", "multiply", "divide", "modulo", "min", "max"].includes(
        (logic["math_operation"] as string) ?? "",
      ) && (
        <>
          <FormField label="Left Operand" level={level}>
            <input
              type="text"
              value={(logic["math_left"] as string) ?? ""}
              onChange={(e) => update("math_left", e.target.value)}
              placeholder="$value"
              className={inputCn}
            />
          </FormField>
          <FormField label="Right Operand" level={level}>
            <input
              type="text"
              value={(logic["math_right"] as string) ?? ""}
              onChange={(e) => update("math_right", e.target.value)}
              placeholder="10"
              className={inputCn}
            />
          </FormField>
        </>
      )}

      {["round", "floor", "ceil", "abs"].includes(
        (logic["math_operation"] as string) ?? "",
      ) && (
        <FormField label="Value" level={level}>
          <input
            type="text"
            value={(logic["math_value"] as string) ?? ""}
            onChange={(e) => update("math_value", e.target.value)}
            placeholder="$number"
            className={inputCn}
          />
        </FormField>
      )}

      <FormField
        label="Precision"
        hint="Decimal places for rounding"
        showAt={["standard", "advanced"]}
        level={level}
      >
        <input
          type="number"
          value={(logic["math_precision"] as number) ?? 2}
          onChange={(e) => update("math_precision", Number(e.target.value))}
          min={0}
          max={20}
          className={inputCn}
        />
      </FormField>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["math_output"] as string) ?? ""}
          onChange={(e) => update("math_output", e.target.value)}
          placeholder="result"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
