import { Button } from '@/components/ui/button';
import { PAGE_ACTION_CLASS } from '@/components/ui/PageHeader';
import { resolveHref } from '@/utils/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Row-action toolbar for list tables.
 *
 * Actions stay on a single line and never wrap — a wrapping cell makes every
 * row a different height and breaks the vertical rhythm of the table. The
 * table's `minTableWidth` must leave room for the widest row's actions;
 * anything past that scrolls horizontally as one unit.
 */
export function RowActions({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
            {children}
        </div>
    );
}

/**
 * `default` covers everything navigational (View, Edit, Ship). `primary` is
 * reserved for the one action that commits a document (Post); `danger` for the
 * ones that destroy or reverse it.
 */
type RowActionTone = 'default' | 'primary' | 'danger';

const ROW_ACTION_TONE: Record<RowActionTone, string> = {
    default: 'border-sky-200 text-sky-600 hover:bg-sky-50',
    primary: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
    danger: 'border-rose-200 text-rose-600 hover:bg-rose-50',
};

const ROW_ACTION_BASE =
    'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors disabled:opacity-50';

/**
 * A single row action. Renders a Link when `href` is given, otherwise a button.
 * Matches the stock item list so every module's row actions look identical.
 */
export function RowAction({
    label,
    icon,
    href,
    onClick,
    tone = 'default',
    disabled,
}: {
    label: string;
    icon?: ReactNode;
    href?: string;
    onClick?: () => void;
    tone?: RowActionTone;
    disabled?: boolean;
}) {
    const className = `${ROW_ACTION_BASE} ${ROW_ACTION_TONE[tone]}`;

    if (href && !disabled) {
        return (
            <Link href={href} className={className}>
                {icon}
                {label}
            </Link>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={className}
        >
            {icon}
            {label}
        </button>
    );
}

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
              href={resolveHref(action.href as string, currentRow.id)}
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

/**
 * A module's page-level action (Create…), driven by the `modules` table.
 *
 * Renders through `Button` + `PAGE_ACTION_CLASS` so a registry-driven action
 * and a hand-written one (`<Button className={PAGE_ACTION_CLASS}>`) are the
 * same object on screen.
 */
export function ButtonActionStaticRender(
  staticAction: any,
  isPopup = false,
  onClick?: () => void,
) {
  if (!staticAction) return;
  const Icon = staticAction.icon;
  const content = (
    <>
      {Icon && <Icon size={16} />}
      {staticAction.label}
    </>
  );

  if (isPopup === false) {
    return (
      <Button asChild className={PAGE_ACTION_CLASS}>
        <Link href={staticAction.href as string}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button onClick={onClick} className={PAGE_ACTION_CLASS}>
      {content}
    </Button>
  );
}
