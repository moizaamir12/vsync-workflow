import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { MonitorSmartphone } from "lucide-react";
import { BaseNode } from "./base-node.js";

/** Node for UI blocks: ui_form, ui_camera, ui_table, ui_details */
export const UIBlockNode = memo(function UIBlockNode(props: NodeProps) {
  return (
    <BaseNode
      nodeProps={props}
      accentColor="#ec4899"
      icon={<MonitorSmartphone className="h-4 w-4" />}
      categoryLabel="UI"
    />
  );
});
