import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { BaseNode } from "./base-node.js";

/** Node for flow-control blocks: goto, sleep */
export const FlowBlockNode = memo(function FlowBlockNode(props: NodeProps) {
  return (
    <BaseNode
      nodeProps={props}
      accentColor="#f59e0b"
      icon={<GitBranch className="h-4 w-4" />}
      categoryLabel="Flow"
    />
  );
});
