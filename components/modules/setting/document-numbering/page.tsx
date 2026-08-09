'use client';

import type { ModuleProps } from '@/lib/registry';
import { useRegisterModule } from '@/hook/useModule';
import DocumentNumberingPage from './DocumentNumberingPage';

/**
 * Registry entry for Settings → Document Numbering.
 *
 * The page loads its own rows through the configuration API (which decorates
 * each with registry metadata and a rendered preview), so the module row is
 * is_initial_data = false and there is no server-preloaded list to thread in.
 */
export default function DocumentNumberingModule({
    currentPath,
    permission,
    currentPathActions,
}: ModuleProps) {
    useRegisterModule({
        actionModules: currentPathActions,
        permission,
        modulePath: currentPath.path,
    });

    return <DocumentNumberingPage />;
}
