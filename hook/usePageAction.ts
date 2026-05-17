'use client';

import {
    PageActionContext,
    PageActionContextValue,
} from '@/context/PageActionContext';
import { useContext } from 'react';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function usePageActions(): PageActionContextValue {
    const ctx = useContext(PageActionContext);
    if (!ctx) {
        throw new Error(
            'usePageActions must be used inside <PageActionContextProvider>',
        );
    }
    return ctx;
}
