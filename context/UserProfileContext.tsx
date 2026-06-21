'use client';

import { fetchCurrentUser } from '@/lib/api/auth';
import type { TAuthUserRole } from '@/service/apps/base/auth/constant';
import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

export interface UserProfile {
    userId: string;
    companyId: string;
    role: TAuthUserRole;
    email: string;
}

const USER_CACHE_KEY = 'current_login_user_info' as const;

function readUserCache(): UserProfile | null {
    try {
        const raw = localStorage.getItem(USER_CACHE_KEY);
        return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
        return null;
    }
}

function writeUserCache(profile: UserProfile) {
    try {
        localStorage.setItem(USER_CACHE_KEY, JSON.stringify(profile));
    } catch {
        // localStorage might be unavailable
    }
}

export function clearCurrentUserCache() {
    try {
        localStorage.removeItem(USER_CACHE_KEY);
    } catch {
        // noop
    }
}

const UserProfileContext = createContext<UserProfile | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const fetchedRef = useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        const cached = readUserCache();
        if (cached) {
            setProfile(cached);
            return;
        }

        fetchCurrentUser()
            .then((data) => {
                if (data) {
                    setProfile(data as UserProfile);
                    writeUserCache(data as UserProfile);
                }
            })
            .catch(() => setProfile(null));
    }, []);

    return (
        <UserProfileContext.Provider value={profile}>
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile(): UserProfile | null {
    return useContext(UserProfileContext);
}
