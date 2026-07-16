'use client';

import { useMemo, useRef, useState } from 'react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Search,
    Settings2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/hook/use-mobile';
import type { ServerQueryBinding } from '@/hook/useTableQuery';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
} from '@/components/ui/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

/* ── Column definition ── */
export interface DataTableColumn<T> {
    key: string;
    header: string;
    cell: (row: T, index: number) => React.ReactNode;
    headerClassName?: string;
    cellClassName?: string;
    /** Text alignment for header + cells. */
    align?: 'left' | 'center' | 'right';
    /** Fixed/min column width, e.g. '140px'. */
    width?: string;
    /** The row's title column when rendered as a card on mobile. */
    primary?: boolean;
    /** Hide this column in the mobile card layout (e.g. an actions column shown in the card footer). */
    hideOnCard?: boolean;
    /** Render this column's cell as the card footer (e.g. row actions), full-width. */
    cardFooter?: boolean;
    /** Server-sortable column (serverQuery mode): header becomes a sort toggle. */
    sortable?: boolean;
    /** Sort field sent to the server; defaults to `key`. */
    sortKey?: string;
    /** May be hidden via the column-visibility menu. Default true. */
    hideable?: boolean;
}

/** One filter control in the serverQuery filter bar. */
export interface DataTableFilterDef {
    /** Registered filterable field (the repository's QueryConfig key). */
    key: string;
    label: string;
    /** 'text' sends a debounced `like:` contains-filter (works for relation fields too). */
    type: 'select' | 'boolean' | 'date-range' | 'text';
    /** Choices for type 'select'. */
    options?: { value: string; label: string }[];
    placeholder?: string;
}

const DATE_PRESETS: { value: string; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'this_year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
];

const ALL_VALUE = '__all__';

/** Pass this to enable server-driven pagination (the server already sliced the data). */
export interface ServerSidePagination {
    total: number;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (limit: number) => void;
}

/* ── Props ── */
export interface DataTableProps<T> {
    columns: DataTableColumn<T>[];
    data: T[];
    keyExtractor: (row: T) => string | number;

    /** Enables the search bar. Return true if the row matches the lowercased query. */
    searchFn?: (row: T, query: string) => boolean;
    searchPlaceholder?: string;

    /** Rendered in the top-right beside the search input (e.g. action buttons). */
    toolbar?: React.ReactNode;

    /** Client-side pagination page size. Omit or set to 0 to disable. Default: 10 */
    pageSize?: number;
    pageSizeOptions?: number[];

    /** Server-side pagination — skips client slicing and uses server totals. */
    serverSide?: ServerSidePagination;

    /**
     * Full server-query mode (Query Framework): search, sort, filters, and
     * pagination all run server-side through a useTableQuery binding.
     * Supersedes `searchFn`/`serverSide` when present.
     */
    serverQuery?: ServerQueryBinding;
    /** Filter bar controls (serverQuery mode). */
    filterDefs?: DataTableFilterDef[];
    /** Show the column-visibility menu (serverQuery mode). */
    enableColumnVisibility?: boolean;

    /**
     * Small-screen behavior:
     *   'scroll' (default) — the table scrolls horizontally.
     *   'cards' — each row renders as a stacked card below `md`.
     */
    mobileVariant?: 'scroll' | 'cards';

    /** Minimum table width before horizontal scroll kicks in (scroll variant). */
    minTableWidth?: string;

    /** Empty state */
    emptyIcon?: React.ReactNode;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyAction?: React.ReactNode;

    className?: string;
}

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const alignClass = (align?: 'left' | 'center' | 'right') =>
    align === 'right'
        ? 'text-right'
        : align === 'center'
          ? 'text-center'
          : 'text-left';

