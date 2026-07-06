import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
    // Pin the workspace root to this project. A stray lockfile in a parent
    // directory (~/package-lock.json) makes Turbopack infer the wrong root and
    // resolve `tailwindcss` from outside the project, breaking CSS compilation.
    turbopack: {
        root: path.resolve(__dirname),
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'i.ibb.co',
            },
        ],
    },
    experimental: {
        globalNotFound: true,
    },
    /* config options here */
};

export default nextConfig;
