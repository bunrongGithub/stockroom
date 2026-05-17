import dayjs from 'dayjs';

const defualtFormat = process.env.NEXT_PUBLIC_DATE_FORMART ?? 'DD-MM-YYYY';
export const DateTimeFormat = (date: string | Date, format = defualtFormat) => {
    if (date !== null && date !== undefined) {
        return dayjs(date).format(format);
    }
    return '';
};
