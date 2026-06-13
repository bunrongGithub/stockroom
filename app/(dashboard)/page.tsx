'use client';

import { useApp } from '@/context/AppContext';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardHome() {
    const { visibleRootModules } = useApp();

    const router = useRouter();
    useEffect(() => {
        const first = visibleRootModules[0];
        if (first) {
            router.replace(first.path);
        }
    }, [visibleRootModules, router]);

    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-emerald-500" size={28} />
        </div>
    );
}
