export const BASE_URL =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const API_BASE_URL = `${BASE_URL}/api`;

export const apiUrl = (configurationPath: string) =>
    `${API_BASE_URL}${configurationPath}`;
