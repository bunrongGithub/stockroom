import LocationForm from '@/components/forms/inventory/location/LocationForm';
import { notFound } from 'next/navigation';

interface PageProps {
    searchParams: Promise<{ page?: string; limit?: string; search?: string }>;
}

export default async function BranchPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data, error } = await supabase
        .from('warehouse')
        .select(`
            *,
            user_branch!inner(user_id, role),
            stock_location(*)
        `)
        .eq('user_branch.user_id', user.id)
        .order('name');

    if (error) {
        console.error('Failed to load branches:', error.message);
    }

    const branches: BranchProps[] = data ?? [];
    return <BranchPageClient branches={branches} />;
}
