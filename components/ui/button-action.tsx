import { resolveHref } from '@/utils/utils';
import Link from 'next/link';

export function ButtonActionDynamicRender(
    dynamicActions: any,
    currentRow: any,
    onClick?: () => void,
) {
    if (dynamicActions) {
        return (
            <div className="flex items-center gap-2">
                {dynamicActions.map((action: any) => {
                    const Icon = action.icon;
                    if (action.label.toLowerCase() === 'delete') {
                        return (
                            <button
                                key={action.label}
                                type="button"
                                onClick={onClick}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-600 transition-colors hover:bg-rose-50 font-mono "
                            >
                                {Icon && <Icon size={13} />}
                                {action.label}
                            </button>
                        );
                    }
                    return (
                        <Link
                            key={action.label}
                            href={resolveHref(
                                action.href as string,
                                currentRow.id,
                            )}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 px-3 py-1.5 text-xs text-sky-600 transition-colors hover:bg-sky-50 font-mono"
                        >
                            {Icon && <Icon size={13} />}
                            {action.label}
                        </Link>
                    );
                })}
            </div>
        );
    }
}

export function ButtonActionStaticRender(
    staticAction: any,
    isPopup = false,
    onClick?: () => void,
) {
    if (staticAction && isPopup === false) {
        const Icon = staticAction.icon;
        return (
            <Link
                href={staticAction.href as string}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-sm shadow-sm transition- font-mono"
            >
                {Icon && <Icon size={16} />}
                {staticAction.label}
            </Link>
        );
    } else if (staticAction && isPopup === true) {
        const Icon = staticAction.icon;

        return (
            <button
                onClick={onClick}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-sm shadow-sm transition- font-mono"
            >
                {Icon && <Icon size={16} />}
                {staticAction.label}
            </button>
        );
    }
    return;
}
