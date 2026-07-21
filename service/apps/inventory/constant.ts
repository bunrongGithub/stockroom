export type { ItemClass as TItemClassType } from '@/service/core/item-behavior';

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
