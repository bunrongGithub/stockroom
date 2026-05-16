import CategoryListForm from '@/components/forms/inventory/category/CategoryListForm';
import { notFound } from 'next/navigation';

async function page() {
    const API_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/category`;

    const res = await fetch(API_URL);
    if (!res.ok) notFound();
    const json = await res.json();
    const categoryList = json.data;
    return <CategoryListForm categories={categoryList} />;
}

export default page;
