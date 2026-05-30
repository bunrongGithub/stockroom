'use client';

import type { TAuthUserRole } from '@/service/apps/base/auth/constant';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface UserProfile {
    userId: string;
    companyId: string;
    role: TAuthUserRole;
    email: string;
}

const UserProfileContext = createContext<UserProfile | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => data && setProfile(data))
            .catch(() => setProfile(null));
    }, []);

    return (
        <UserProfileContext.Provider value={profile}>
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile() {
    return useContext(UserProfileContext);
}
