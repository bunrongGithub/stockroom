import { LucideIcon } from 'lucide-react';
export type Action = Array<{
    label: string;
    href: string | null;
    type: 'user_action';
    dynamic: boolean;
    key: string;
    icon: LucideIcon | null;
}>;
