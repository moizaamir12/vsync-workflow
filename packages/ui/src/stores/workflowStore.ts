import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Node, Edge } from "@xyflow/react";

/* ── Types ────────────────────────────────────────────────────── */

/** Block type categories matching @vsync/shared-types BlockType */
export type BlockType =
  | "object" | "string" | "array" | "math" | "date" | "normalize" | "code"
  | "fetch" | "agent"
  | "goto" | "sleep"
  | "ui_form" | "ui_camera" | "ui_table" | "ui_details"
  | "image" | "filesystem" | "ftp" | "video" | "location";

export interface WorkflowBlock {
  id: string;
  workflowId: string;
  workflowVersion: number;
  name: string;
  type: BlockType;
  logic: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  order: number;
  notes?: string;
}

export interface WorkflowMeta {
  id: string;
  name: string;
  description?: string;
  activeVersion: number;
  triggerType: string;
  triggerConfig?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: "execution" | "goto" | "conditional";
  label?: string;
}

/** Snapshot for undo/redo history */
interface HistorySnapshot {
  blocks: WorkflowBlock[];
  edges: WorkflowEdge[];
  nodes: Node[];
  flowEdges: Edge[];
}

/** Disclosure level for block forms */
export type DisclosureLevel = "simple" | "standard" | "advanced";

/* ── Store state ──────────────────────────────────────────────── */

export interface WorkflowStoreState {
  /* ── Data ──────────────────────────────────────── */
  workflow: WorkflowMeta | null;
  blocks: WorkflowBlock[];
  edges: WorkflowEdge[];

  /** React Flow node representations */
  nodes: Node[];
  /** React Flow edge representations */
  flowEdges: Edge[];

  /* ── Selection ─────────────────────────────────── */
  selectedBlockId: string | null;
  selectedBlockIds: Set<string>;
  selectedEdgeId: string | null;

  /* ── Form state ────────────────────────────────── */
  disclosureLevel: DisclosureLevel;

  /* ── Dirty tracking ────────────────────────────── */
  isDirty: boolean;
  lastSavedAt: number | null;

  /* ── Undo / redo ───────────────────────────────── */
  undoStack: HistorySnapshot[];
  redoStack: HistorySnapshot[];

  /* ── Canvas focus ──────────────────────────────── */
  canvasHasFocus: boolean;

  /* ── Save status ───────────────────────────────── */
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: string | null;

  /* ── AI tracking ─────────────────────────────────── */
  aiModifiedBlockIds: Set<string>;

  /* ── Actions ───────────────────────────────────── */

