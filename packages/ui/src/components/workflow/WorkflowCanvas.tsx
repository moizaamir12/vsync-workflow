import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type DragEvent,
} from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import { useWorkflowStore, type BlockType } from "../../stores/workflowStore.js";
import { DataBlockNode } from "./nodes/DataBlockNode.js";
import { FlowBlockNode } from "./nodes/FlowBlockNode.js";
import { IntegrationBlockNode } from "./nodes/IntegrationBlockNode.js";
import { UIBlockNode } from "./nodes/UIBlockNode.js";
import { PlatformBlockNode } from "./nodes/PlatformBlockNode.js";
import { ExecutionEdge } from "./edges/ExecutionEdge.js";
import { GotoEdge } from "./edges/GotoEdge.js";
import { ConditionalEdge } from "./edges/ConditionalEdge.js";
import { applyDagreLayout } from "./layout.js";

/* ── Node & edge type registrations ───────────────────────────── */

const nodeTypes: NodeTypes = {
  data: DataBlockNode,
  flow: FlowBlockNode,
  integration: IntegrationBlockNode,
  ui: UIBlockNode,
  platform: PlatformBlockNode,
};

const edgeTypes: EdgeTypes = {
  execution: ExecutionEdge,
  goto: GotoEdge,
  conditional: ConditionalEdge,
};

/* ── Props ────────────────────────────────────────────────────── */

export interface WorkflowCanvasProps {
  /** Called after a save keyboard shortcut (Cmd+S) */
  onSave?: () => void;
  /** Class name for the wrapper */
  className?: string;
}

/* ── Component ────────────────────────────────────────────────── */

export function WorkflowCanvas({ onSave, className }: WorkflowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  /* ── Store selectors ──────────────────────────── */

  const nodes = useWorkflowStore((s) => s.nodes);
  const flowEdges = useWorkflowStore((s) => s.flowEdges);
  const selectedBlockIds = useWorkflowStore((s) => s.selectedBlockIds);
  const aiModifiedBlockIds = useWorkflowStore((s) => s.aiModifiedBlockIds);
  const canvasHasFocus = useWorkflowStore((s) => s.canvasHasFocus);

  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setFlowEdges = useWorkflowStore((s) => s.setFlowEdges);
  const selectBlock = useWorkflowStore((s) => s.selectBlock);
  const toggleBlockSelection = useWorkflowStore((s) => s.toggleBlockSelection);
  const deselectAll = useWorkflowStore((s) => s.deselectAll);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const addEdge = useWorkflowStore((s) => s.addEdge);
  const addBlock = useWorkflowStore((s) => s.addBlock);
  const deleteSelectedBlocks = useWorkflowStore((s) => s.deleteSelectedBlocks);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const duplicateBlock = useWorkflowStore((s) => s.duplicateBlock);
  const selectAllBlocks = useWorkflowStore((s) => s.selectAllBlocks);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const setCanvasHasFocus = useWorkflowStore((s) => s.setCanvasHasFocus);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);
  const selectedBlockId = useWorkflowStore((s) => s.selectedBlockId);

  /* ── Apply selected state to nodes ────────────── */

  const nodesWithSelection = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selected: selectedBlockIds.has(n.id),
        data: {
          ...(n.data as Record<string, unknown>),
          aiModified: aiModifiedBlockIds.has(n.id),
        },
      })),
    [nodes, selectedBlockIds, aiModifiedBlockIds],
  );

  const edgesWithSelection = useMemo(
    () =>
      flowEdges.map((e) => ({
        ...e,
        selected: e.id === selectedEdgeId,
      })),
    [flowEdges, selectedEdgeId],
  );

  /* ── React Flow change handlers ───────────────── */

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(applyNodeChanges(changes, nodes));
    },
    [nodes, setNodes],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setFlowEdges(applyEdgeChanges(changes, flowEdges));
    },
    [flowEdges, setFlowEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addEdge(connection.source, connection.target);
      }
    },
    [addEdge],
  );

  /* ── Node click ───────────────────────────────── */

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      if (_event.shiftKey) {
        toggleBlockSelection(node.id);
      } else {
        selectBlock(node.id);
      }
    },
    [selectBlock, toggleBlockSelection],
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { id: string }) => {
      selectEdge(edge.id);
    },
    [selectEdge],
  );

  const onPaneClick = useCallback(() => {
    deselectAll();
  }, [deselectAll]);

  /* ── Drop from palette ────────────────────────── */

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const blockType = event.dataTransfer.getData("application/vsync-block-type") as BlockType;
      if (!blockType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addBlock(blockType, position);
    },
    [addBlock, screenToFlowPosition],
  );

  /* ── Keyboard shortcuts ───────────────────────── */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      /* Only handle when canvas has focus (not typing in inspector) */
      if (!canvasHasFocus) return;

      const mod = e.metaKey || e.ctrlKey;

      /* Cmd/Ctrl+S: Save */
      if (mod && e.key === "s") {
        e.preventDefault();
        onSave?.();
        return;
      }

      /* Cmd/Ctrl+Z: Undo / Cmd+Shift+Z: Redo */
      if (mod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      /* Delete/Backspace: Delete selected */
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedEdgeId) {
          deleteEdge(selectedEdgeId);
        } else {
          deleteSelectedBlocks();
        }
        return;
      }

      /* Cmd/Ctrl+D: Duplicate */
      if (mod && e.key === "d") {
        e.preventDefault();
        if (selectedBlockId) {
          duplicateBlock(selectedBlockId);
        }
        return;
      }

      /* Cmd/Ctrl+A: Select all */
      if (mod && e.key === "a") {
        e.preventDefault();
        selectAllBlocks();
        return;
      }

      /* Escape: Deselect */
      if (e.key === "Escape") {
        deselectAll();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canvasHasFocus, onSave, undo, redo, deleteSelectedBlocks,
    deleteEdge, duplicateBlock, selectAllBlocks, deselectAll,
    selectedEdgeId, selectedBlockId,
  ]);

  /* ── Focus tracking ───────────────────────────── */

  const handleFocus = useCallback(() => setCanvasHasFocus(true), [setCanvasHasFocus]);
  const handleBlur = useCallback(() => setCanvasHasFocus(false), [setCanvasHasFocus]);

  /* ── Auto-layout helper ───────────────────────── */

  const autoLayout = useCallback(() => {
    const laid = applyDagreLayout(nodes, flowEdges);
    setNodes(laid);
  }, [nodes, flowEdges, setNodes]);

  /* Expose autoLayout via imperative handle on the wrapper for toolbar */
  useEffect(() => {
    const el = wrapperRef.current;
    if (el) {
      (el as unknown as { autoLayout: () => void }).autoLayout = autoLayout;
    }
  }, [autoLayout]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodesWithSelection}
        edges={edgesWithSelection}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode={null}
        multiSelectionKeyCode="Shift"
        selectionKeyCode="Shift"
        panOnScroll
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-[hsl(var(--muted))]"
        />
        <Controls className="!bg-[hsl(var(--card))] !border-[hsl(var(--border))] !shadow-sm" />
      </ReactFlow>
    </div>
  );
}

export { applyDagreLayout };
