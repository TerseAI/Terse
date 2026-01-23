

export const randomString = (length: number) => {
    return Math.random().toString(36).substring(2, 2 + length);
}

export const isValidEpochTimestamp = (str: string): boolean => {
    const num = Number(str);
    if (!Number.isInteger(num) || num < 0) {
        return false;
    }
    const ms = str.length === 10 ? num * 1000 : num;
    const date = new Date(ms);
    return !isNaN(date.getTime()) && date.getFullYear() >= 1970 && date.getFullYear() <= 2100;
}