  // Workflow lifecycle
  setWorkflow: (wf: WorkflowMeta) => void;
  setBlocks: (blocks: WorkflowBlock[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;

  // Block CRUD
  addBlock: (type: BlockType, position?: { x: number; y: number }) => string;
  deleteBlock: (id: string) => void;
  deleteSelectedBlocks: () => void;
  updateBlockLogic: (id: string, logic: Record<string, unknown>) => void;
  updateBlockName: (id: string, name: string) => void;
  updateBlockNotes: (id: string, notes: string) => void;
  updateBlockConditions: (id: string, conditions: Record<string, unknown>) => void;
  duplicateBlock: (id: string) => string | null;
  reorderBlocks: (orderedIds: string[]) => void;

  // Selection
  selectBlock: (id: string) => void;
  toggleBlockSelection: (id: string) => void;
  selectAllBlocks: () => void;
  deselectAll: () => void;
  selectEdge: (id: string | null) => void;

  // Edges
  addEdge: (source: string, target: string, type?: WorkflowEdge["type"], label?: string) => string;
  deleteEdge: (id: string) => void;

  // React Flow sync
  setNodes: (nodes: Node[]) => void;
  setFlowEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: unknown[]) => void;

  // Undo/redo
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;

  // Dirty/save tracking
  markDirty: () => void;
  markClean: () => void;
  setSaveStatus: (status: WorkflowStoreState["saveStatus"], error?: string) => void;

  // Form
  setDisclosureLevel: (level: DisclosureLevel) => void;

  // Canvas focus
  setCanvasHasFocus: (focused: boolean) => void;

  // AI tracking
  addAiModifiedBlockId: (id: string) => void;
  clearAiModifiedBlockIds: () => void;

  // Getters
  getBlock: (id: string) => WorkflowBlock | undefined;
  getSelectedBlock: () => WorkflowBlock | undefined;
  getChanges: () => { blocks: WorkflowBlock[]; edges: WorkflowEdge[] };
}

/* ── Constants ────────────────────────────────────────────────── */

const MAX_UNDO = 50;

/** Generate a unique ID for new blocks */
function makeId(): string {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeEdgeId(): string {
  return `edge_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Default name for a new block based on its type */
function defaultBlockName(type: BlockType): string {
  const names: Record<BlockType, string> = {
    object: "Set Object",
    string: "Format String",
    array: "Array Operation",
    math: "Math",
    date: "Date",
    normalize: "Normalize",
    code: "Code",
    fetch: "HTTP Request",
    agent: "AI Agent",
    goto: "Go To",
    sleep: "Wait",
    ui_form: "Form",
    ui_camera: "Camera",
    ui_table: "Table",
    ui_details: "Details",
    image: "Image",
    filesystem: "File System",
    ftp: "FTP",
    video: "Video",
    location: "Location",
  };
  return names[type] ?? type;
}

/** Take a deep-clone snapshot for undo/redo */
function snapshot(state: WorkflowStoreState): HistorySnapshot {
  return {
    blocks: JSON.parse(JSON.stringify(state.blocks)) as WorkflowBlock[],
    edges: JSON.parse(JSON.stringify(state.edges)) as WorkflowEdge[],
    nodes: JSON.parse(JSON.stringify(state.nodes)) as Node[],
    flowEdges: JSON.parse(JSON.stringify(state.flowEdges)) as Edge[],
  };
}

/* ── Store ────────────────────────────────────────────────────── */

export const useWorkflowStore = create<WorkflowStoreState>()(
  immer((set, get) => ({
    /* ── Initial state ──────────────────────────── */

    workflow: null,
    blocks: [],
    edges: [],
    nodes: [],
    flowEdges: [],

    selectedBlockId: null,
    selectedBlockIds: new Set<string>(),
    selectedEdgeId: null,

    disclosureLevel: "standard" as DisclosureLevel,

    isDirty: false,
    lastSavedAt: null,

    undoStack: [],
    redoStack: [],

    canvasHasFocus: false,

    saveStatus: "idle" as const,
    saveError: null,

    aiModifiedBlockIds: new Set<string>(),

    /* ── Workflow lifecycle ──────────────────────── */

    setWorkflow(wf) {
      set((s) => {
        s.workflow = wf;
      });
    },

    setBlocks(blocks) {
      set((s) => {
        s.blocks = blocks;
      });
    },

    setEdges(edges) {
      set((s) => {
        s.edges = edges;
      });
    },

    /* ── Block CRUD ─────────────────────────────── */

    addBlock(type, position) {
      const id = makeId();
      const state = get();

      state.pushUndo();

      const wf = state.workflow;
      const order = state.blocks.length;

      const block: WorkflowBlock = {
        id,
        workflowId: wf?.id ?? "",
        workflowVersion: wf?.activeVersion ?? 1,
        name: defaultBlockName(type),
        type,
        logic: {},
        order,
      };

      const node: Node = {
        id,
        type: nodeTypeForBlock(type),
        position: position ?? { x: 250, y: order * 150 },
        data: { block },
      };

      set((s) => {
        s.blocks.push(block);
        s.nodes.push(node);
        s.selectedBlockId = id;
        s.selectedBlockIds = new Set([id]);
        s.isDirty = true;
        s.redoStack = [];
      });

      return id;
    },

    deleteBlock(id) {
      const state = get();
      state.pushUndo();

      set((s) => {
        s.blocks = s.blocks.filter((b) => b.id !== id);
        s.nodes = s.nodes.filter((n) => n.id !== id);
        s.edges = s.edges.filter((e) => e.source !== id && e.target !== id);
        s.flowEdges = s.flowEdges.filter((e) => e.source !== id && e.target !== id);

        if (s.selectedBlockId === id) s.selectedBlockId = null;
        s.selectedBlockIds.delete(id);
        s.isDirty = true;
        s.redoStack = [];

        /* Re-index order */
        s.blocks.forEach((b, i) => {
          b.order = i;
        });
      });
    },

    deleteSelectedBlocks() {
      const state = get();
      const ids = state.selectedBlockIds;
      if (ids.size === 0) return;

      state.pushUndo();

      set((s) => {
        s.blocks = s.blocks.filter((b) => !ids.has(b.id));
        s.nodes = s.nodes.filter((n) => !ids.has(n.id));
        s.edges = s.edges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
        s.flowEdges = s.flowEdges.filter((e) => !ids.has(e.source) && !ids.has(e.target));
        s.selectedBlockId = null;
        s.selectedBlockIds = new Set();
        s.isDirty = true;
        s.redoStack = [];

        s.blocks.forEach((b, i) => {
          b.order = i;
        });
      });
    },

    updateBlockLogic(id, logic) {
      set((s) => {
        const block = s.blocks.find((b) => b.id === id);
        if (block) {
          block.logic = { ...block.logic, ...logic };
          s.isDirty = true;
        }
      });
    },

    updateBlockName(id, name) {
      set((s) => {
        const block = s.blocks.find((b) => b.id === id);
        if (block) {
          block.name = name;
          s.isDirty = true;
        }
      });
    },

    updateBlockNotes(id, notes) {
      set((s) => {
        const block = s.blocks.find((b) => b.id === id);
        if (block) {
          block.notes = notes;
          s.isDirty = true;
        }
      });
    },

    updateBlockConditions(id, conditions) {
      set((s) => {
        const block = s.blocks.find((b) => b.id === id);
        if (block) {
          block.conditions = conditions;
          s.isDirty = true;
        }
      });
    },

    duplicateBlock(id) {
      const original = get().blocks.find((b) => b.id === id);
      if (!original) return null;

      const newId = makeId();
      const state = get();
      state.pushUndo();

      const sourceNode = state.nodes.find((n) => n.id === id);
      const position = sourceNode
        ? { x: sourceNode.position.x + 40, y: sourceNode.position.y + 40 }
        : { x: 250, y: state.blocks.length * 150 };

      const block: WorkflowBlock = {
        ...JSON.parse(JSON.stringify(original)) as WorkflowBlock,
        id: newId,
        name: `${original.name} (copy)`,
        order: state.blocks.length,
      };

      const node: Node = {
        id: newId,
        type: nodeTypeForBlock(block.type),
        position,
        data: { block },
      };

      set((s) => {
        s.blocks.push(block);
        s.nodes.push(node);
        s.selectedBlockId = newId;
        s.selectedBlockIds = new Set([newId]);
        s.isDirty = true;
        s.redoStack = [];
      });

      return newId;
    },

    reorderBlocks(orderedIds) {
      const state = get();
      state.pushUndo();

      set((s) => {
        const blockMap = new Map(s.blocks.map((b) => [b.id, b]));
        s.blocks = orderedIds
          .map((id) => blockMap.get(id))
          .filter((b): b is WorkflowBlock => b !== undefined);
        s.blocks.forEach((b, i) => {
          b.order = i;
        });
        s.isDirty = true;
        s.redoStack = [];
      });
    },

    /* ── Selection ──────────────────────────────── */

    selectBlock(id) {
      set((s) => {
        s.selectedBlockId = id;
        s.selectedBlockIds = new Set([id]);
        s.selectedEdgeId = null;
      });
    },

    toggleBlockSelection(id) {
      set((s) => {
        const ids = new Set(s.selectedBlockIds);
        if (ids.has(id)) {
          ids.delete(id);
        } else {
          ids.add(id);
        }
        s.selectedBlockIds = ids;
        s.selectedBlockId = ids.size === 1 ? [...ids][0] ?? null : null;
      });
    },

    selectAllBlocks() {
      set((s) => {
        s.selectedBlockIds = new Set(s.blocks.map((b) => b.id));
        s.selectedBlockId = null;
      });
    },

    deselectAll() {
      set((s) => {
        s.selectedBlockId = null;
        s.selectedBlockIds = new Set();
        s.selectedEdgeId = null;
      });
    },

    selectEdge(id) {
      set((s) => {
        s.selectedEdgeId = id;
        s.selectedBlockId = null;
        s.selectedBlockIds = new Set();
      });
    },

    /* ── Edges ──────────────────────────────────── */

    addEdge(source, target, type = "execution", label) {
      /* Prevent self-loops and duplicate edges */
      if (source === target) return "";
      const existing = get().edges.find((e) => e.source === source && e.target === target);
      if (existing) return existing.id;

      const id = makeEdgeId();
      const state = get();
      state.pushUndo();

      const edge: WorkflowEdge = { id, source, target, type, label };

      const flowEdge: Edge = {
        id,
        source,
        target,
        type: flowEdgeType(type),
        label,
        animated: type === "goto",
        style: edgeStyle(type),
      };

      set((s) => {
        s.edges.push(edge);
        s.flowEdges.push(flowEdge);
        s.isDirty = true;
        s.redoStack = [];
      });

      return id;
    },

    deleteEdge(id) {
      const state = get();
      state.pushUndo();

      set((s) => {
        s.edges = s.edges.filter((e) => e.id !== id);
        s.flowEdges = s.flowEdges.filter((e) => e.id !== id);
        if (s.selectedEdgeId === id) s.selectedEdgeId = null;
        s.isDirty = true;
        s.redoStack = [];
      });
    },

    /* ── React Flow sync ────────────────────────── */

    setNodes(nodes) {
      set((s) => {
        s.nodes = nodes;
      });
    },

    setFlowEdges(edges) {
      set((s) => {
        s.flowEdges = edges;
      });
    },

    onNodesChange(_changes) {
      /* Handled by React Flow's internal state via controlled nodes */
    },

    /* ── Undo / redo ────────────────────────────── */

    pushUndo() {
      set((s) => {
        const snap = snapshot(s as unknown as WorkflowStoreState);
        s.undoStack.push(snap);
        if (s.undoStack.length > MAX_UNDO) {
          s.undoStack.shift();
        }
      });
    },

    undo() {
      const state = get();
      if (state.undoStack.length === 0) return;

      /* Push current to redo before restoring */
      const currentSnap = snapshot(state);

      set((s) => {
        const prev = s.undoStack.pop();
        if (!prev) return;

        s.redoStack.push(currentSnap);
        s.blocks = prev.blocks;
        s.edges = prev.edges;
        s.nodes = prev.nodes;
        s.flowEdges = prev.flowEdges;
        s.isDirty = true;
      });
    },

    redo() {
      const state = get();
      if (state.redoStack.length === 0) return;

      const currentSnap = snapshot(state);

      set((s) => {
        const next = s.redoStack.pop();
        if (!next) return;

        s.undoStack.push(currentSnap);
        s.blocks = next.blocks;
        s.edges = next.edges;
        s.nodes = next.nodes;
        s.flowEdges = next.flowEdges;
        s.isDirty = true;
      });
    },

    /* ── Dirty / save ───────────────────────────── */

    markDirty() {
      set((s) => {
        s.isDirty = true;
      });
    },

    markClean() {
      set((s) => {
        s.isDirty = false;
        s.lastSavedAt = Date.now();
      });
    },

    setSaveStatus(status, error) {
      set((s) => {
        s.saveStatus = status;
        s.saveError = error ?? null;
      });
    },

    /* ── Form ───────────────────────────────────── */

    setDisclosureLevel(level) {
      set((s) => {
        s.disclosureLevel = level;
      });
    },

    /* ── Canvas focus ───────────────────────────── */

    setCanvasHasFocus(focused) {
      set((s) => {
        s.canvasHasFocus = focused;
      });
    },

    /* ── AI tracking ────────────────────────────── */

    addAiModifiedBlockId(id) {
      set((s) => {
        s.aiModifiedBlockIds = new Set([...s.aiModifiedBlockIds, id]);
      });
    },

    clearAiModifiedBlockIds() {
      set((s) => {
        s.aiModifiedBlockIds = new Set<string>();
      });
    },

    /* ── Getters ────────────────────────────────── */

    getBlock(id) {
      return get().blocks.find((b) => b.id === id);
    },

    getSelectedBlock() {
      const { selectedBlockId, blocks } = get();
      if (!selectedBlockId) return undefined;
      return blocks.find((b) => b.id === selectedBlockId);
    },

    getChanges() {
      const { blocks, edges } = get();
      return { blocks, edges };
    },
  })),
);

/* ── Helpers for React Flow edge/node type mapping ────────────── */

function nodeTypeForBlock(type: BlockType): string {
  const category: Record<BlockType, string> = {
    object: "data", string: "data", array: "data", math: "data",
    date: "data", normalize: "data", code: "data",
    goto: "flow", sleep: "flow",
    fetch: "integration", agent: "integration",
    ui_form: "ui", ui_camera: "ui", ui_table: "ui", ui_details: "ui",
    image: "platform", filesystem: "platform", ftp: "platform",
    video: "platform", location: "platform",
  };
  return category[type] ?? "data";
}

function flowEdgeType(type: WorkflowEdge["type"]): string {
  switch (type) {
    case "goto": return "goto";
    case "conditional": return "conditional";
    default: return "execution";
  }
}

function edgeStyle(type: WorkflowEdge["type"]): React.CSSProperties {
  switch (type) {
    case "goto":
      return { stroke: "#3b82f6", strokeWidth: 2 };
    case "conditional":
      return { stroke: "#f97316", strokeWidth: 1.5, strokeDasharray: "5 5" };
    default:
      return { stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" };
  }
}

export { nodeTypeForBlock };
