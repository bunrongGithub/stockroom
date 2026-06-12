'use client';

import { useRegisterModule } from '@/hook/useModule';
import type { ModuleProps } from '@/lib/registry';

export default function Setting({ module, permission, actionModules }: ModuleProps) {
    useRegisterModule({ actionModules, permission, modulePath: module.path });

    return <div className="p-6">Setting</div>;
}
