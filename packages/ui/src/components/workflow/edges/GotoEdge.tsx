import { memo } from "react";
import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

/** Explicit goto connection — solid blue, animated */
export const GotoEdge = memo(function GotoEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      {...props}
      path={edgePath}
      style={{
        stroke: "#3b82f6",
        strokeWidth: 2,
        ...props.style,
      }}
    />
  );
});
