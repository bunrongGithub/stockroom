import InventoryForm from '@/components/inventory/InventoryForm';

interface EditInventoryPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EditInventoryPage({
    params,
}: EditInventoryPageProps) {
    const { id } = await params;

    return <InventoryForm itemId={id} />;
}
