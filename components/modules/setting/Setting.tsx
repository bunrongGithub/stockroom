'use client';

import { useModuleActions } from '@/hook/usePageAction';
import type { ModuleProps } from '@/lib/registry';

export default function Setting({ module, permission, actionModules }: ModuleProps) {
    useModuleActions({ actionModules, permission, modulePath: module.path });

    return <div className="p-6">Setting</div>;
}
