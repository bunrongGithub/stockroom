import { DateTimeFormat } from './dateformat';
function preview(prefix: string) {
    return `${prefix}-${DateTimeFormat(Date())}`;
}
export const generateSequenNumbering = (prefix: string) => preview(prefix);
