import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Database } from "lucide-react";
import { BaseNode } from "./base-node.js";

/** Node for data-manipulation blocks: object, string, array, math, date, normalize, code */
export const DataBlockNode = memo(function DataBlockNode(props: NodeProps) {
  return (
    <BaseNode
      nodeProps={props}
      accentColor="#6366f1"
      icon={<Database className="h-4 w-4" />}
      categoryLabel="Data"
    />
  );
});
