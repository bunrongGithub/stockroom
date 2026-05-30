import { cookies } from 'next/headers';

export async function serverFetch(url: string, init?: RequestInit): Promise<Response> {
    const cookieStore = await cookies();
    return fetch(url, {
        ...init,
        headers: {
            ...init?.headers,
            cookie: cookieStore.toString(),
        },
    });
}
