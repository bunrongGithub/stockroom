// Serial lifecycle — the single source of truth for statuses and legal
// transitions. Transactions never set statuses ad hoc; they request a
// transition through SerialManagementService, which asserts legality here.
// Kept dependency-free (local error class, no next/server) so it stays
// unit-testable under `node --test`.

export const SERIAL_STATUSES = [
    'available', // in stock, free to reserve/allocate/remove
    'reserved', // soft-held for a document (future: order reservation)
    'sold', // shipped/invoiced to a customer
    'returned', // came back from a customer, pending disposition
    'damaged', // adjustment terminal: broken
    'scrapped', // adjustment terminal: written off
    'removed', // adjustment terminal: generic negative adjustment
    'transferred', // in transit between warehouses (future: stock transfer)
    'inactive', // administratively deactivated (future: warranty/asset)
] as const;

export type SerialStatus = (typeof SERIAL_STATUSES)[number];

export class SerialLifecycleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SerialLifecycleError';
    }
}

/** from → the set of statuses it may legally move to. */
export const SERIAL_TRANSITIONS: Record<SerialStatus, readonly SerialStatus[]> = {
    available: ['reserved', 'sold', 'removed', 'damaged', 'scrapped', 'transferred', 'inactive'],
    reserved: ['available', 'sold'],
    sold: ['returned', 'available'], // 'available' = posted-shipment reversal
    returned: ['available', 'damaged', 'scrapped'],
    damaged: ['available', 'scrapped'], // 'available' = repaired
    scrapped: [], // terminal
    removed: [], // terminal
    transferred: ['available'], // arrival at destination
    inactive: ['available'], // reactivated
};

export function isSerialStatus(value: string): value is SerialStatus {
    return (SERIAL_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: SerialStatus, to: SerialStatus): boolean {
    return SERIAL_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: SerialStatus, to: SerialStatus): void {
    if (!canTransition(from, to)) {
        throw new SerialLifecycleError(
            `Illegal serial transition: ${from} → ${to}.`,
        );
    }
}
