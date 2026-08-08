import { DESKTOP_DRAG_DAY_FLIP_ZONE_PX } from '../shared/config/viewportConstants.js';
import { LANGUAGE_LOCALES } from '../shared/config/dateConstants.js';
import { translations } from '../shared/i18n/translations.js';
import { getLogicalToday } from './dateHelpers.js';

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

export const formatDesktopDayNavLabel = (date, language = 'zh') => {
  const today = getLogicalToday();
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const t = translations[language] || translations.zh;

  if (diffDays === 0) return t.today;
  if (diffDays === -1) return t.yesterday;
  if (diffDays === 1) return t.tomorrow;

  const locale = LANGUAGE_LOCALES[language] || 'zh-CN';
  const monthDayFormatter = new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' });
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  return `${monthDayFormatter.format(date)} ${weekdayFormatter.format(date)}`;
};

export const formatDesktopDayHeaderDate = (date, language = 'zh') => {
  const locale = LANGUAGE_LOCALES[language] || 'zh-CN';
  const yearMonthDayFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  return `${yearMonthDayFormatter.format(date)} ${weekdayFormatter.format(date)}`;
};

export const formatDesktopHistoryHeaderDate = (date, language = 'zh') => {
  const today = getLogicalToday();
  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const t = translations[language] || translations.zh;

  if (diffDays === 0) return `${t.today} (${formatDesktopDayHeaderDate(date, language)})`;
  if (diffDays === -1) return `${t.yesterday} (${formatDesktopDayHeaderDate(date, language)})`;
  if (diffDays === 1) return `${t.tomorrow} (${formatDesktopDayHeaderDate(date, language)})`;

  return formatDesktopDayHeaderDate(date, language);
};
