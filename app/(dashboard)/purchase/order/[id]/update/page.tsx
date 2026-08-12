'use client';

import { use } from 'react';
import PurchaseOrderForm from '@/components/modules/purchase/PurchaseOrderForm';
import { purchaseStore } from '@/components/modules/purchase/mock/data';

export default function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    return <PurchaseOrderForm existing={purchaseStore.getPo(Number(id))} />;
}
