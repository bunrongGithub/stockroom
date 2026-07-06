'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useIsMobile } from '@/hook/use-mobile';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
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
}

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
    mobileVariant = 'scroll',
    minTableWidth = '720px',
    emptyTitle = 'No records found',
    emptyDescription,
    emptyAction,
    className,
}: DataTableProps<T>) {
    const isMobile = useIsMobile();
    const asCards = mobileVariant === 'cards' && isMobile;
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(
        pageSizeProp > 0 ? pageSizeProp : DEFAULT_PAGE_SIZE,
    );

    const paginated = pageSizeProp > 0;

    // Guard against a null/undefined `data` prop (e.g. a page whose server-side
    // initial data failed to load) so the table renders empty instead of crashing.
    const data = dataProp ?? [];

    const filtered = useMemo(() => {
        if (!query.trim() || !searchFn) return data;
        return data.filter((row) => searchFn(row, query.toLowerCase()));
    }, [data, query, searchFn]);

    // Server-side: server already sliced; use server totals
    const totalPages = serverSide
        ? serverSide.totalPages
        : paginated
          ? Math.max(1, Math.ceil(filtered.length / pageSize))
          : 1;

    const safePage = serverSide ? serverSide.page : Math.min(page, totalPages);

    const visible = useMemo(() => {
        if (serverSide) return filtered; // server already paged
        if (!paginated) return filtered;
        const start = (safePage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, safePage, pageSize, paginated, serverSide]);

    const displayTotal = serverSide ? serverSide.total : filtered.length;
    const from = displayTotal === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, displayTotal);

    const handlePageChange = (next: number) => {
        if (serverSide) serverSide.onPageChange(next);
        else setPage(next);
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        if (serverSide) serverSide.onPageSizeChange?.(size);
        else setPage(1);
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

    const cardColumns = columns.filter((c) => !c.hideOnCard && !c.cardFooter);
    const footerColumn = columns.find((c) => c.cardFooter);
    const primaryColumn = columns.find((c) => c.primary);

    return (
        <div className={cn('space-y-3 text-sm', className)}>
            {/* Toolbar row */}
            {(searchFn || toolbar) && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    {searchFn ? (
                        <div className="relative max-w-md flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder={searchPlaceholder}
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setPage(1);
                                }}
                                className="pl-9"
                            />
                        </div>
                    ) : (
                        <div />
                    )}
                    {toolbar && (
                        <div className="flex shrink-0 items-center gap-2">
                            {toolbar}
                        </div>
                    )}
                </div>
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
                                {columns.map((col) => (
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
                                        {col.header}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visible.map((row, index) => (
                                <TableRow
                                    key={keyExtractor(row)}
                                    className="border-b border-border/40 text-sm text-foreground transition-colors hover:bg-muted/30"
                                >
                                    {columns.map((col) => {
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
