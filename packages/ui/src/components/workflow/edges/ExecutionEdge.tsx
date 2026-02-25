import { memo } from "react";
import { BaseEdge, getStraightPath, type EdgeProps } from "@xyflow/react";

/** Default sequential execution edge — dotted gray */
export const ExecutionEdge = memo(function ExecutionEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY } = props;

  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      {...props}
      path={edgePath}
      style={{
        stroke: "#94a3b8",
        strokeWidth: 1.5,
        strokeDasharray: "4 4",
        ...props.style,
      }}
    />
  );
});
