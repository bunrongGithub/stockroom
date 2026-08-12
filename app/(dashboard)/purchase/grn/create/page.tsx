import { Suspense } from 'react';
import GrnForm from '@/components/modules/purchase/GrnForm';

// GrnForm reads ?po= to preselect the order, so it needs a Suspense boundary.
export default function Page() {
    return (
        <Suspense fallback={null}>
            <GrnForm />
        </Suspense>
    );
}
