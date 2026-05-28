'use client';

import { supabase } from '@/lib/supabase/client';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export type UserRole = 'owner' | 'manager' | 'staff';

export interface UserProfile {
    userId: string;
    companyId: number;
    role: UserRole;
}

const UserProfileContext = createContext<UserProfile | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const load = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                setProfile(null);
                return;
            }

            const { data } = await supabase
                .from('profiles')
                .select('company_id, role')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile({
                    userId: user.id,
                    companyId: data.company_id,
                    role: data.role as UserRole,
                });
            }
        };

        load();

        const { data: listener } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') load();
            if (event === 'SIGNED_OUT') setProfile(null);
        });
        console.log(profile);

        return () => listener.subscription.unsubscribe();
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
