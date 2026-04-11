export const PACK_ICON_SUGGESTIONS = ['📦', '🧠', '📝', '✨', '🔖', '📚', '🎯', '🌿'];

export const PACK_COVER_PRESETS = [
  {
    id: 'sand',
    label: 'Sand',
    background: 'linear-gradient(135deg, #f4eadf 0%, #efe2d4 45%, #e3d2c1 100%)',
  },
  {
    id: 'mist',
    label: 'Mist',
    background: 'linear-gradient(135deg, #edf2f7 0%, #dfe7ef 52%, #d5dee8 100%)',
  },
  {
    id: 'moss',
    label: 'Moss',
    background: 'linear-gradient(135deg, #e8efe4 0%, #dbe6d2 48%, #c8d8bc 100%)',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    background: 'linear-gradient(135deg, #f7e4d4 0%, #f2d5c1 45%, #e5bfa2 100%)',
  },
];

export const PACK_ACTIVE_DURATION_TYPES = {
  TODAY: 'today',
  THIS_WEEK: 'this_week',
  TWO_WEEKS: 'two_weeks',
  ONE_MONTH: 'one_month',
  ONGOING: 'ongoing',
  CUSTOM: 'custom',
};

export const PACK_ACTIVE_DURATION_OPTIONS = [
  { value: PACK_ACTIVE_DURATION_TYPES.TODAY, label: 'Today' },
  { value: PACK_ACTIVE_DURATION_TYPES.THIS_WEEK, label: 'This week' },
  { value: PACK_ACTIVE_DURATION_TYPES.TWO_WEEKS, label: '2 weeks' },
  { value: PACK_ACTIVE_DURATION_TYPES.ONE_MONTH, label: '1 month' },
  { value: PACK_ACTIVE_DURATION_TYPES.ONGOING, label: 'Ongoing' },
  { value: PACK_ACTIVE_DURATION_TYPES.CUSTOM, label: 'Custom range' },
];

const normalizeTextValue = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const padDatePart = (value) => String(value).padStart(2, '0');

const toDateKey = (date) => (
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
);

