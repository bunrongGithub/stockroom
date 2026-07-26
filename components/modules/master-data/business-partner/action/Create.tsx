'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';
import PartnerForm, { emptyDraft } from '../PartnerForm';

export default function BusinessPartnerCreate({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    return <PartnerForm mode="create" initial={emptyDraft()} />;
}
