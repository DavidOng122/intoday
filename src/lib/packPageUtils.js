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

const normalizeTextValue = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim();
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

export const getPackCoverPreset = (coverId) =>
  PACK_COVER_PRESETS.find((preset) => preset.id === coverId) || null;
