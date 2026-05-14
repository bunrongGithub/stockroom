import { LucideIcon } from "lucide-react";

export type TMenuType = 'module' | 'menu' | 'submenu' | 'configuration';
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
    action?: Array<string>;
    children?: Array<TMenuItem>;
};
