import CategoryCreateForm from '@/components/forms/inventory/category/CategoryFormCreate';
async function page() {
    return (
        <div className="p-4 md:p-8">
            <CategoryCreateForm />
        </div>
    );
}

export default page;
