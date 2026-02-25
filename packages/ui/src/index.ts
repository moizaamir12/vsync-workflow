/* ══════════════════════════════════════════════════════════════
 *  @vsync/ui — Shared React component library
 *
 *  This barrel export exposes every public component, hook, utility,
 *  and design-token definition from the package.
 * ══════════════════════════════════════════════════════════════ */

/* ── Theme & tokens ──────────────────────────────────────────── */

export {
  lightTheme,
  darkTheme,
  themeToCSS,
  themeToStyleString,
  type ThemeTokens,
} from "./theme/tokens.js";

export {
  ThemeProvider,
  useTheme,
  type OrgTheme,
  type ThemeProviderProps,
} from "./theme/ThemeProvider.js";

/* ── Design tokens (raw values) ──────────────────────────────── */

export {
  colors,
  darkColors,
  spacing,
  borderRadius,
  fontFamily,
  fontSize,
  breakpoints,
  shadow,
} from "./styles/tokens.js";

/* ── Utilities ────────────────────────────────────────────────── */

export {
  cn,
  formatDuration,
  truncate,
  stringToColor,
} from "./lib/utils.js";

/* ── Primitives ──────────────────────────────────────────────── */

export {
  Button,
  buttonVariants,
  type ButtonProps,
} from "./components/primitives/Button.js";

export {
  Input,
  type InputProps,
} from "./components/primitives/Input.js";

export {
  Textarea,
  type TextareaProps,
} from "./components/primitives/Textarea.js";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/primitives/Select.js";

export {
  Checkbox,
  type CheckboxProps,
} from "./components/primitives/Checkbox.js";

export {
  Switch,
  type SwitchProps,
} from "./components/primitives/Switch.js";

export {
  Badge,
  badgeVariants,
  type BadgeProps,
} from "./components/primitives/Badge.js";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/primitives/Card.js";

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/primitives/Dialog.js";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/primitives/DropdownMenu.js";

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "./components/primitives/Tabs.js";

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/primitives/Tooltip.js";

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/primitives/Popover.js";

export {
  Separator,
  type SeparatorProps,
} from "./components/primitives/Separator.js";

export { Skeleton } from "./components/primitives/Skeleton.js";

export {
  ScrollArea,
  type ScrollAreaProps,
} from "./components/primitives/ScrollArea.js";

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "./components/primitives/Sheet.js";

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  type AvatarFallbackProps,
} from "./components/primitives/Avatar.js";

export {
  Toaster,
  toast,
  type ToasterProps,
} from "./components/primitives/Toaster.js";

/* ── Layout ──────────────────────────────────────────────────── */

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarToggle,
  SidebarNavItem,
  SidebarGroup,
  SidebarProvider,
  useSidebar,
  type SidebarProps,
  type SidebarProviderProps,
  type SidebarNavItemProps,
  type SidebarGroupProps,
} from "./components/layout/Sidebar.js";

export {
  Header,
  Breadcrumb,
  type HeaderProps,
  type BreadcrumbItem,
  type BreadcrumbProps,
} from "./components/layout/Header.js";

export {
  PageLayout,
  type PageLayoutProps,
} from "./components/layout/PageLayout.js";

export {
  EmptyState,
  type EmptyStateProps,
} from "./components/layout/EmptyState.js";

/* ── Data display ────────────────────────────────────────────── */

export {
  DataTable,
  type DataTableProps,
} from "./components/data/DataTable.js";

export {
  StatusBadge,
  type StatusBadgeProps,
} from "./components/data/StatusBadge.js";

export {
  KeyValueDisplay,
  type KeyValuePair,
  type KeyValueDisplayProps,
} from "./components/data/KeyValueDisplay.js";

/* ── Workflow builder ─────────────────────────────────────────── */

/* Store */
export {
  useWorkflowStore,
  nodeTypeForBlock,
  type BlockType,
  type WorkflowBlock,
  type WorkflowMeta,
  type WorkflowEdge,
  type DisclosureLevel,
  type WorkflowStoreState,
} from "./stores/workflowStore.js";

/* Canvas & layout */
export {
  WorkflowCanvas,
  type WorkflowCanvasProps,
} from "./components/workflow/WorkflowCanvas.js";
export { applyDagreLayout } from "./components/workflow/layout.js";

/* Node types */
export { DataBlockNode } from "./components/workflow/nodes/DataBlockNode.js";
export { FlowBlockNode } from "./components/workflow/nodes/FlowBlockNode.js";
export { IntegrationBlockNode } from "./components/workflow/nodes/IntegrationBlockNode.js";
export { UIBlockNode } from "./components/workflow/nodes/UIBlockNode.js";
export { PlatformBlockNode } from "./components/workflow/nodes/PlatformBlockNode.js";
export { BaseNode, type BlockNodeData, type BaseNodeProps } from "./components/workflow/nodes/base-node.js";

/* Edge types */
export { ExecutionEdge } from "./components/workflow/edges/ExecutionEdge.js";
export { GotoEdge } from "./components/workflow/edges/GotoEdge.js";
export { ConditionalEdge } from "./components/workflow/edges/ConditionalEdge.js";

/* Palette */
export {
  BlockPalette,
  allBlocks,
  categories,
  type BlockPaletteProps,
  type PaletteBlockDef,
  type BlockCategory,
} from "./components/workflow/BlockPalette.js";

/* Inspector */
export {
  BlockInspector,
  type BlockInspectorProps,
} from "./components/workflow/BlockInspector.js";

/* Block form switch */
export {
  BlockForm,
  type BlockFormProps,
} from "./components/workflow/BlockForm.js";

/* Smart input */
export {
  SmartInput,
  type SmartInputProps,
  type VariableOption,
} from "./components/workflow/SmartInput.js";

/* Condition builder */
export {
  ConditionBuilder,
  type ConditionBuilderProps,
  type ConditionGroup,
  type ConditionRow,
  type ConditionOperator,
  type ConditionJoin,
} from "./components/workflow/ConditionBuilder.js";

/* Toolbar */
export {
  WorkflowToolbar,
  type WorkflowToolbarProps,
} from "./components/workflow/WorkflowToolbar.js";

/* Public workflow runner */
export {
  PublicWorkflowRunner,
  type PublicWorkflowRunnerProps,
  type PublicRunState,
} from "./components/workflow/PublicWorkflowRunner.js";

/* Form field helpers */
export {
  FormField,
  FormSection,
  type FormFieldProps,
  type FormSectionProps,
} from "./components/workflow/forms/FormField.js";

/* AI Assistant */
export {
  AIAssistant,
  type AIAssistantProps,
  type ChatMessage,
  type PlanStep,
} from "./components/workflow/AIAssistant.js";

export { AiMarkdown } from "./components/workflow/ai-markdown.js";

/* ── Re-export useful upstream types ─────────────────────────── */

export type { VariantProps } from "class-variance-authority";
export type { ColumnDef } from "@tanstack/react-table";
