'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

    /** Pagination. Omit or set to 0 to disable. Default: 10 */
    pageSize?: number;
    pageSizeOptions?: number[];

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
    data,
    keyExtractor,
    searchFn,
    searchPlaceholder = 'Search...',
    toolbar,
    pageSize: pageSizeProp = DEFAULT_PAGE_SIZE,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    emptyIcon,
    emptyTitle = 'No records found',
    emptyDescription,
    emptyAction,
    className,
}: DataTableProps<T>) {
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizeProp > 0 ? pageSizeProp : DEFAULT_PAGE_SIZE);

    const paginated = pageSizeProp > 0;

    const filtered = useMemo(() => {
        setPage(1);
        if (!query.trim() || !searchFn) return data;
        return data.filter((row) => searchFn(row, query.toLowerCase()));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, query, searchFn]);

    const totalPages = paginated ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
    const safePage = Math.min(page, totalPages);

    const visible = useMemo(() => {
        if (!paginated) return filtered;
        const start = (safePage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, safePage, pageSize, paginated]);

    const from = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, filtered.length);

    const pageNumbers = useMemo(() => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | '…')[] = [1];
        if (safePage > 3) pages.push('…');
        for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) {
            pages.push(i);
        }
        if (safePage < totalPages - 2) pages.push('…');
        pages.push(totalPages);
        return pages;
    }, [totalPages, safePage]);

    return (
        <div className={cn('space-y-3', className)}>
            {/* Toolbar row */}
            {(searchFn || toolbar) && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {searchFn ? (
                        <div className="relative max-w-xs flex-1">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder={searchPlaceholder}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    ) : (
                        <div />
                    )}
                    {toolbar && (
                        <div className="flex shrink-0 items-center gap-2">{toolbar}</div>
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
                                        'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
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
                                <TableCell colSpan={columns.length} className="h-44 text-center">
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        {emptyIcon && (
                                            <div className="text-muted-foreground/40">{emptyIcon}</div>
                                        )}
                                        <p className="text-sm font-medium text-foreground">
                                            {emptyTitle}
                                        </p>
                                        {emptyDescription && (
                                            <p className="text-xs text-muted-foreground">
                                                {emptyDescription}
                                            </p>
                                        )}
                                        {emptyAction && <div className="mt-2">{emptyAction}</div>}
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
                                        const value = col.cell(row, (safePage - 1) * pageSize + index);
                                        return (
                                            <TableCell
                                                key={col.key}
                                                className={cn('py-3', col.cellClassName)}
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Record count */}
                    <p className="text-xs text-muted-foreground">
                        {filtered.length === 0
                            ? 'No records'
                            : paginated
                              ? `${from}–${to} of ${filtered.length} record${filtered.length !== 1 ? 's' : ''}${filtered.length < data.length ? ` (filtered from ${data.length})` : ''}`
                              : `${data.length} record${data.length !== 1 ? 's' : ''}`}
                    </p>

                    {/* Pagination controls — always visible when pagination is enabled */}
                    {paginated && (
                        <div className="flex items-center gap-4">
                            {/* Page size selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">
                                    Rows per page
                                </span>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(v) => {
                                        setPageSize(Number(v));
                                        setPage(1);
                                    }}
                                >
                                    <SelectTrigger className="h-7 w-14 border-0 bg-muted/50 text-xs font-medium shadow-none focus:ring-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="w-14 border-0 p-0 text-xs shadow-none">
                                        {pageSizeOptions.map((s) => (
                                            <SelectItem key={s} value={String(s)} className="text-xs">
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Page nav — only when more than 1 page */}
                            {totalPages > 1 && (
                                <div className="flex items-center gap-0.5">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-foreground"
                                        onClick={() => setPage(1)}
                                        disabled={safePage === 1}
                                    >
                                        <ChevronsLeft className="size-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-foreground"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={safePage === 1}
                                    >
                                        <ChevronLeft className="size-3.5" />
                                    </Button>

                                    {pageNumbers.map((p, i) =>
                                        p === '…' ? (
                                            <span
                                                key={`ellipsis-${i}`}
                                                className="w-7 text-center text-xs text-muted-foreground"
                                            >
                                                …
                                            </span>
                                        ) : (
                                            <Button
                                                key={p}
                                                variant="ghost"
                                                size="icon"
                                                className={cn(
                                                    'size-7 text-xs font-medium',
                                                    safePage === p
                                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                                                        : 'text-muted-foreground hover:text-foreground',
                                                )}
                                                onClick={() => setPage(p)}
                                            >
                                                {p}
                                            </Button>
                                        ),
                                    )}

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-foreground"
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={safePage === totalPages}
                                    >
                                        <ChevronRight className="size-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7 text-muted-foreground hover:text-foreground"
                                        onClick={() => setPage(totalPages)}
                                        disabled={safePage === totalPages}
                                    >
                                        <ChevronsRight className="size-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
