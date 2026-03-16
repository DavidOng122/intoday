import {
  CARD_TYPES,
  extractMapUrl,
  extractMeetingUrl,
  extractPrimaryUrl,
  normalizeCardType,
} from '../lib/cardTypeDetection';

const TASK_URL_FIELD_PRIORITY = Object.freeze({
  [CARD_TYPES.MEETING]: ['meetingUrl', 'redirectUrl'],
  [CARD_TYPES.VIDEO]: ['videoUrl', 'redirectUrl'],
  [CARD_TYPES.PLACE]: ['mapUrl', 'redirectUrl'],
  [CARD_TYPES.DOCUMENT]: ['documentUrl', 'redirectUrl'],
  [CARD_TYPES.MUSIC]: ['musicUrl', 'redirectUrl'],
  [CARD_TYPES.PODCAST]: ['podcastUrl', 'redirectUrl'],
  [CARD_TYPES.SOCIAL]: ['socialUrl', 'redirectUrl'],
  [CARD_TYPES.SHOPPING]: ['shoppingUrl', 'redirectUrl'],
  [CARD_TYPES.FINANCIAL]: ['financialUrl', 'redirectUrl'],
  [CARD_TYPES.LINK]: ['redirectUrl'],
});

const ABSOLUTE_URL_SCHEME_REGEX = /^[a-z][a-z\d+.-]*:/i;

const normalizeUrlCandidate = (value) => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;

  try {
    const parsed = ABSOLUTE_URL_SCHEME_REGEX.test(candidate)
      ? new URL(candidate)
      : new URL(candidate, window.location.origin);

    if (!parsed.protocol) return null;

    return ABSOLUTE_URL_SCHEME_REGEX.test(candidate) ? candidate : parsed.toString();
  } catch {
    return null;
  }
};

const getTaskTextFallbackUrls = (task, cardType) => {
  const text = task?.text || '';

  switch (cardType) {
    case CARD_TYPES.MEETING:
      return [extractMeetingUrl(text), extractPrimaryUrl(text)];
    case CARD_TYPES.PLACE:
      return [extractMapUrl(text), extractPrimaryUrl(text)];
    default:
      return [extractPrimaryUrl(text)];
  }
};

export const getTaskUrlCandidates = (task) => {
  const cardType = normalizeCardType(task?.cardType);
  const prioritizedFields = TASK_URL_FIELD_PRIORITY[cardType] || [];
  const fieldCandidates = prioritizedFields.map((field) => task?.[field]);
  return [...fieldCandidates, ...getTaskTextFallbackUrls(task, cardType)];
};

export const resolveTaskUrl = (task) => {
  const candidates = getTaskUrlCandidates(task);

  for (const candidate of candidates) {
    const normalized = normalizeUrlCandidate(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};
