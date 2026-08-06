export const PACK_ACTIVE_DURATION_TYPES = {
  TODAY: 'today',
  THIS_WEEK: 'this_week',
  TWO_WEEKS: 'two_weeks',
  ONE_MONTH: 'one_month',
  ONGOING: 'ongoing',
  CUSTOM: 'custom',
};

const ALLOWED_PACK_COVER_IDS = ['sand', 'mist', 'moss', 'sunset'];

export const normalizeTextValue = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const padDatePart = (value) => String(value).padStart(2, '0');

export const toDateKey = (date) => (
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
);

export const parseDateKey = (value) => {
  const normalized = normalizeTextValue(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  const nextDate = new Date(year, month - 1, day);
  if (Number.isNaN(nextDate.getTime())) return null;
  if (
    nextDate.getFullYear() !== year
    || nextDate.getMonth() !== month - 1
    || nextDate.getDate() !== day
  ) {
    return null;
  }
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

export const normalizePackIcon = (value) => {
  const normalized = normalizeTextValue(value);
  if (!normalized) return null;
  return Array.from(normalized).slice(0, 2).join('');
};

export const normalizePackCover = (value) => {
  const normalized = normalizeTextValue(value);
  if (!normalized) return null;
  return ALLOWED_PACK_COVER_IDS.includes(normalized) ? normalized : null;
};

export const normalizePackTags = (value) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const seen = new Set();

  return values
    .map((entry) => normalizeTextValue(entry))
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
};

export const normalizePackActiveDurationType = (value) => {
  const normalized = normalizeTextValue(value);
  return Object.values(PACK_ACTIVE_DURATION_TYPES).includes(normalized) ? normalized : null;
};

export const normalizePackActiveDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toDateKey(value);
  const parsed = parseDateKey(value);
  return parsed ? toDateKey(parsed) : null;
};
