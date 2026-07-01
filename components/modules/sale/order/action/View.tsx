'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import OrderForm from '../OrderForm';

// Registered as `SaleOrderCreate` — the new-order form.
export default function SaleOrderCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });
    return <OrderForm mode="create" />;
}
