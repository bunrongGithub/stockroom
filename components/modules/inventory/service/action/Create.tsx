'use client';

import ServiceItemCreateForm from '@/components/forms/inventory/service/ServiceItemCreateForm';
import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';

export default function InventoryServiceItemCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });
    return <ServiceItemCreateForm />;
}
