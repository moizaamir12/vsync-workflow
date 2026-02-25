import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Cpu } from "lucide-react";
import { BaseNode } from "./base-node.js";

/** Node for platform-specific blocks: image, filesystem, ftp, video, location */
export const PlatformBlockNode = memo(function PlatformBlockNode(props: NodeProps) {
  return (
    <BaseNode
      nodeProps={props}
      accentColor="#8b5cf6"
      icon={<Cpu className="h-4 w-4" />}
      categoryLabel="Platform"
    />
  );
});
