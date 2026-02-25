import { useState, useRef, useCallback, type ReactNode } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type PaginationState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Button } from "../primitives/Button.js";
import { Input } from "../primitives/Input.js";

/* ── Props ────────────────────────────────────────────────────── */

export interface DataTableProps<TData> {
  /** Column definitions from @tanstack/react-table */
  columns: ColumnDef<TData, unknown>[];
  /** Array of row data */
  data: TData[];
  /** Global search filter column key */
  searchKey?: string;
  /** Placeholder for the search input */
  searchPlaceholder?: string;
  /** Enable row selection */
  enableSelection?: boolean;
  /** Enable virtualization for large datasets (500+ rows) */
  enableVirtualization?: boolean;
  /** Fixed row height for virtual scrolling (default 48px) */
  rowHeight?: number;
  /** Max visible height of the scroll container (default 600px) */
  maxHeight?: number;
  /** Content rendered above the table (actions, filters) */
  toolbar?: ReactNode;
  /** Content rendered below the table (summary, bulk actions) */
  footer?: ReactNode;
  /** Callback when row selection changes */
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** CSS class for the wrapper */
  className?: string;
  /** Show pagination controls */
  enablePagination?: boolean;
  /** Rows per page (default 25) */
  pageSize?: number;
}

/* ── Component ────────────────────────────────────────────────── */

export function DataTable<TData>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  enableSelection = false,
  enableVirtualization = false,
  rowHeight = 48,
  maxHeight = 600,
  toolbar,
  footer,
  onRowSelectionChange,
  className,
  enablePagination = true,
  pageSize = 25,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => {
      setRowSelection((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        onRowSelectionChange?.(next);
        return next;
      });
    },
    [onRowSelectionChange],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      ...(enablePagination ? { pagination } : {}),
    },
    enableRowSelection: enableSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: enableSelection ? handleRowSelectionChange : undefined,
    onPaginationChange: enablePagination ? setPagination : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  });

  const { rows } = table.getRowModel();

  /* ── Virtualizer (optional) ──────────────────────────── */

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
    enabled: enableVirtualization,
  });

  const virtualRows = enableVirtualization ? virtualizer.getVirtualItems() : null;
  const totalHeight = enableVirtualization ? virtualizer.getTotalSize() : 0;

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar: search + custom actions */}
      <div className="flex items-center gap-4">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              table.getColumn(searchKey)?.setFilterValue(e.target.value)
            }
            className="max-w-sm"
          />
        )}
        {toolbar}
      </div>

      {/* Table container */}
      <div
        ref={scrollRef}
        className="rounded-md border border-[hsl(var(--border))]"
        style={enableVirtualization ? { maxHeight, overflow: "auto" } : undefined}
      >
        <table className="w-full caption-bottom text-sm">
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-[hsl(var(--muted))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[hsl(var(--border))]">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="h-10 px-4 text-left align-middle font-medium text-[hsl(var(--muted-foreground))] [&:has([role=checkbox])]:pr-0"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-[hsl(var(--foreground))]"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody
            style={enableVirtualization ? { height: totalHeight, position: "relative" } : undefined}
          >
            {enableVirtualization && virtualRows
              ? virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  if (!row) return null;
                  return (
                    <tr
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      className="border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--muted))]/50 data-[state=selected]:bg-[hsl(var(--muted))]"
                      style={{
                        height: rowHeight,
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className="border-b border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--muted))]/50 data-[state=selected]:bg-[hsl(var(--muted))]"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2 align-middle [&:has([role=checkbox])]:pr-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-[hsl(var(--muted-foreground))]">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination / footer */}
      <div className="flex items-center justify-between">
        {enableSelection && (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
        )}

        {!enableSelection && footer}

        {enablePagination && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
