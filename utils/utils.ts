/**
 * Replaces the ':id' token in a dataset href with the actual record id.
 *
 * resolveHref('/inventory/configurations/category/update/:id', 42)
 * → '/inventory/configurations/category/update/42'
 *
 * Static hrefs (no ':id') are returned unchanged.
 */
export function resolveHref(href: string | null | undefined, id?: number | string): string {
    if (!href) return '#';
    if (id === undefined) return href;
    return href.replace(':id', String(id));
}

type UploadImageOptions = {
    apiKey?: string;
    endpoint?: string;
    fieldName?: string;
};

export async function uploadImage(
    file: File,
    options: UploadImageOptions = {},
): Promise<string> {
    const {
        apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY,
        endpoint = 'https://api.imgbb.com/1/upload',
        fieldName = 'image',
    } = options;

    if (!file) {
        throw new Error('សូមជ្រើសរើសរូបភាពមុនពេលអាប់ឡូត។');
    }

    if (!apiKey) {
        throw new Error(
            'រកមិនឃើញ ImgBB API Key! សូមត្រួតពិនិត្យឯកសារ .env.local របស់អ្នក។',
        );
    }

    const formData = new FormData();
    formData.append(fieldName, file);

    const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        body: formData,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success || !data?.data?.url) {
        throw new Error(
            data?.error?.message ??
                'បរាជ័យក្នុងការ Upload រូបភាពទៅកាន់ ImgBB',
        );
    }

    return data.data.url as string;
}
