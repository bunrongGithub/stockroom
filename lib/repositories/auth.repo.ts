import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoginInput, SignupInput } from '@/lib/validations/auth.schema';

export type AuthUser = {
    id: string;
    email: string;
};

export type LoginResult = {
    user: AuthUser;
};

export type SignupResult = {
    user: AuthUser;
    requiresConfirmation: boolean;
};

export class AuthRepository {
    private static instance: AuthRepository;
    private clientPromise: Promise<SupabaseClient> | null = null;

    private constructor() {}

    static getInstance(): AuthRepository {
        if (!AuthRepository.instance) {
            AuthRepository.instance = new AuthRepository();
        }
        return AuthRepository.instance;
    }

    private getClient(): Promise<SupabaseClient> {
        if (!this.clientPromise) {
            this.clientPromise = createClient();
        }
        return this.clientPromise;
    }

    async signIn(input: LoginInput): Promise<LoginResult> {
        const supabase = await this.getClient();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: input.email,
            password: input.password,
        });

        if (error) throw new Error(error.message);
        if (!data.user) throw new Error('Login failed');

        return {
            user: { id: data.user.id, email: data.user.email! },
        };
    }

    async signUp(input: SignupInput): Promise<SignupResult> {
        const supabase = await this.getClient();
        const { data, error } = await supabase.auth.signUp({
            email: input.email,
            password: input.password,
        });

        if (error) throw new Error(error.message);
        if (!data.user) throw new Error('Signup failed');

        // Email confirmation not required — session is available immediately
        if (data.session) {
            const companyName =
                input.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ') +
                "'s Company";

            const { data: company, error: companyError } = await supabase
                .from('company')
                .insert({ name: companyName })
                .select('id')
                .single();

            if (companyError) throw new Error(companyError.message);

            const { error: profileError } = await supabase
                .from('profiles')
                .update({ company_id: company.id, role: 'staff' })
                .eq('id', data.user.id);

            if (profileError) throw new Error(profileError.message);

            return {
                user: { id: data.user.id, email: data.user.email! },
                requiresConfirmation: false,
            };
        }

        return {
            user: { id: data.user.id, email: data.user.email! },
            requiresConfirmation: true,
        };
    }
}
