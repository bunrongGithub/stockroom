/**
 * Shared date/time formatting. One place so audit stamps, documents, and lists
 * read the same everywhere.
 */

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
});

const DATE_ONLY = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

/** e.g. "15 Jul 2026, 10:20 AM". Returns "—" for empty/invalid input. */
export function formatDateTime(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return DATE_TIME.format(d);
}

/** e.g. "15 Jul 2026". Returns "—" for empty/invalid input. */
export function formatDate(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return DATE_ONLY.format(d);
}
