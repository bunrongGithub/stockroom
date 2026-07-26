'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import CompanyForm from '../CompanyForm';

export default function CompanyCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    return <CompanyForm mode="create" />;
}
