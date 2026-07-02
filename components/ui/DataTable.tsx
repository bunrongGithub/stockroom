'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
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

    /** Empty state */
    emptyIcon?: React.ReactNode;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyAction?: React.ReactNode;

    className?: string;
}

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

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
    emptyIcon,
    emptyTitle = 'No records found',
    emptyDescription,
    emptyAction,
    className,
}: DataTableProps<T>) {
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

    return (
        <div className={cn('space-y-2 font-mono text-xs', className)}>
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

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-border/60 bg-muted/50 hover:bg-muted/50">
                            {columns.map((col) => (
                                <TableHead
                                    key={col.key}
                                    className={cn(
                                        'text-xs font-mono tracking-wide text-muted-foreground',
                                        col.headerClassName,
                                    )}
                                >
                                    {col.header}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visible.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-44 text-center"
                                >
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        {emptyIcon && (
                                            <div className="text-muted-foreground/40">
                                                {emptyIcon}
                                            </div>
                                        )}
                                        <p className=" text-foreground">
                                            {emptyTitle}
                                        </p>
                                        {emptyDescription && (
                                            <p className="text-xs text-muted-foreground">
                                                {emptyDescription}
                                            </p>
                                        )}
                                        {emptyAction && (
                                            <div className="mt-2">
                                                {emptyAction}
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            visible.map((row, index) => (
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
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Footer */}
            {(data.length > 0 || paginated) && (
                <div className="flex flex-col gap-4 rounded-xl text-gray-900 sm:flex-row sm:items-center sm:justify-between">
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
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            'size-8 rounded-xl bg-gray-200',
                                                            safePage === p &&
                                                                'shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
                                                        )}
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
