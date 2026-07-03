export type SerialStatus =
    | 'available'
    | 'sold'
    | 'reserved'
    | 'damaged'
    | 'scrapped';

export class SerialValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SerialValidationError';
    }
}

export type ValidateSerialSelectionInput = {
    quantity: number;
    serials: string[];
    existingStatuses?: Map<string, SerialStatus>;
};

/**
 * Pure guard for serial selection: the number of (deduped) serials must equal
 * the quantity, and any serial whose status is known must be `available`.
 * Warehouse/location + existence are enforced separately by the repository
 * (findSelectableForSale) against the database.
 *
 * Kept dependency-free (throws SerialValidationError, not ApiError) so it stays
 * unit-testable in isolation; callers translate it to an HTTP ApiError.
 */
export function validateSerialSelection({
    quantity,
    serials,
    existingStatuses = new Map(),
}: ValidateSerialSelectionInput): string[] {
    const selected = [...new Set(serials.filter(Boolean))];

    if (selected.length !== quantity) {
        throw new SerialValidationError(
            `Selected serial count must match the quantity (${quantity}).`,
        );
    }

    for (const serial of selected) {
        const status = existingStatuses.get(serial);
        if (status && status !== 'available') {
            throw new SerialValidationError(
                `Serial ${serial} is not available for sale.`,
            );
        }
    }

    return selected;
}
