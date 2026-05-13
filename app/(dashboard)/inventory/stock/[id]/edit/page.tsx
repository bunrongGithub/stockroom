import InventoryForm from '@/components/forms/inventory/InventoryForm';

export default async function page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return <InventoryForm itemId={id} />;
}
