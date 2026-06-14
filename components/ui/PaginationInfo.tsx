'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/cn';
import type { TMeta } from '@/types/app';

interface PaginationInfoProps {
    meta: TMeta;
    itemLabel?: string;
    className?: string;
    showWhenEmpty?: boolean;
}

function getPageRange(currentPage: number, totalPages: number) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [1];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);

    if (left > 2) pages.push('ellipsis-start');

    for (let page = left; page <= right; page += 1) {
        pages.push(page);
    }

    if (right < totalPages - 1) pages.push('ellipsis-end');

    pages.push(totalPages);
    return pages;
}

export function PaginationInfo({
    meta,
    itemLabel = 'records',
    className,
    showWhenEmpty = false,
}: PaginationInfoProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    if (!showWhenEmpty && meta.total <= 0) return null;

    const currentPage = Math.max(1, meta.page);
    const totalPages = Math.max(1, meta.totalPages);
    const from = meta.total === 0 ? 0 : (currentPage - 1) * meta.limit + 1;
    const to = Math.min(currentPage * meta.limit, meta.total);
    const pageRange = getPageRange(currentPage, totalPages);

    const hrefForPage = (page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(page));
        params.set('limit', String(meta.limit));
        return `${pathname}?${params.toString()}`;
    };

    return (
        <div
            className={cn(
                'flex flex-col gap-4 rounded-xl bg-black px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between',
                className,
            )}
        >
            <p className="text-xs text-white/70">
                Showing{' '}
                <span className="font-semibold text-white">{from}</span>
                {' - '}
                <span className="font-semibold text-white">{to}</span> of{' '}
                <span className="font-semibold text-white">{meta.total}</span>{' '}
                {itemLabel}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="text-sm text-white/70">
                    Page {currentPage} of {totalPages}
                </span>

                {totalPages > 1 && (
                    <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    href={hrefForPage(
                                        Math.max(1, currentPage - 1),
                                    )}
                                    aria-disabled={currentPage === 1}
                                    className={cn(
                                        'h-10 rounded-xl px-2 text-lg font-semibold text-white hover:bg-white/10 hover:text-white',
                                        currentPage === 1 &&
                                            'pointer-events-none opacity-50',
                                    )}
                                />
                            </PaginationItem>

                            {pageRange.map((page) =>
                                typeof page === 'number' ? (
                                    <PaginationItem key={page}>
                                        <PaginationLink
                                            asChild
                                            isActive={page === currentPage}
                                            className={cn(
                                                'size-10 rounded-2xl text-lg font-semibold text-white hover:bg-white/10 hover:text-white',
                                                page === currentPage &&
                                                    'border border-white/15 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]',
                                            )}
                                        >
                                            <Link href={hrefForPage(page)}>
                                                {page}
                                            </Link>
                                        </PaginationLink>
                                    </PaginationItem>
                                ) : (
                                    <PaginationItem key={page}>
                                        <PaginationEllipsis className="size-10 text-white" />
                                    </PaginationItem>
                                ),
                            )}

                            <PaginationItem>
                                <PaginationNext
                                    href={hrefForPage(
                                        Math.min(totalPages, currentPage + 1),
                                    )}
                                    aria-disabled={currentPage === totalPages}
                                    className={cn(
                                        'h-10 rounded-xl px-2 text-lg font-semibold text-white hover:bg-white/10 hover:text-white',
                                        currentPage === totalPages &&
                                            'pointer-events-none opacity-50',
                                    )}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}
            </div>
        </div>
    );
}
