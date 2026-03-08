const toDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date, amount) => {
    const cloned = new Date(date);
    cloned.setDate(cloned.getDate() + amount);
    return cloned;
};

const normalizeRelativeDate = (text, now = new Date()) => {
    const message = String(text || '').toLowerCase();

    if (/\bhoje\b/.test(message)) return toDateString(now);
    if (/\banteontem\b/.test(message)) return toDateString(addDays(now, -2));
    if (/\bontem\b/.test(message)) return toDateString(addDays(now, -1));
    if (/\bamanh[ãa]\b/.test(message)) return toDateString(addDays(now, 1));

    const explicit = message.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (explicit) {
        const [, day, month, yearRaw] = explicit;
        const year = yearRaw ? (yearRaw.length === 2 ? `20${yearRaw}` : yearRaw) : String(now.getFullYear());
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    return toDateString(now);
};

module.exports = {
    normalizeRelativeDate,
    toDateString
};
