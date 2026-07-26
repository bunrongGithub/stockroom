'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import UomForm from '../UomForm';

export default function InventoryUomCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    return <UomForm mode="create" />;
}
