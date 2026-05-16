/**
 * Replaces the ':id' token in a dataset href with the actual record id.
 *
 * resolveHref('/inventory/configurations/category/update/:id', 42)
 * → '/inventory/configurations/category/update/42'
 *
 * Static hrefs (no ':id') are returned unchanged.
 */
export function resolveHref(href: string, id?: number | string): string {
    if (id === undefined) return href;
    return href.replace(':id', String(id));
}
