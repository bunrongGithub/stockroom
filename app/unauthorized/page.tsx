import Link from 'next/link';
import { ShieldX } from 'lucide-react';

export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="text-center space-y-5 max-w-sm">
                <div className="flex justify-center">
                    <div className="p-4 rounded-2xl bg-red-50">
                        <ShieldX size={40} className="text-red-400" />
                    </div>
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        You don&apos;t have permission to view this page. Contact your administrator
                        to request access.
                    </p>
                </div>
                <div className="flex gap-3 justify-center">
                    <Link
                        href="/signin"
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/inventory"
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        Inventory
                    </Link>
                </div>
            </div>
        </div>
    );
}
