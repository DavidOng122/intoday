import { DESKTOP_DRAG_DAY_FLIP_ZONE_PX, LANGUAGE_LOCALES } from './desktopConstants';
import { getLogicalToday } from './dateHelpers';
import { translations } from './translations';

export const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const shiftDateByDays = (date, dayOffset) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
};

export const getDesktopDayFlipZones = (viewportRect) => {
  const edgeZone = DESKTOP_DRAG_DAY_FLIP_ZONE_PX;
  return {
    mode: 'edge',
    previousStart: viewportRect.left,
    previousEnd: viewportRect.left + edgeZone,
    nextStart: viewportRect.right - edgeZone,
    nextEnd: viewportRect.right,
  };
};

export const parseSharedSelectedDate = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const panelLabel = (date, language) => {
  const t = getTranslationsForLanguage(language);
  if (sameDay(date, getLogicalToday())) {
    return t.today;
  }

  return date.toLocaleDateString(getLocaleForLanguage(language), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

export const getCalendarWeekdayLabels = (language) => {
  const locale = getLocaleForLanguage(language);
  const baseSunday = new Date(Date.UTC(2024, 0, 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(baseSunday);
    date.setUTCDate(baseSunday.getUTCDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(date);
  });
};

export const getLocaleForLanguage = (language) => LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES.EN;

export const getTranslationsForLanguage = (language) => translations[language] || translations.EN;

export const formatTemplate = (template, values) => Object.entries(values).reduce(
  (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
  template,
);