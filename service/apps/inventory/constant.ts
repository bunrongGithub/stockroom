export type TItemClassType = 'stock' | 'non-stock';

export type TItemMovementType =
    | 'stock-in'
    | 'stock-out'
    | 'adjustment'
    | 'transfer-in'
    | 'transfer-out'
    | 'opening-stock'
    | 'closing-stock';

export type TItemMovementSource = 'purchase' | 'sale';

export type TTransactionStatus = 'pending' | 'completed' | 'cancelled';
