export const RECENT_PACK_UPDATE_HOURS = 24;
export const UPDATED_RECENTLY_LABEL = 'Updated recently';

const SAME_YEAR_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const normalizeDate = (value) => {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const createUpdatedTimestamp = (date = new Date()) => date.toISOString();

export const getPackUpdatedAt = (items = []) => {
  const values = Array.isArray(items) ? items : [items];
  let latestDate = null;

  values.forEach((item) => {
    const candidate = normalizeDate(item?.updatedAt || item?.updated_at);
    if (!candidate) return;
    if (!latestDate || candidate > latestDate) {
      latestDate = candidate;
    }
  });

  return latestDate;
};

export const formatPackUpdatedDate = (value, now = new Date()) => {
  const updatedDate = normalizeDate(value);
  if (!updatedDate) return '';

  if (updatedDate.getFullYear() !== now.getFullYear()) {
    return `${updatedDate.getFullYear()}/${updatedDate.getMonth() + 1}/${updatedDate.getDate()}`;
  }

  return SAME_YEAR_DATE_FORMATTER.format(updatedDate);
};

export const getPackMetadataText = (
  updatedAt,
  { now = new Date(), recentUpdateHours = RECENT_PACK_UPDATE_HOURS } = {},
) => {
  const updatedDate = normalizeDate(updatedAt);
  if (!updatedDate) return '';

  const thresholdMs = recentUpdateHours * 60 * 60 * 1000;
  if ((now.getTime() - updatedDate.getTime()) <= thresholdMs) {
    return UPDATED_RECENTLY_LABEL;
  }

  return formatPackUpdatedDate(updatedDate, now);
};

export const getPackMetadataTextFromItems = (items, options) =>
  getPackMetadataText(getPackUpdatedAt(items), options);

export const PACK_METADATA_SAMPLE_NOW = '2026-04-10T12:00:00.000Z';

export const PACK_METADATA_SAMPLE_CASES = [
  {
    id: 'updated-recently',
    updatedAt: '2026-04-10T10:30:00.000Z',
    expectedLabel: getPackMetadataText('2026-04-10T10:30:00.000Z', {
      now: new Date(PACK_METADATA_SAMPLE_NOW),
    }),
  },
  {
    id: 'updated-yesterday',
    updatedAt: '2026-04-09T09:00:00.000Z',
    expectedLabel: getPackMetadataText('2026-04-09T09:00:00.000Z', {
      now: new Date(PACK_METADATA_SAMPLE_NOW),
    }),
  },
  {
    id: 'updated-several-days-ago',
    updatedAt: '2026-04-04T14:00:00.000Z',
    expectedLabel: getPackMetadataText('2026-04-04T14:00:00.000Z', {
      now: new Date(PACK_METADATA_SAMPLE_NOW),
    }),
  },
];