export function DataTable<T>({
    columns,
    data: dataProp,
    keyExtractor,
    searchFn,
    searchPlaceholder = 'Search...',
    toolbar,
    pageSize: pageSizeProp = DEFAULT_PAGE_SIZE,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    serverSide,
    serverQuery,
    filterDefs,
    enableColumnVisibility,
    mobileVariant = 'scroll',
    minTableWidth = '720px',
    emptyTitle = 'No records found',
    emptyDescription,
    emptyAction,
    className,
}: DataTableProps<T>) {
    const isMobile = useIsMobile();
    const asCards = mobileVariant === 'cards' && isMobile;
    const [query, setQuery] = useState(serverQuery?.state.search ?? '');
    const [page, setPage] = useState(1);
    const [pageSizeState, setPageSizeState] = useState(
        pageSizeProp > 0 ? pageSizeProp : DEFAULT_PAGE_SIZE,
    );
    const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<string>>(
        () => new Set(),
    );

    // serverQuery is a superset of serverSide — normalize to one shape.
    const server = useMemo(
        () =>
            serverQuery
                ? {
                      total: serverQuery.total,
                      page: serverQuery.state.page,
                      totalPages: serverQuery.totalPages,
                      onPageChange: serverQuery.onPageChange,
                      onPageSizeChange: serverQuery.onPageSizeChange,
                  }
                : serverSide,
        [serverQuery, serverSide],
    );

    const pageSize = serverQuery ? serverQuery.state.limit : pageSizeState;
    const paginated = serverQuery ? true : pageSizeProp > 0;

    // Guard against a null/undefined `data` prop (e.g. a page whose server-side
    // initial data failed to load) so the table renders empty instead of crashing.
    const data = useMemo(() => dataProp ?? [], [dataProp]);

    const filtered = useMemo(() => {
        // serverQuery mode: search already ran on the server.
        if (serverQuery || !query.trim() || !searchFn) return data;
        return data.filter((row) => searchFn(row, query.toLowerCase()));
    }, [data, query, searchFn, serverQuery]);

    const visibleColumns = useMemo(
        () =>
            enableColumnVisibility
                ? columns.filter((col) => !hiddenColumns.has(col.key))
                : columns,
        [columns, enableColumnVisibility, hiddenColumns],
    );

    // Server-side: server already sliced; use server totals
    const totalPages = server
        ? server.totalPages
        : paginated
          ? Math.max(1, Math.ceil(filtered.length / pageSize))
          : 1;

    const safePage = server ? server.page : Math.min(page, totalPages);

    const visible = useMemo(() => {
        if (server) return filtered; // server already paged
        if (!paginated) return filtered;
        const start = (safePage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, safePage, pageSize, paginated, server]);

    const displayTotal = server ? server.total : filtered.length;
    const from = displayTotal === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, displayTotal);

    const handlePageChange = (next: number) => {
        if (server) server.onPageChange(next);
        else setPage(next);
    };

    const handlePageSizeChange = (size: number) => {
        if (serverQuery) {
            serverQuery.onPageSizeChange(size);
            return;
        }
        setPageSizeState(size);
        if (serverSide) serverSide.onPageSizeChange?.(size);
        else setPage(1);
    };

    const handleSearchChange = (value: string) => {
        setQuery(value);
        if (serverQuery) serverQuery.onSearch(value);
        else setPage(1);
    };

    const sortState = (col: DataTableColumn<T>) => {
        if (!serverQuery) return undefined;
        const field = col.sortKey ?? col.key;
        return serverQuery.state.sort.find((s) => s.field === field)?.direction;
    };

    const pageNumbers = useMemo(() => {
        if (totalPages <= 7)
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | '…')[] = [1];
        if (safePage > 3) pages.push('…');
        for (
            let i = Math.max(2, safePage - 1);
            i <= Math.min(totalPages - 1, safePage + 1);
            i++
        ) {
            pages.push(i);
        }
        if (safePage < totalPages - 2) pages.push('…');
        pages.push(totalPages);
        return pages;
    }, [totalPages, safePage]);

    const cardColumns = visibleColumns.filter(
        (c) => !c.hideOnCard && !c.cardFooter,
    );
    const footerColumn = visibleColumns.find((c) => c.cardFooter);
    const primaryColumn = visibleColumns.find((c) => c.primary);

    const showSearch = Boolean(searchFn || serverQuery);
    const showColumnMenu = Boolean(enableColumnVisibility);

    return (
        <div className={cn('space-y-3 text-sm', className)}>
            {/* Toolbar row */}
            {(showSearch || toolbar || showColumnMenu) && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {showSearch ? (
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder={searchPlaceholder}
                                value={query}
                                onChange={(e) =>
                                    handleSearchChange(e.target.value)
                                }
                                className="pl-9"
                            />
                        </div>
                    ) : (
                        <div />
                    )}
                    {(toolbar || showColumnMenu) && (
                        <div className="flex shrink-0 items-center gap-2">
                            {showColumnMenu && (
                                <ColumnVisibilityMenu
                                    columns={columns}
                                    hidden={hiddenColumns}
                                    onChange={setHiddenColumns}
                                />
                            )}
                            {toolbar}
                        </div>
                    )}
                </div>
            )}

            {/* Filter bar (serverQuery mode) */}
            {serverQuery && filterDefs && filterDefs.length > 0 && (
                <FilterBar
                    defs={filterDefs}
                    values={serverQuery.state.filters}
                    onFilter={serverQuery.onFilter}
                />
            )}

            {/* Empty state (shared by both layouts) */}
            {visible.length === 0 ? (
                <div className="rounded-lg border border-border/60 bg-card shadow-sm">
                    <EmptyState
                        icon={undefined}
                        title={emptyTitle}
                        description={emptyDescription}
                        action={emptyAction}
                    />
                </div>
            ) : asCards ? (
                /* ── Mobile card layout ── */
                <div className="space-y-3">
                    {visible.map((row, index) => {
                        const footer = footerColumn?.cell(
                            row,
                            (safePage - 1) * pageSize + index,
                        );
                        return (
                            <div
                                key={keyExtractor(row)}
                                className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                            >
                                {primaryColumn && (
                                    <div className="mb-2 text-sm font-semibold text-foreground">
                                        {primaryColumn.cell(
                                            row,
                                            (safePage - 1) * pageSize + index,
                                        )}
                                    </div>
                                )}
                                <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-3 gap-y-1.5">
                                    {cardColumns
                                        .filter((c) => !c.primary)
                                        .map((col) => (
                                            <div
                                                key={col.key}
                                                className="contents"
                                            >
                                                <dt className="text-xs text-muted-foreground">
                                                    {col.header}
                                                </dt>
                                                <dd className="text-right text-sm text-foreground">
                                                    {col.cell(
                                                        row,
                                                        (safePage - 1) *
                                                            pageSize +
                                                            index,
                                                    ) ?? '—'}
                                                </dd>
                                            </div>
                                        ))}
                                </dl>
                                {footer && (
                                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
                                        {footer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ── Table layout (scrolls horizontally on narrow screens) ── */
                <div className="overflow-x-auto rounded-lg border border-border/60 bg-card shadow-sm">
                    <Table style={{ minWidth: minTableWidth }}>
                        <TableHeader>
                            <TableRow className="border-b border-border/60 bg-muted/50 hover:bg-muted/50">
                                {visibleColumns.map((col) => {
                                    const sortable = Boolean(
                                        serverQuery && col.sortable,
                                    );
                                    const direction = sortState(col);
                                    return (
                                        <TableHead
                                            key={col.key}
                                            style={
                                                col.width
                                                    ? { width: col.width }
                                                    : undefined
                                            }
                                            className={cn(
                                                'text-xs tracking-wide text-muted-foreground',
                                                alignClass(col.align),
                                                col.headerClassName,
                                            )}
                                        >
                                            {sortable ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        serverQuery!.onToggleSort(
                                                            col.sortKey ??
                                                                col.key,
                                                        )
                                                    }
                                                    className={cn(
                                                        'inline-flex items-center gap-1 hover:text-foreground',
                                                        direction &&
                                                            'text-foreground',
                                                    )}
                                                >
                                                    {col.header}
                                                    {direction === 'asc' ? (
                                                        <ArrowUp className="size-3.5" />
                                                    ) : direction === 'desc' ? (
                                                        <ArrowDown className="size-3.5" />
                                                    ) : (
                                                        <ArrowUpDown className="size-3.5 opacity-50" />
                                                    )}
                                                </button>
                                            ) : (
                                                col.header
                                            )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visible.map((row, index) => (
                                <TableRow
                                    key={keyExtractor(row)}
                                    className="border-b border-border/40 text-sm text-foreground transition-colors hover:bg-muted/30"
                                >
                                    {visibleColumns.map((col) => {
                                        const value = col.cell(
                                            row,
                                            (safePage - 1) * pageSize + index,
                                        );
                                        return (
                                            <TableCell
                                                key={col.key}
                                                className={cn(
                                                    'py-3',
                                                    alignClass(col.align),
                                                    col.cellClassName,
                                                )}
                                            >
                                                {value == null ? (
                                                    <span className="text-xs text-muted-foreground/50">
                                                        N/A
                                                    </span>
                                                ) : (
                                                    value
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Footer */}
            {(data.length > 0 || paginated) && (
                <div className="flex flex-col gap-4 rounded-xl text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    {/* Record count */}
                    <p className="text-xs">
                        {displayTotal === 0
                            ? 'No records'
                            : paginated
                              ? `${from}–${to} of ${displayTotal} record${displayTotal !== 1 ? 's' : ''}`
                              : `${displayTotal} record${displayTotal !== 1 ? 's' : ''}`}
                    </p>

                    {/* Pagination controls — always visible when pagination is enabled */}
                    {paginated && (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            {/* Page size selector */}
                            <div className="flex items-center gap-2">
                                <span className="">
                                    Rows per page
                                </span>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(v) =>
                                        handlePageSizeChange(Number(v))
                                    }
                                >
                                    <SelectTrigger className="h-9 w-16 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="w-10 p-0 text-xs border-none">
                                        {pageSizeOptions.map((s) => (
                                            <SelectItem
                                                key={s}
                                                value={String(s)}
                                                className="text-xs border-none"
                                            >
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Page nav — only when more than 1 page */}
                            {totalPages > 1 && (
                                <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                                    <PaginationContent className="gap-1">
                                        <PaginationItem>
                                            <Button
                                                variant="ghost"
                                                className="h-10 rounded-xl px-2"
                                                onClick={() =>
                                                    handlePageChange(
                                                        Math.max(
                                                            1,
                                                            safePage - 1,
                                                        ),
                                                    )
                                                }
                                                disabled={safePage === 1}
                                            >
                                                <ChevronLeft className="size-5" />
                                                Previous
                                            </Button>
                                        </PaginationItem>

                                        {pageNumbers.map((p, i) =>
                                            p === '…' ? (
                                                <PaginationItem
                                                    key={`ellipsis-${i}`}
                                                >
                                                    <span className="flex size-10 items-center justify-center">
                                                        …
                                                    </span>
                                                </PaginationItem>
                                            ) : (
                                                <PaginationItem key={p}>
                                                    <Button
                                                        variant={
                                                            safePage === p
                                                                ? 'default'
                                                                : 'outline'
                                                        }
                                                        size="icon"
                                                        className="size-9 rounded-lg"
                                                        onClick={() =>
                                                            handlePageChange(
                                                                p as number,
                                                            )
                                                        }
                                                    >
                                                        {p}
                                                    </Button>
                                                </PaginationItem>
                                            ),
                                        )}

                                        <PaginationItem>
                                            <Button
                                                variant="ghost"
                                                className={cn(
                                                    'h-10 rounded-xl px-2',
                                                )}
                                                onClick={() =>
                                                    handlePageChange(
                                                        Math.min(
                                                            totalPages,
                                                            safePage + 1,
                                                        ),
                                                    )
                                                }
                                                disabled={
                                                    safePage === totalPages
                                                }
                                            >
                                                Next
                                                <ChevronRight className="size-5" />
                                            </Button>
                                        </PaginationItem>
                                    </PaginationContent>
                                </Pagination>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── serverQuery mode internals ── */

function ColumnVisibilityMenu<T>({
    columns,
    hidden,
    onChange,
}: {
    columns: DataTableColumn<T>[];
    hidden: ReadonlySet<string>;
    onChange: (next: ReadonlySet<string>) => void;
}) {
    const hideable = columns.filter((col) => col.hideable !== false);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-1.5 text-xs">
                    <Settings2 className="size-4" />
                    Columns
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs">
                    Toggle columns
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideable.map((col) => (
                    <DropdownMenuCheckboxItem
                        key={col.key}
                        className="text-xs"
                        checked={!hidden.has(col.key)}
                        onCheckedChange={(checked) => {
                            const next = new Set(hidden);
                            if (checked) next.delete(col.key);
                            else next.add(col.key);
                            onChange(next);
                        }}
                    >
                        {col.header || col.key}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function FilterBar({
    defs,
    values,
    onFilter,
}: {
    defs: DataTableFilterDef[];
    values: Record<string, string>;
    onFilter: (key: string, value: string | null) => void;
}) {
    const hasActive = defs.some((def) => values[def.key]);
    return (
        <div className="flex flex-wrap items-end gap-2">
            {defs.map((def) => {
                const value = values[def.key] ?? '';
                if (def.type === 'date-range') {
                    return (
                        <DateRangeFilter
                            key={def.key}
                            def={def}
                            value={value}
                            onFilter={onFilter}
                        />
                    );
                }
                if (def.type === 'text') {
                    return (
                        <TextFilter
                            key={def.key}
                            def={def}
                            value={value}
                            onFilter={onFilter}
                        />
                    );
                }
                const options =
                    def.type === 'boolean'
                        ? [
                              { value: 'true', label: 'Yes' },
                              { value: 'false', label: 'No' },
                          ]
                        : (def.options ?? []);
                return (
                    <div key={def.key} className="space-y-1">
                        <span className="block text-[11px] text-muted-foreground">
                            {def.label}
                        </span>
                        <Select
                            value={value || ALL_VALUE}
                            onValueChange={(next) =>
                                onFilter(
                                    def.key,
                                    next === ALL_VALUE ? null : next,
                                )
                            }
                        >
                            <SelectTrigger className="h-9 w-36 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE} className="text-xs">
                                    All
                                </SelectItem>
                                {options.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                        className="text-xs"
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                );
            })}
            {hasActive && (
                <Button
                    variant="ghost"
                    className="h-9 text-xs text-muted-foreground"
                    onClick={() => defs.forEach((def) => onFilter(def.key, null))}
                >
                    Clear filters
                </Button>
            )}
        </div>
    );
}

function TextFilter({
    def,
    value,
    onFilter,
}: {
    def: DataTableFilterDef;
    value: string;
    onFilter: (key: string, value: string | null) => void;
}) {
    const external = value.startsWith('like:') ? value.slice('like:'.length) : '';
    const [text, setText] = useState(external);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Adjust-during-render: when the filter value changes from outside (e.g.
    // "Clear filters"), resync the input without clobbering in-flight typing.
    const [prevValue, setPrevValue] = useState(value);
    if (prevValue !== value) {
        setPrevValue(value);
        if (text.trim() !== external) setText(external);
    }

    const handleChange = (next: string) => {
        setText(next);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            const trimmed = next.trim();
            onFilter(def.key, trimmed ? `like:${trimmed}` : null);
        }, 300);
    };

    return (
        <div className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">
                {def.label}
            </span>
            <Input
                value={text}
                placeholder={def.placeholder ?? def.label}
                onChange={(e) => handleChange(e.target.value)}
                className="h-9 w-40 text-xs"
            />
        </div>
    );
}

function DateRangeFilter({
    def,
    value,
    onFilter,
}: {
    def: DataTableFilterDef;
    value: string;
    onFilter: (key: string, value: string | null) => void;
}) {
    const isCustom = value.startsWith('between:');
    const [customOpen, setCustomOpen] = useState(isCustom);
    const [fromDate, toDate] = isCustom
        ? value.slice('between:'.length).split(',')
        : ['', ''];

    const applyCustom = (from: string, to: string) => {
        if (from && to) onFilter(def.key, `between:${from},${to}`);
    };

    const selectValue = isCustom || customOpen ? 'custom' : value || ALL_VALUE;

    return (
        <div className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">
                {def.label}
            </span>
            <div className="flex items-center gap-1.5">
                <Select
                    value={selectValue}
                    onValueChange={(next) => {
                        if (next === 'custom') {
                            setCustomOpen(true);
                            return;
                        }
                        setCustomOpen(false);
                        onFilter(def.key, next === ALL_VALUE ? null : next);
                    }}
                >
                    <SelectTrigger className="h-9 w-36 text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_VALUE} className="text-xs">
                            All
                        </SelectItem>
                        {DATE_PRESETS.map((preset) => (
                            <SelectItem
                                key={preset.value}
                                value={preset.value}
                                className="text-xs"
                            >
                                {preset.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {(customOpen || isCustom) && (
                    <>
                        <Input
                            type="date"
                            className="h-9 w-34 text-xs"
                            value={fromDate}
                            onChange={(e) =>
                                applyCustom(e.target.value, toDate)
                            }
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input
                            type="date"
                            className="h-9 w-34 text-xs"
                            value={toDate}
                            onChange={(e) =>
                                applyCustom(fromDate, e.target.value)
                            }
                        />
                    </>
                )}
            </div>
        </div>
    );
}
