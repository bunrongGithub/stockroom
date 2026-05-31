function formatDateTime(date: Date = new Date()): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

function preview(prefix: string): string {
    return `${prefix}-${formatDateTime()}`;
}

export const generateSequenNumbering = (prefix: string): string =>
    preview(prefix);

export const generateSKU = (prefix: string): string => {
    const randomNum = Math.floor(10000000 + Math.random() * 90000000);
    return `${prefix}-${randomNum}`;
};