const parseDateKey = (value) => {
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

const addDays = (date, amount) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const endOfWeek = (date) => addDays(date, 6 - date.getDay());

const endOfMonthWindow = (date) => {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + 1);
  nextDate.setDate(nextDate.getDate() - 1);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const formatShortDate = (dateKey) => {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export const normalizePackIcon = (value) => {
  const normalized = normalizeTextValue(value);
  if (!normalized) return null;
  return Array.from(normalized).slice(0, 2).join('');
};

export const normalizePackCover = (value) => {
  const normalized = normalizeTextValue(value);
  if (!normalized) return null;
  return PACK_COVER_PRESETS.some((preset) => preset.id === normalized) ? normalized : null;
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

const getFirstGroupValue = (tasks, selector) => {
  for (const task of tasks) {
    const value = selector(task);
    if (value) return value;
  }
  return null;
};

export const getPackIconFromTasks = (tasks = []) =>
  getFirstGroupValue(tasks, (task) => normalizePackIcon(task?.desktopGroupIcon));

export const getPackCoverFromTasks = (tasks = []) =>
  getFirstGroupValue(tasks, (task) => normalizePackCover(task?.desktopGroupCover));

export const getPackTagsFromTasks = (tasks = []) => {
  for (const task of tasks) {
    const tags = normalizePackTags(task?.desktopGroupTags);
    if (tags.length > 0) return tags;
  }
  return [];
};

export const getPackActiveDurationFromTasks = (tasks = []) => {
  for (const task of tasks) {
    const activeDurationType = normalizePackActiveDurationType(task?.desktopGroupActiveDurationType);
    if (!activeDurationType) continue;
    return {
      activeDurationType,
      activeFrom: normalizePackActiveDate(task?.desktopGroupActiveFrom) || normalizePackActiveDate(task?.dateString),
      activeUntil: normalizePackActiveDate(task?.desktopGroupActiveUntil),
    };
  }

  return {
    activeDurationType: null,
    activeFrom: null,
    activeUntil: null,
  };
};

export const getPackActiveBaseDateFromTasks = (tasks = []) => {
  const dates = tasks
    .map((task) => normalizePackActiveDate(task?.desktopGroupActiveFrom) || normalizePackActiveDate(task?.dateString))
    .filter(Boolean)
    .sort();

  return dates[0] || normalizePackActiveDate(new Date());
};

export const createPackActiveDurationFields = (activeDurationType, options = {}) => {
  const normalizedType = normalizePackActiveDurationType(activeDurationType);
  if (!normalizedType) {
    return {
      desktopGroupActiveDurationType: null,
      desktopGroupActiveFrom: null,
      desktopGroupActiveUntil: null,
    };
  }

  const baseDateKey = normalizePackActiveDate(options.activeFrom) || normalizePackActiveDate(new Date());
  const baseDate = parseDateKey(baseDateKey);
  if (!baseDate) {
    return {
      desktopGroupActiveDurationType: null,
      desktopGroupActiveFrom: null,
      desktopGroupActiveUntil: null,
    };
  }

  let activeUntil = null;
  if (normalizedType === PACK_ACTIVE_DURATION_TYPES.TODAY) {
    activeUntil = toDateKey(baseDate);
  }
  if (normalizedType === PACK_ACTIVE_DURATION_TYPES.THIS_WEEK) {
    activeUntil = toDateKey(endOfWeek(baseDate));
  }
  if (normalizedType === PACK_ACTIVE_DURATION_TYPES.TWO_WEEKS) {
    activeUntil = toDateKey(addDays(baseDate, 13));
  }
  if (normalizedType === PACK_ACTIVE_DURATION_TYPES.ONE_MONTH) {
    activeUntil = toDateKey(endOfMonthWindow(baseDate));
  }
  if (normalizedType === PACK_ACTIVE_DURATION_TYPES.CUSTOM) {
    const customUntil = normalizePackActiveDate(options.activeUntil);
    activeUntil = customUntil && customUntil >= baseDateKey ? customUntil : baseDateKey;
  }

  return {
    desktopGroupActiveDurationType: normalizedType,
    desktopGroupActiveFrom: baseDateKey,
    desktopGroupActiveUntil: normalizedType === PACK_ACTIVE_DURATION_TYPES.ONGOING ? null : activeUntil,
  };
};

export const getPackActiveLabel = (pack) => {
  const activeDurationType = normalizePackActiveDurationType(pack?.activeDurationType);
  if (!activeDurationType) return 'Set active duration';

  if (activeDurationType === PACK_ACTIVE_DURATION_TYPES.TODAY) {
    return 'Stay in Today for today';
  }
  if (activeDurationType === PACK_ACTIVE_DURATION_TYPES.THIS_WEEK) {
    return 'Stay in Today for this week';
  }
  if (activeDurationType === PACK_ACTIVE_DURATION_TYPES.TWO_WEEKS) {
    return 'Stay in Today for 2 weeks';
  }
  if (activeDurationType === PACK_ACTIVE_DURATION_TYPES.ONE_MONTH) {
    return 'Stay in Today for 1 month';
  }
  if (activeDurationType === PACK_ACTIVE_DURATION_TYPES.ONGOING) {
    return 'Stay in Today ongoing';
  }

  const dateLabel = formatShortDate(pack?.activeUntil);
  return dateLabel ? `Stay in Today until ${dateLabel}` : 'Stay in Today until chosen date';
};

export const isPackActiveOnDate = (task, dateKey) => {
  if (!task?.desktopGroupId) return task?.dateString === dateKey;

  const activeDurationType = normalizePackActiveDurationType(task?.desktopGroupActiveDurationType);
  if (!activeDurationType) return task?.dateString === dateKey;

  const activeFrom = normalizePackActiveDate(task?.desktopGroupActiveFrom) || normalizePackActiveDate(task?.dateString);
  if (!activeFrom || dateKey < activeFrom) return false;
  if (activeDurationType === PACK_ACTIVE_DURATION_TYPES.ONGOING) return true;

  const activeUntil = normalizePackActiveDate(task?.desktopGroupActiveUntil) || activeFrom;
  return dateKey <= activeUntil;
};

export const getPackCoverPreset = (coverId) =>
  PACK_COVER_PRESETS.find((preset) => preset.id === coverId) || null;
