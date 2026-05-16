import { LucideIcon } from 'lucide-react';
export type Action = Array<{
    label: string;
    icon: LucideIcon | null;
    href: string | null;
    type: 'user_action';
}>;
export type TMenuType =
    | 'module'
    | 'menu'
    | 'submenu'
    | 'configuration'
    | 'button';
export type TModule = Array<{
    ordering: number;
    icon: LucideIcon | null;
    label: string;
    parent: TModule | null;
    href: string;
    menu: Array<TMenuItem> | null;
    type: TMenuType;
}>;
export type TMenuItem = {
    ordering: number;
    icon: LucideIcon | null;
    label: string;
    href: string;
    type: TMenuType;
    action?: Action;
    children?: Array<TMenuItem>;
};
