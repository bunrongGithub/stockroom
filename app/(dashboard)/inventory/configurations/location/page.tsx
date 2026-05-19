import { createClient } from '@/lib/supabase/server';
import { BranchProps } from '@/types/branch';
import { redirect } from 'next/navigation';
import BranchPageClient from './BranchPageClient';

export default async function BranchPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data, error } = await supabase
        .from('branch')
        .select(`
            *,
            user_branch!inner(user_id, role),
            stock_location(*)
        `)
        .eq('user_branch.user_id', user.id)
        .order('is_default', { ascending: false })
        .order('name');

    if (error) {
        console.error('Failed to load branches:', error.message);
    }

    const branches: BranchProps[] = data ?? [];
    return <BranchPageClient branches={branches} />;
}