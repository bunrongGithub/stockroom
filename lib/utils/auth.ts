export type CurrentUser = {
    userId: string;
    companyId: string;
    role: string;
    email: string;
};
// The client api
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return null;
    return res.json() as Promise<CurrentUser>;
}
