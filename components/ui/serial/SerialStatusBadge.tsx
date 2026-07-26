import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';

// Serial lifecycle → tone, one map for the whole app. Mirrors
// service/apps/inventory/serial/lifecycle.ts statuses.
const SERIAL_TONE: Record<string, StatusTone> = {
    available: 'success',
    reserved: 'warning',
    sold: 'info',
    returned: 'warning',
    damaged: 'danger',
    scrapped: 'danger',
    removed: 'danger',
    transferred: 'info',
    inactive: 'neutral',
};

export default function SerialStatusBadge({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    return (
        <StatusBadge
            status={status}
            tone={SERIAL_TONE[status] ?? 'neutral'}
            className={className}
        />
    );
}
