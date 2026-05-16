'use client';

import { Action } from '@/types';
import { createContext, useState } from 'react';
export interface PageActionContextValue {
    actions: Action;
    setActions: (actions: Action) => void;
}

export const PageActionContext = createContext<PageActionContextValue | null>(
    null,
);

export function PageActionContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [actions, setActions] = useState<Action>([]);

    return (
        <PageActionContext.Provider value={{ actions, setActions }}>
            {children}
        </PageActionContext.Provider>
    );
}
