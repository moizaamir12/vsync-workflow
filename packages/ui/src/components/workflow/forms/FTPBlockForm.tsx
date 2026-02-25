import { useCallback } from "react";
import { cn } from "../../../lib/utils.js";
import { FormField, FormSection } from "./FormField.js";
import type { DisclosureLevel, WorkflowBlock } from "../../../stores/workflowStore.js";

export interface FTPBlockFormProps {
  block: WorkflowBlock;
  onChange: (logic: Record<string, unknown>) => void;
  level: DisclosureLevel;
}

export function FTPBlockForm({ block, onChange, level }: FTPBlockFormProps) {
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
    <div className="space-y-4">
      <FormSection title="Connection">
        <FormField label="Protocol" level={level}>
          <select
            value={(logic["ftp_protocol"] as string) ?? "sftp"}
            onChange={(e) => update("ftp_protocol", e.target.value)}
            className={inputCn}
          >
            <option value="ftp">FTP</option>
            <option value="ftps">FTPS</option>
            <option value="sftp">SFTP</option>
          </select>
        </FormField>

        <FormField label="Host" level={level}>
          <input
            type="text"
            value={(logic["ftp_host"] as string) ?? ""}
            onChange={(e) => update("ftp_host", e.target.value)}
            placeholder="ftp.example.com"
            className={inputCn}
          />
        </FormField>

        <FormField label="Port" showAt={["standard", "advanced"]} level={level}>
          <input
            type="number"
            value={(logic["ftp_port"] as number) ?? 22}
            onChange={(e) => update("ftp_port", Number(e.target.value))}
            className={inputCn}
          />
        </FormField>

        <FormField label="Username" level={level}>
          <input
            type="text"
            value={(logic["ftp_username"] as string) ?? ""}
            onChange={(e) => update("ftp_username", e.target.value)}
            placeholder="$secrets.ftp_user"
            className={inputCn}
          />
        </FormField>

        <FormField label="Password / Key" level={level}>
          <input
            type="text"
            value={(logic["ftp_password"] as string) ?? ""}
            onChange={(e) => update("ftp_password", e.target.value)}
            placeholder="$secrets.ftp_password"
            className={inputCn}
          />
        </FormField>
      </FormSection>

      <FormSection title="Operation">
        <FormField label="Action" level={level}>
          <select
            value={(logic["ftp_action"] as string) ?? "upload"}
            onChange={(e) => update("ftp_action", e.target.value)}
            className={inputCn}
          >
            <option value="upload">Upload</option>
            <option value="download">Download</option>
            <option value="list">List files</option>
            <option value="delete">Delete</option>
          </select>
        </FormField>

        <FormField label="Remote Path" level={level}>
          <input
            type="text"
            value={(logic["ftp_remote_path"] as string) ?? ""}
            onChange={(e) => update("ftp_remote_path", e.target.value)}
            placeholder="/uploads/file.csv"
            className={inputCn}
          />
        </FormField>

        {["upload"].includes((logic["ftp_action"] as string) ?? "upload") && (
          <FormField label="Local Path / Data" level={level}>
            <input
              type="text"
              value={(logic["ftp_local_path"] as string) ?? ""}
              onChange={(e) => update("ftp_local_path", e.target.value)}
              placeholder="$fileData"
              className={inputCn}
            />
          </FormField>
        )}
      </FormSection>

      <FormField label="Output Variable" level={level}>
        <input
          type="text"
          value={(logic["ftp_output"] as string) ?? ""}
          onChange={(e) => update("ftp_output", e.target.value)}
          placeholder="result"
          className={inputCn}
        />
      </FormField>
    </div>
  );
}
