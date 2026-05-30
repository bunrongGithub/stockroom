import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
