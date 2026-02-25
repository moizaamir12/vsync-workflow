import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Globe } from "lucide-react";
import { BaseNode } from "./base-node.js";

/** Node for integration blocks: fetch, agent */
export const IntegrationBlockNode = memo(function IntegrationBlockNode(props: NodeProps) {
  return (
    <BaseNode
      nodeProps={props}
      accentColor="#10b981"
      icon={<Globe className="h-4 w-4" />}
      categoryLabel="Integration"
    />
  );
});
