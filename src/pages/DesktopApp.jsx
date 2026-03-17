import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { PenLine, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import DesktopLogin from '../DesktopLogin';
import { useSyncedTodos } from '../todoSync';
import { getUserProfile } from '../userProfile';
import DesktopProfilePage from '../components/DesktopProfilePage';
import IntoDayLogo from '../components/IntoDayLogo';
import { DAY_BOUNDARY_HOUR, getLogicalToday } from '../lib/dateHelpers';
import { timeBlocks } from '../lib/timeBlocks';
import { translations } from '../lib/translations';
import {
  fetchMapMeta,
  fetchVideoMeta,
  fetchSpotifyMeta,
  fetchLinkPreviewMeta,
  getDerivedTaskFields,
  getTaskCardPresentation,
  normalizeCardType,
} from '../taskCardUtils';
import { useTaskInteraction } from '../task-interactions/useTaskInteraction';
import { trackUserEvent } from '../lib/analytics';

const SHARED_SELECTED_DATE_KEY = 'shared_selected_date';
const DESKTOP_LANGUAGE_KEY = 'desktop_profile_language';
const DESKTOP_APPEARANCE_KEY = 'desktop_profile_appearance';
const LANGUAGE_LOCALES = {
  EN: 'en-US',
  ZH: 'zh-CN',
  MS: 'ms-MY',
  JA: 'ja-JP',
  TH: 'th-TH',
};
const MOBILE_BLOCK_STYLES = Object.fromEntries(timeBlocks.map((block) => [block.id, block]));
const sections = [
  {
    id: 'morning',
    mobileId: 'Morning',
    labelKey: 'morning',
    start: '06:00',
    end: '12:00',
    pillBg: '#f7d8a5',
    pillColor: '#6b3f06',
    darkPillBg: MOBILE_BLOCK_STYLES.Morning.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Morning.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Morning.strokeColor,
  },
  {
    id: 'afternoon',
    mobileId: 'Afternoon',
    labelKey: 'afternoon',
    start: '12:00',
    end: '18:00',
    pillBg: '#bfe3fb',
    pillColor: '#0d4c82',
    darkPillBg: MOBILE_BLOCK_STYLES.Afternoon.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Afternoon.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Afternoon.strokeColor,
  },
  {
    id: 'evening',
    mobileId: 'Evening',
    labelKey: 'evening',
    start: '18:00',
    end: '22:00',
    pillBg: '#eadffd',
    pillColor: '#5f2d90',
    darkPillBg: MOBILE_BLOCK_STYLES.Evening.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Evening.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Evening.strokeColor,
  },
  {
    id: 'night',
    mobileId: 'Night',
    labelKey: 'night',
    start: '22:00',
    end: '06:00',
    pillBg: '#dfe6ef',
    pillColor: '#213243',
    darkPillBg: MOBILE_BLOCK_STYLES.Night.color,
    darkPillColor: MOBILE_BLOCK_STYLES.Night.textColor,
    darkPillBorder: MOBILE_BLOCK_STYLES.Night.strokeColor,
  },
];
const chips = [
  { id: 'now', labelKey: 'now' },
  { id: 'morning', labelKey: 'morning' },
  { id: 'afternoon', labelKey: 'afternoon' },
  { id: 'evening', labelKey: 'evening' },
  { id: 'night', labelKey: 'night' },
];
const DESKTOP_DRAG_START_DISTANCE = 4;
const DESKTOP_DRAG_SCROLL_ZONE = 96;
const DESKTOP_DRAG_MAX_SCROLL_SPEED = 1.35;
const DESKTOP_DRAG_DAY_EDGE_HOLD_MS = 420;
const DESKTOP_DRAG_DAY_FLIP_COOLDOWN_MS = 700;
const DESKTOP_MAIN_CONTENT_MAX_WIDTH = 1008;
const DESKTOP_MAIN_CONTENT_HORIZONTAL_PADDING = 72;
const DESKTOP_DRAG_EDGE_OVERFLOW_TOP = 20;
const DESKTOP_DRAG_EDGE_OVERFLOW_BOTTOM = 64;
const DESKTOP_DRAG_EDGE_RESISTANCE = 0.22;
const DESKTOP_DRAG_MAX_EDGE_OVERFLOW = 96;
const DESKTOP_BASE_SLOT_COUNT = 4;
const DESKTOP_TIME_AXIS_LINE_TOP = 26;
const DESKTOP_TIME_AXIS_LINE_BOTTOM = 36;
const DESKTOP_TIME_MARKER_SIZE = 7;
const DESKTOP_SLOT_MIN_HEIGHT = 98;
const DESKTOP_SLOT_GAP = 22;
const getDesktopSectionPillStyle = (section, appearance) => (
  appearance === 'dark'
    ? {
      background: section.darkPillBg,
      color: section.darkPillColor,
      border: `1px solid ${section.darkPillBorder}`,
      WebkitTextStroke: `0.2px ${section.darkPillBorder}`,
    }
    : {
      background: section.pillBg,
      color: section.pillColor,
      border: 'none',
      WebkitTextStroke: '0',
    }
);

const isValidDesktopSlot = (value) => Number.isInteger(value) && value >= 0;
const getDesktopSlotCapacity = (tasks) => {
  const preferredSlotCount = tasks.reduce((max, task) => (
    isValidDesktopSlot(task.desktopSlot) ? Math.max(max, task.desktopSlot + 1) : max
  ), 0);
  const itemCount = Math.max(tasks.length, preferredSlotCount);
  return Math.max(
    DESKTOP_BASE_SLOT_COUNT,
    itemCount <= DESKTOP_BASE_SLOT_COUNT ? DESKTOP_BASE_SLOT_COUNT : Math.ceil(itemCount / 2) * 2,
  );
};
const resolveDesktopSectionSlots = (tasks) => {
  const slots = Array.from({ length: getDesktopSlotCapacity(tasks) }, () => null);
  const orderedTasks = tasks
    .map((task, index) => ({
      task,
      index,
      preferredSlot: isValidDesktopSlot(task.desktopSlot) ? task.desktopSlot : null,
    }))
    .sort((a, b) => {
      const aHasSlot = a.preferredSlot !== null;
      const bHasSlot = b.preferredSlot !== null;
      if (aHasSlot && bHasSlot) {
        return a.preferredSlot - b.preferredSlot || a.index - b.index;
      }
      if (aHasSlot) return -1;
      if (bHasSlot) return 1;
      return a.index - b.index;
    });

  orderedTasks.forEach(({ task, preferredSlot }) => {
    let slot = preferredSlot;
    if (slot === null || slots[slot]) {
      slot = slots.findIndex((entry) => entry === null);
    }
    slots[slot] = normalizeTask({ ...task, desktopSlot: slot });
  });

  return { slots };
};
const getFirstAvailableDesktopSlot = (tasks, dateString, timeOfDay) => {
  const { slots } = resolveDesktopSectionSlots(
    tasks.filter((task) => task.dateString === dateString && task.timeOfDay === timeOfDay),
  );
  const index = slots.findIndex((task) => task === null);
  return index === -1 ? null : index;
};
const getDesktopSectionTaskOrder = (tasks, dateString, timeOfDay) => {
  const sectionTasks = tasks.filter((task) => task.dateString === dateString && task.timeOfDay === timeOfDay);
  const { slots } = resolveDesktopSectionSlots(sectionTasks);
  return slots.filter(Boolean);
};
const reflowDesktopSectionSlots = (tasks, dateString, timeOfDay, orderedIds = null) => {
  const currentOrderedTasks = getDesktopSectionTaskOrder(tasks, dateString, timeOfDay);
  const orderedTasks = orderedIds
    ? [
      ...orderedIds
        .map((id) => currentOrderedTasks.find((task) => task.id === id))
        .filter(Boolean),
      ...currentOrderedTasks.filter((task) => !orderedIds.includes(task.id)),
    ]
    : currentOrderedTasks;

  orderedTasks.forEach((task, index) => {
    const targetTask = tasks.find((item) => item.id === task.id);
    if (!targetTask) return;
    targetTask.desktopSlot = index;
  });
};
const buildDesktopRenderSections = ({ tasks, selectedDateKey, draggedTaskId, dragOverSection, dragOverSlot }) => {
  const selectedTasks = tasks.filter((task) => task.dateString === selectedDateKey);
  const baseSections = Object.fromEntries(
    sections.map((section) => {
      const { slots } = resolveDesktopSectionSlots(
        selectedTasks.filter((task) => task.timeOfDay === section.mobileId),
      );
      return [section.mobileId, {
        renderSlots: slots.map((task) => (task ? { type: 'task', task } : { type: 'empty' })),
      }];
    }),
  );

  if (!draggedTaskId) return baseSections;

  const draggedTask = tasks.find((task) => task.id === draggedTaskId);
  if (!draggedTask) return baseSections;

  let previewTasks = tasks;
  if (dragOverSection && isValidDesktopSlot(dragOverSlot)) {
    previewTasks = applyDesktopTaskDrop({
      tasks,
      draggedTaskId,
      sourceDateString: draggedTask.dateString,
      sourceSection: draggedTask.timeOfDay,
      sourceSlot: draggedTask.desktopSlot,
      targetDateString: selectedDateKey,
      targetSection: dragOverSection,
      targetSlot: dragOverSlot,
    });
  }

  const previewDraggedTask = previewTasks.find((task) => task.id === draggedTaskId) || draggedTask;
  const previewSections = Object.fromEntries(
    sections.map((section) => {
      const { slots } = resolveDesktopSectionSlots(
        previewTasks.filter((task) => task.dateString === selectedDateKey && task.timeOfDay === section.mobileId),
      );
      const renderSlots = slots.map((task, slotIndex) => {
        if (
          previewDraggedTask.dateString === selectedDateKey
          &&
          previewDraggedTask.timeOfDay === section.mobileId
          && previewDraggedTask.desktopSlot === slotIndex
        ) {
          return { type: 'placeholder' };
        }
        if (task && task.id === draggedTaskId) {
          return { type: 'empty' };
        }
        return task ? { type: 'task', task } : { type: 'empty' };
      });

      return [section.mobileId, { renderSlots }];
    }),
  );

  return previewSections;
};
const applyDesktopTaskDrop = ({
  tasks,
  draggedTaskId,
  sourceDateString,
  sourceSection,
  sourceSlot,
  targetDateString,
  targetSection,
  targetSlot,
}) => {
  if (!targetSection || !isValidDesktopSlot(targetSlot)) return tasks;

  const nextTasks = tasks.map((task) => ({ ...task }));
  const draggedTask = nextTasks.find((task) => task.id === draggedTaskId);
  if (!draggedTask) return tasks;
  const resolvedSourceDateString = sourceDateString || draggedTask.dateString;
  const resolvedTargetDateString = targetDateString || resolvedSourceDateString;
  const targetOrder = getDesktopSectionTaskOrder(
    nextTasks.filter((task) => task.id !== draggedTaskId),
    resolvedTargetDateString,
    targetSection,
  ).map((task) => task.id);
  const insertIndex = Math.max(0, Math.min(targetSlot, targetOrder.length));
  targetOrder.splice(insertIndex, 0, draggedTaskId);

  draggedTask.dateString = resolvedTargetDateString;
  draggedTask.timeOfDay = targetSection;
  draggedTask.desktopSlot = null;

  if (resolvedSourceDateString !== resolvedTargetDateString || sourceSection !== targetSection) {
    reflowDesktopSectionSlots(nextTasks, resolvedSourceDateString, sourceSection);
  }
  reflowDesktopSectionSlots(nextTasks, resolvedTargetDateString, targetSection, targetOrder);
  return nextTasks.map(normalizeTask);
};

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const shiftDateByDays = (date, dayOffset) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
};
const getDesktopDayFlipZones = (viewportRect) => {
  const wideScreenThreshold = DESKTOP_MAIN_CONTENT_MAX_WIDTH + DESKTOP_MAIN_CONTENT_HORIZONTAL_PADDING;

  if (viewportRect.width > wideScreenThreshold) {
    const contentLeft = viewportRect.left + ((viewportRect.width - DESKTOP_MAIN_CONTENT_MAX_WIDTH) / 2);
    const contentRight = contentLeft + DESKTOP_MAIN_CONTENT_MAX_WIDTH;
    return {
      mode: 'gutter',
      previousStart: viewportRect.left,
      previousEnd: contentLeft,
      nextStart: contentRight,
      nextEnd: viewportRect.right,
    };
  }

  const edgeZone = Math.min(120, Math.max(68, viewportRect.width * 0.12));
  return {
    mode: 'edge',
    previousStart: viewportRect.left,
    previousEnd: viewportRect.left + edgeZone,
    nextStart: viewportRect.right - edgeZone,
    nextEnd: viewportRect.right,
  };
};
const getLocaleForLanguage = (language) => LANGUAGE_LOCALES[language] || LANGUAGE_LOCALES.EN;
const getTranslationsForLanguage = (language) => translations[language] || translations.EN;
const formatTemplate = (template, values) => Object.entries(values).reduce(
  (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
  template,
);
const parseSharedSelectedDate = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const sectionIdToMobileId = (sectionId) => {
  const matched = sections.find((section) => section.id === sectionId);
  return matched?.mobileId || 'Morning';
};
const mobileIdToSectionId = (mobileId) => {
  const matched = sections.find((section) => section.mobileId === mobileId);
  return matched?.id || 'morning';
};
const normalizeTask = (task) => {
  const derivedFields = getDerivedTaskFields(task.text || '');

  return {
    ...derivedFields,
    ...task,
    text: task.text || '',
    completed: task.completed ?? false,
    dateString: task.dateString || dateKey(getLogicalToday()),
    timeOfDay: task.timeOfDay || sectionIdToMobileId(task.section),
    cardType: normalizeCardType(task.cardType || derivedFields.cardType),
    desktopSlot: isValidDesktopSlot(task.desktopSlot) ? task.desktopSlot : null,
  };
};
const currentSection = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
};
const getSectionBounds = (section, logicalDate) => {
  const baseDate = new Date(logicalDate);
  baseDate.setHours(0, 0, 0, 0);

  const [startHour, startMinute] = section.start.split(':').map(Number);
  const [endHour, endMinute] = section.end.split(':').map(Number);

  const sectionStart = new Date(baseDate);
  sectionStart.setHours(startHour, startMinute, 0, 0);
  if (startHour < DAY_BOUNDARY_HOUR) {
    sectionStart.setDate(sectionStart.getDate() + 1);
  }

  const sectionEnd = new Date(baseDate);
  sectionEnd.setHours(endHour, endMinute, 0, 0);
  if (sectionEnd <= sectionStart) {
    sectionEnd.setDate(sectionEnd.getDate() + 1);
  }

  return { sectionStart, sectionEnd };
};
const getSectionMarkerStyle = (section, currentTime, selectedDate) => {
  const logicalToday = getLogicalToday(currentTime);
  const logicalSelectedDate = new Date(selectedDate);
  logicalSelectedDate.setHours(0, 0, 0, 0);

  if (!sameDay(logicalSelectedDate, logicalToday)) return null;

  const { sectionStart, sectionEnd } = getSectionBounds(section, logicalSelectedDate);

  if (currentTime < sectionStart || currentTime >= sectionEnd) return null;

  const progress = Math.max(
    0,
    Math.min(1, (currentTime.getTime() - sectionStart.getTime()) / (sectionEnd.getTime() - sectionStart.getTime())),
  );

  return {
    top: `calc(${DESKTOP_TIME_AXIS_LINE_TOP}px + ((100% - ${DESKTOP_TIME_AXIS_LINE_TOP}px - ${DESKTOP_TIME_AXIS_LINE_BOTTOM}px) * ${progress}) - ${(DESKTOP_TIME_MARKER_SIZE / 2)}px)`,
  };
};
const getCalendarWeekdayLabels = (language) => {
  const locale = getLocaleForLanguage(language);
  const baseSunday = new Date(Date.UTC(2024, 0, 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(baseSunday);
    date.setUTCDate(baseSunday.getUTCDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(date);
  });
};
const panelLabel = (date, language) => {
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

const GlobalStyles = ({ appearance }) => {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    const style = document.createElement('style');
    const shellBackground = appearance === 'dark' ? '#121212' : '#f8f5f1';
    style.textContent = `
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; min-height: 100%; background: ${shellBackground}; }
      body { overflow: hidden; }
      button, input { font: inherit; }
      ::selection { background-color: #ef4444; color: white; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, [appearance]);
  return null;
};

const PlusIcon = ({ size = 26 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.9" stroke="currentColor" style={{ width: size, height: size }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 18, height: 18 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);
const ArrowUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.2" stroke="currentColor" style={{ width: 18, height: 18 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
  </svg>
);
const ClockOutline = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 4.5V9H12.375M15.75 9C15.75 9.88642 15.5754 10.7642 15.2362 11.5831C14.897 12.4021 14.3998 13.1462 13.773 13.773C13.1462 14.3998 12.4021 14.897 11.5831 15.2362C10.7642 15.5754 9.88642 15.75 9 15.75C8.11358 15.75 7.23583 15.5754 6.41689 15.2362C5.59794 14.897 4.85382 14.3998 4.22703 13.773C3.60023 13.1462 3.10303 12.4021 2.76381 11.5831C2.42459 10.7642 2.25 9.88642 2.25 9C2.25 7.20979 2.96116 5.4929 4.22703 4.22703C5.4929 2.96116 7.20979 2.25 9 2.25C10.7902 2.25 12.5071 2.96116 13.773 4.22703C15.0388 5.4929 15.75 7.20979 15.75 9Z" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {[...hh].map((digit, i) => <span key={`h${i}`} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--desktop-clock-border)', background: 'var(--desktop-clock-bg)', color: 'var(--desktop-clock-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{digit}</span>)}
      <span style={{ color: 'var(--desktop-muted)' }}>:</span>
      {[...mm].map((digit, i) => <span key={`m${i}`} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--desktop-clock-border)', background: 'var(--desktop-clock-bg)', color: 'var(--desktop-clock-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{digit}</span>)}
    </div>
  );
};

const ReturnTodayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 14, height: 14 }}>
    <path d="M6.25 6.25H2.5V2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.917 6.25C3.921 3.785 6.341 2.083 9.167 2.083C12.892 2.083 15.917 5.108 15.917 8.833C15.917 12.559 12.892 15.583 9.167 15.583C6.422 15.583 4.06 13.944 3.011 11.592" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style={{ width: 14, height: 14 }}>
    <path d="M12 20H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.5 3.5C17.3284 2.67157 18.6716 2.67157 19.5 3.5C20.3284 4.32843 20.3284 5.67157 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WeekStrip = ({ selectedDate, logicalToday, language, onSelect }) => {
  const t = getTranslationsForLanguage(language);
  const logicalMidnight = new Date(logicalToday);
  logicalMidnight.setHours(0, 0, 0, 0);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selectedDate);
    date.setDate(selectedDate.getDate() - 3 + index);
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    return {
      key: date.toISOString(),
      label: t.dayNames[date.getDay()] || date.toLocaleDateString(getLocaleForLanguage(language), { weekday: 'short' }).toUpperCase(),
      num: date.getDate(),
      active: sameDay(date, selectedDate),
      isToday: sameDay(date, logicalToday),
      isPast: normalizedDate < logicalMidnight,
      isFuture: normalizedDate > logicalMidnight,
      date,
    };
  });
  return (
    <div style={{ borderTop: '1px solid var(--desktop-week-top-divider)', borderBottom: '1px solid var(--desktop-week-bottom-divider)', background: 'var(--desktop-week-strip-bg)' }}>
      <div style={{ width: 'min(1008px, calc(100% - 72px))', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 12, padding: '8px 0' }}>
        {week.map((day) => (
          <button key={day.key} type="button" onClick={() => onSelect(day.date)} style={{ border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', height: 48, padding: '8px 0', position: 'relative' }}>
            <span style={{ fontSize: 14, fontWeight: day.active || day.isFuture ? 700 : 500, letterSpacing: '0.06em', color: day.active || day.isFuture ? 'var(--desktop-root-text)' : day.isPast ? 'var(--desktop-muted-subtle)' : 'var(--desktop-muted-strong)' }}>{day.label}</span>
            <span style={{ width: 22, minWidth: 22, maxWidth: 22, height: 22, minHeight: 22, maxHeight: 22, aspectRatio: '1 / 1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: day.active ? 'var(--desktop-active-date-bg)' : 'transparent', color: day.active ? '#fff' : day.isFuture ? 'var(--desktop-root-text)' : day.isPast ? 'var(--desktop-muted-subtle)' : 'var(--desktop-muted-strong)', fontSize: 14, lineHeight: 1, fontWeight: day.active || day.isFuture ? 700 : 500 }}>{day.num}</span>
            {!day.active && day.isToday ? <span style={{ position: 'absolute', left: '50%', bottom: -2, width: 4, height: 4, borderRadius: '50%', background: 'var(--desktop-accent)', transform: 'translateX(-50%)' }} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
};

const TaskCardContent = ({ task, appearance, labels }) => {
  const { cfg, displayTitle, displaySub } = getTaskCardPresentation(task, labels);
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';

  return (
    <>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBackground, border: iconBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img src={cfg.icon} alt={normalizeCardType(task.cardType)} style={{ width: 18, height: 18, objectFit: 'contain' }} />
      </div>
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', wordBreak: 'break-word', color: 'var(--desktop-card-title)', fontSize: 13, fontWeight: 590, lineHeight: '20px' }}>
          {displayTitle}
        </div>
        <div style={{ color: 'var(--desktop-card-desc)', fontSize: 11, fontWeight: 400, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displaySub}
        </div>
      </div>
    </>
  );
};

const TaskCard = (props) => {
  const {
    task,
    appearance,
    onClick,
    onEdit,
    onDelete,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    isDragging,
    editLabel,
    deleteLabel,
  } = props;
  const taskCardLabels = props?.labels;

  return (
    <div id={`desktop-task-wrapper-${task.id}`} className={`desktop-task-wrapper ${isDragging ? 'is-dragging' : ''}`}>
      <button
        id={`desktop-task-card-${task.id}`}
        type="button"
        className={`desktop-task-card ${isDragging ? 'is-dragging' : ''}`}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{
          width: '100%',
          minHeight: 76,
          borderRadius: 11,
          border: '2px solid var(--desktop-task-border)',
          background: 'var(--desktop-task-bg)',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'var(--desktop-task-shadow)',
          cursor: isDragging ? 'grabbing' : 'pointer',
          textAlign: 'left',
          opacity: 1,
          transition: 'none',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <TaskCardContent task={task} appearance={appearance} labels={taskCardLabels} />
      </button>
      <div className="desktop-task-actions">
        <button
          type="button"
          className="desktop-task-action-button desktop-task-edit-button"
          aria-label={editLabel}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.(task);
          }}
        >
          <PenLine size={14} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="desktop-task-action-button desktop-task-delete-button"
          aria-label={deleteLabel}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(task);
          }}
        >
          <Trash2 size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
};

const DragOverlayCard = (props) => {
  const { task, rect, appearance } = props;
  const taskCardLabels = props?.labels;

  if (!task || !rect) return null;

  return (
    <div
      id="desktop-task-drag-overlay"
      className="desktop-task-drag-overlay"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    >
      <div className="desktop-task-drag-overlay-card" style={{ opacity: 1 }}>
        <TaskCardContent task={task} appearance={appearance} labels={taskCardLabels} />
      </div>
    </div>
  );
};

const DragDayFeedbackOverlay = ({
  direction,
  previousLabel,
  nextLabel,
  zones,
}) => (
  <div className={`desktop-drag-day-feedback ${direction ? 'is-visible' : ''}`} aria-hidden="true">
    <div
      className={`desktop-drag-day-feedback-edge desktop-drag-day-feedback-edge-previous ${direction === 'previous' ? 'is-active' : ''}`}
      style={zones ? { width: Math.max(0, zones.previousEnd - zones.previousStart) } : undefined}
    >
      <div className="desktop-drag-day-feedback-chip">
        <span className="desktop-drag-day-feedback-arrow desktop-drag-day-feedback-arrow-previous">{'<'}</span>
        <span className="desktop-drag-day-feedback-label">{previousLabel}</span>
      </div>
    </div>
    <div
      className={`desktop-drag-day-feedback-edge desktop-drag-day-feedback-edge-next ${direction === 'next' ? 'is-active' : ''}`}
      style={zones ? { width: Math.max(0, zones.nextEnd - zones.nextStart) } : undefined}
    >
      <div className="desktop-drag-day-feedback-chip">
        <span className="desktop-drag-day-feedback-label">{nextLabel}</span>
        <span className="desktop-drag-day-feedback-arrow desktop-drag-day-feedback-arrow-next">{'>'}</span>
      </div>
    </div>
  </div>
);

const ScheduleSection = ({
  section,
  appearance,
  language,
  labels,
  renderSlots,
  markerStyle,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onTaskPointerDown,
  onTaskPointerMove,
  onTaskPointerUp,
  onTaskPointerCancel,
  draggedTaskId,
  isDragOver,
}) => {
  const pillStyle = getDesktopSectionPillStyle(section, appearance);
  const t = getTranslationsForLanguage(language);
  const desktopRowCount = Math.max(2, Math.ceil(renderSlots.length / 2));
  const timelineColumnMinHeight = (desktopRowCount * DESKTOP_SLOT_MIN_HEIGHT) + ((desktopRowCount - 1) * DESKTOP_SLOT_GAP);

  return (
    <section style={{ borderBottom: '1px solid var(--desktop-divider)', background: 'var(--desktop-section-bg)' }}>
      <div style={{ width: 'min(1008px, calc(100% - 72px))', margin: '0 auto', padding: '22px 0 24px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 72, padding: '6px 14px', borderRadius: 999, fontFamily: 'DM Serif Display, serif', fontSize: 14, fontStyle: 'italic', ...pillStyle }}>{t[section.labelKey]}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 24, marginTop: 18, alignItems: 'stretch' }}>
          <div style={{ position: 'relative', minHeight: timelineColumnMinHeight, height: '100%' }}>
            <div style={{ color: 'var(--desktop-root-text)', fontSize: 15, fontWeight: 500 }}>{section.start}</div>
            <div style={{ position: 'absolute', left: 5, top: DESKTOP_TIME_AXIS_LINE_TOP, bottom: DESKTOP_TIME_AXIS_LINE_BOTTOM, width: 1, background: 'var(--desktop-time-axis-line)' }} />
            {markerStyle ? <div style={{ position: 'absolute', left: 2, width: DESKTOP_TIME_MARKER_SIZE, height: DESKTOP_TIME_MARKER_SIZE, borderRadius: '50%', background: 'var(--desktop-accent)', ...markerStyle }} /> : null}
            <div style={{ position: 'absolute', left: 0, bottom: 0, color: 'var(--desktop-root-text)', fontSize: 15, fontWeight: 500 }}>{section.end}</div>
          </div>
          <div
            data-desktop-block-id={section.mobileId}
            className={`desktop-schedule-task-grid ${isDragOver ? 'is-drag-over' : ''}`}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: DESKTOP_SLOT_GAP, alignItems: 'stretch' }}
          >
            {renderSlots.map((item, slotIndex) => (
              <div
                key={`${section.mobileId}-${slotIndex}`}
                data-desktop-slot-id={`${section.mobileId}-${slotIndex}`}
                data-desktop-slot-section={section.mobileId}
                data-desktop-slot-index={slotIndex}
                className="desktop-schedule-slot"
              >
                {item.type === 'task' ? (
                  <div data-desktop-layout-id={`task-${item.task.id}`}>
                    <TaskCard
                      task={item.task}
                      appearance={appearance}
                      labels={labels}
                      isDragging={draggedTaskId === item.task.id}
                      onClick={() => onTaskClick(item.task)}
                      onEdit={() => onTaskEdit(item.task)}
                      onDelete={() => onTaskDelete(item.task)}
                      onPointerDown={(event) => onTaskPointerDown(item.task, event)}
                      onPointerMove={(event) => onTaskPointerMove(item.task, event)}
                      onPointerUp={(event) => onTaskPointerUp(item.task, event)}
                      onPointerCancel={(event) => onTaskPointerCancel(item.task, event)}
                      editLabel={labels.edit}
                      deleteLabel={labels.delete}
                    />
                  </div>
                ) : item.type === 'placeholder' ? (
                  <div data-desktop-layout-id="desktop-drag-placeholder" className="desktop-drag-placeholder" aria-hidden="true" />
                ) : (
                  <div className="desktop-empty-slot" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const AddPanel = ({ open, language, selectedDate, chipsToShow, activeChip, setActiveChip, inputText, setInputText, onClose, onSubmit, onSelectDate }) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const t = getTranslationsForLanguage(language);
  const locale = getLocaleForLanguage(language);

  if (!open) return null;

  const rows = chipsToShow.length <= 3 ? [chipsToShow] : [chipsToShow.slice(0, 3), chipsToShow.slice(3)];
  const logicalToday = getLogicalToday();
  const maxDate = new Date(logicalToday);
  maxDate.setDate(maxDate.getDate() + 30);
  const calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + calendarOffset, 1);
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthLabel = monthStart.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const startOffset = monthStart.getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const trailingCells = Math.max(0, 42 - startOffset - daysInMonth);
  const isAtMinMonth = monthStart.getFullYear() === logicalToday.getFullYear() && monthStart.getMonth() === logicalToday.getMonth();
  const isAtMaxMonth = monthStart.getFullYear() === maxDate.getFullYear() && monthStart.getMonth() === maxDate.getMonth();
  const desktopCalendarCellSize = 32;
  const desktopCalendarGap = 6;
  const calendarWeekdayLabels = getCalendarWeekdayLabels(language);
  return (
    <aside style={{ width: 348, borderLeft: '1px solid var(--desktop-divider)', background: 'var(--desktop-section-bg)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} aria-label={t.close} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--desktop-panel-close-bg)', color: 'var(--desktop-panel-close-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CloseIcon /></button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 28px 22px' }}>
        <div style={{ width: 42, height: 38, marginBottom: 26 }}>
          <svg width="42" height="38" viewBox="0 0 42 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <ellipse cx="21" cy="27.125" rx="21" ry="10.5" fill="url(#p0)" />
            <ellipse cx="27.125" cy="19.25" rx="13.125" ry="7" fill="url(#p1)" />
            <ellipse cx="21.875" cy="8.3125" rx="14.875" ry="8.3125" fill="url(#p2)" />
            <defs>
              <linearGradient id="p0" x1="21" y1="16.625" x2="21" y2="44.625" gradientUnits="userSpaceOnUse"><stop stopColor="#625F57" /><stop offset="1" stopColor="#C8C1B2" /></linearGradient>
              <linearGradient id="p1" x1="27.125" y1="12.25" x2="27.125" y2="38.0625" gradientUnits="userSpaceOnUse"><stop stopColor="#707070" /><stop offset="1" /></linearGradient>
              <linearGradient id="p2" x1="21.875" y1="0" x2="21.875" y2="24.9375" gradientUnits="userSpaceOnUse"><stop offset="0.182692" stopColor="#E6D2A8" /><stop offset="1" stopColor="#80755D" /></linearGradient>
            </defs>
          </svg>
        </div>
        <button type="button" onClick={() => {
          if (!isCalendarOpen) setCalendarOffset(0);
          setIsCalendarOpen((prev) => !prev);
        }} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isCalendarOpen ? 18 : 30, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--desktop-root-text)' }}>
          <h2 style={{ margin: 0, fontFamily: 'DM Serif Display, serif', fontSize: 38, fontStyle: 'italic', lineHeight: 1 }}>{panelLabel(selectedDate, language)}</h2>
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="13" viewBox="0 0 9 14" fill="none" style={{ transform: isCalendarOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)' }}><path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="black" /></svg>
        </button>
        {isCalendarOpen ? (
          <div style={{ width: 'fit-content', maxWidth: '100%', marginBottom: 20, padding: '14px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button type="button" disabled={isAtMinMonth} onClick={() => setCalendarOffset((prev) => prev - 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--desktop-panel-close-bg)', color: isAtMinMonth ? 'var(--desktop-muted-subtle)' : 'var(--desktop-root-text)', cursor: isAtMinMonth ? 'default' : 'pointer' }}>
                {'<'}
              </button>
              <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20, fontStyle: 'italic' }}>{monthLabel}</span>
              <button type="button" disabled={isAtMaxMonth} onClick={() => setCalendarOffset((prev) => prev + 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--desktop-panel-close-bg)', color: isAtMaxMonth ? 'var(--desktop-muted-subtle)' : 'var(--desktop-root-text)', cursor: isAtMaxMonth ? 'default' : 'pointer' }}>
                {'>'}
              </button>
            </div>
            <div style={{ display: 'grid', width: 'fit-content', maxWidth: '100%', gridTemplateColumns: `repeat(7, ${desktopCalendarCellSize}px)`, gap: desktopCalendarGap }}>
              {calendarWeekdayLabels.map((label, index) => (
                <div key={`${label}-${index}`} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--desktop-muted-subtle)' }}>{label}</div>
              ))}
              {Array.from({ length: startOffset }).map((_, index) => <div key={`empty-${index}`} />)}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const cellDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const inRange = cellDate >= logicalToday && cellDate <= maxDate;
                const selected = sameDay(cellDate, selectedDate);
                const today = sameDay(cellDate, logicalToday);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={!inRange}
                    onClick={() => {
                      if (!inRange) return;
                      onSelectDate(cellDate);
                      setIsCalendarOpen(false);
                    }}
                    style={{
                      width: desktopCalendarCellSize,
                      aspectRatio: '1 / 1',
                      borderRadius: '50%',
                      border: today && !selected ? '1px solid var(--desktop-accent)' : 'none',
                      background: selected ? 'var(--desktop-active-date-bg)' : 'transparent',
                      color: selected ? '#fff' : today ? 'var(--desktop-accent)' : inRange ? 'var(--desktop-root-text)' : 'var(--desktop-disabled-text)',
                      fontSize: 15,
                      fontWeight: selected || today ? 700 : 500,
                      cursor: inRange ? 'pointer' : 'default',
                    }}
                  >
                    {day}
                  </button>
                );
              })}
              {Array.from({ length: trailingCells }).map((_, index) => <div key={`trail-${index}`} />)}
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', color: 'var(--desktop-root-text)' }}><ClockOutline />{t.timeOfDay}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {row.map((chip) => <button key={chip.id} type="button" onClick={() => setActiveChip(chip.id)} style={{ minWidth: 62, height: 30, padding: '0 14px', borderRadius: 999, border: '1px solid transparent', background: activeChip === chip.id ? 'var(--desktop-chip-active-bg)' : 'var(--desktop-chip-bg)', color: activeChip === chip.id ? 'var(--desktop-chip-active-text)' : 'var(--desktop-chip-text)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>{t[chip.labelKey]}</button>)}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <input type="text" autoFocus value={inputText} onChange={(event) => setInputText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onSubmit(); } }} placeholder={t.placeholder} style={{ width: '100%', minHeight: 58, height: 58, borderRadius: 22, border: '1px solid var(--desktop-input-border)', background: 'var(--desktop-input-bg)', color: 'var(--desktop-root-text)', padding: '0 58px 0 16px', outline: 'none', fontSize: 15, boxShadow: 'var(--desktop-input-shadow)' }} />
          <button type="button" onClick={onSubmit} style={{ position: 'absolute', right: 8, bottom: 9, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--desktop-submit-bg)', color: 'var(--desktop-submit-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--desktop-submit-shadow)' }}><ArrowUpIcon /></button>
        </div>
      </div>
    </aside>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Track retention on Desktop app wide open
  useEffect(() => {
    if (user?.id) {
      trackUserEvent(user.id, 'app_opened', { platform: 'desktop' });
    }
  }, [user?.id]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const savedDate = parseSharedSelectedDate(localStorage.getItem(SHARED_SELECTED_DATE_KEY));
    return savedDate || getLogicalToday();
  });
  const [language, setLanguage] = useState(() => localStorage.getItem(DESKTOP_LANGUAGE_KEY) || 'EN');
  const [appearance, setAppearance] = useState(() => localStorage.getItem(DESKTOP_APPEARANCE_KEY) || 'light');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profileOpen, setProfileOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeChip, setActiveChip] = useState('now');
  const [inputText, setInputText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverSection, setDragOverSection] = useState(null);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [desktopDragDayFeedback, setDesktopDragDayFeedback] = useState(null);
  const [desktopDragDayZones, setDesktopDragDayZones] = useState(null);
  const [tasks, setTasks] = useSyncedTodos({
    userId: user?.id || null,
    normalizeTodo: normalizeTask,
  });
  const t = useMemo(() => getTranslationsForLanguage(language), [language]);
  const userProfile = useMemo(() => getUserProfile(user), [user]);
  const selectedDateRef = useRef(selectedDate);
  const tasksRef = useRef(tasks);
  const mainScrollRef = useRef(null);
  const desktopDragViewportRef = useRef(null);
  const desktopDragStateRef = useRef({
    pointerId: null,
    taskId: null,
    startX: 0,
    startY: 0,
  });
  const activePointerTaskRef = useRef(null);
  const desktopDragPointerRef = useRef({ x: 0, y: 0 });
  const desktopDragOriginRectRef = useRef(null);
  const desktopDragPointerOffsetRef = useRef({ x: 0, y: 0 });
  const desktopDragOverlayRectRef = useRef(null);
  const desktopDragModeRef = useRef(false);
  const dragOverSectionRef = useRef(null);
  const dragOverSlotRef = useRef(null);
  const lockedMainScrollTopRef = useRef(0);
  const desktopAutoScrollFrameRef = useRef(null);
  const desktopAutoScrollLastTsRef = useRef(null);
  const desktopDayFlipTimerRef = useRef(null);
  const desktopDayFlipDirectionRef = useRef(0);
  const desktopDayFlipCooldownUntilRef = useRef(0);
  const desktopDragDayFeedbackRef = useRef(null);
  const desktopDragDayZonesRef = useRef(null);
  const suppressTaskClickRef = useRef(null);
  const suppressAllTaskClicksUntilRef = useRef(0);
  const suppressTaskClickTimeoutRef = useRef(null);
  const desktopLayoutRectsRef = useRef(new Map());

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => () => {
    if (suppressTaskClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressTaskClickTimeoutRef.current);
      suppressTaskClickTimeoutRef.current = null;
    }
    if (desktopAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(desktopAutoScrollFrameRef.current);
      desktopAutoScrollFrameRef.current = null;
    }
    if (desktopDayFlipTimerRef.current !== null) {
      window.clearTimeout(desktopDayFlipTimerRef.current);
      desktopDayFlipTimerRef.current = null;
    }
  }, []);
  useEffect(() => {
    localStorage.setItem(SHARED_SELECTED_DATE_KEY, dateKey(selectedDate));
  }, [selectedDate]);
  useEffect(() => {
    localStorage.setItem(DESKTOP_LANGUAGE_KEY, language);
  }, [language]);
  useEffect(() => {
    localStorage.setItem(DESKTOP_APPEARANCE_KEY, appearance);
  }, [appearance]);
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);
    if (!supabase) {
      setLoading(false);
      clearTimeout(timeout);
      return undefined;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      clearTimeout(timeout);
    }).catch(() => {
      setLoading(false);
      clearTimeout(timeout);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const logicalToday = getLogicalToday();
  const todaySelected = sameDay(selectedDate, logicalToday);
  const currentBlock = currentSection(currentTime);
  const visibleChips = useMemo(() => {
    if (!todaySelected) return chips.filter((chip) => chip.id !== 'now');
    const order = ['morning', 'afternoon', 'evening', 'night'];
    return chips.filter((chip) => chip.id === 'now' || order.indexOf(chip.id) >= order.indexOf(currentBlock));
  }, [currentBlock, todaySelected]);
  useEffect(() => {
    if (!visibleChips.some((chip) => chip.id === activeChip)) setActiveChip(visibleChips[0]?.id || 'now');
  }, [activeChip, visibleChips]);

  const suppressNextTaskClick = useCallback((taskId) => {
    if (suppressTaskClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressTaskClickTimeoutRef.current);
    }
    suppressAllTaskClicksUntilRef.current = Date.now() + 350;
    suppressTaskClickRef.current = taskId;
    suppressTaskClickTimeoutRef.current = window.setTimeout(() => {
      if (suppressTaskClickRef.current === taskId) {
        suppressTaskClickRef.current = null;
      }
      suppressTaskClickTimeoutRef.current = null;
    }, 250);
  }, []);

  const clearDesktopDayFlipTimer = useCallback(() => {
    if (desktopDayFlipTimerRef.current !== null) {
      window.clearTimeout(desktopDayFlipTimerRef.current);
      desktopDayFlipTimerRef.current = null;
    }
    desktopDayFlipDirectionRef.current = 0;
    desktopDragDayFeedbackRef.current = null;
    desktopDragDayZonesRef.current = null;
    setDesktopDragDayFeedback(null);
    setDesktopDragDayZones(null);
  }, []);

  const getNearestDesktopDropTarget = useCallback((clientX, clientY) => {
    const slots = document.querySelectorAll('[data-desktop-slot-id]');
    let nearest = null;
    let nearestScore = Number.POSITIVE_INFINITY;

    slots.forEach((slot) => {
      const rect = slot.getBoundingClientRect();
      const clampedX = Math.max(rect.left, Math.min(clientX, rect.right));
      const clampedY = Math.max(rect.top, Math.min(clientY, rect.bottom));
      const edgeDistance = Math.hypot(clientX - clampedX, clientY - clampedY);
      const centerDistance = Math.hypot(clientX - (rect.left + (rect.width / 2)), clientY - (rect.top + (rect.height / 2)));
      const score = (edgeDistance * 1000) + centerDistance;
      if (score < nearestScore) {
        nearestScore = score;
        nearest = {
          section: slot.getAttribute('data-desktop-slot-section'),
          slot: Number(slot.getAttribute('data-desktop-slot-index')),
        };
      }
    });

    return nearest;
  }, []);

  const syncDesktopDraggedTaskPosition = useCallback((taskId, clientX, clientY) => {
    const overlay = document.getElementById('desktop-task-drag-overlay');
    if (!overlay) return;
    const originRect = desktopDragOriginRectRef.current;
    const pointerOffset = desktopDragPointerOffsetRef.current;
    if (originRect) {
      const left = clientX - pointerOffset.x;
      const top = clientY - pointerOffset.y;
      overlay.style.left = `${left}px`;
      overlay.style.top = `${top}px`;
      desktopDragOverlayRectRef.current = {
        left,
        top,
        width: originRect.width,
        height: originRect.height,
      };
    }

    const nearestTarget = getNearestDesktopDropTarget(clientX, clientY);
    const nextSection = nearestTarget?.section || null;
    const nextSlot = Number.isInteger(nearestTarget?.slot) ? nearestTarget.slot : null;

    if (nextSection !== dragOverSectionRef.current || nextSlot !== dragOverSlotRef.current) {
      dragOverSectionRef.current = nextSection;
      dragOverSlotRef.current = nextSlot;
      setDragOverSection(nextSection);
      setDragOverSlot(nextSlot);
    }
  }, [getNearestDesktopDropTarget]);

  const moveDraggedTaskToDate = useCallback((taskId, nextDate) => {
    if (!taskId || !nextDate) return;

    const currentDate = selectedDateRef.current;
    if (sameDay(currentDate, nextDate)) return;

    const draggedTask = tasksRef.current.find((task) => task.id === taskId);
    const preservedSection = dragOverSectionRef.current || draggedTask?.timeOfDay || 'Morning';
    const nextDateKey = dateKey(nextDate);
    const nextSlot = getDesktopSectionTaskOrder(
      tasksRef.current.filter((task) => task.id !== taskId),
      nextDateKey,
      preservedSection,
    ).length;

    dragOverSectionRef.current = preservedSection;
    dragOverSlotRef.current = nextSlot;
    setDragOverSection(preservedSection);
    setDragOverSlot(nextSlot);
    selectedDateRef.current = nextDate;
    setSelectedDate(nextDate);
  }, []);

  const updateDesktopDragDayAutoFlip = useCallback((clientX, taskId) => {
    const viewport = desktopDragViewportRef.current || mainScrollRef.current;
    if (!viewport || !taskId) return;

    const rect = viewport.getBoundingClientRect();
    const zones = getDesktopDayFlipZones(rect);
    let direction = 0;
    const nextFeedback = clientX <= zones.previousEnd
      ? 'previous'
      : clientX >= zones.nextStart
        ? 'next'
        : null;

    if (clientX <= zones.previousEnd) {
      direction = -1;
    } else if (clientX >= zones.nextStart) {
      direction = 1;
    }

    const currentZones = desktopDragDayZonesRef.current;
    if (
      !currentZones
      || currentZones.previousStart !== zones.previousStart
      || currentZones.previousEnd !== zones.previousEnd
      || currentZones.nextStart !== zones.nextStart
      || currentZones.nextEnd !== zones.nextEnd
    ) {
      desktopDragDayZonesRef.current = zones;
      setDesktopDragDayZones(zones);
    }

    if (desktopDragDayFeedbackRef.current !== nextFeedback) {
      desktopDragDayFeedbackRef.current = nextFeedback;
      setDesktopDragDayFeedback(nextFeedback);
    }

    if (direction === 0) {
      clearDesktopDayFlipTimer();
      return;
    }

    if (Date.now() < desktopDayFlipCooldownUntilRef.current) {
      return;
    }

    if (desktopDayFlipDirectionRef.current === direction && desktopDayFlipTimerRef.current !== null) {
      return;
    }

    clearDesktopDayFlipTimer();
    desktopDayFlipDirectionRef.current = direction;
    desktopDayFlipTimerRef.current = window.setTimeout(() => {
      desktopDayFlipTimerRef.current = null;
      desktopDayFlipDirectionRef.current = 0;

      if (!desktopDragModeRef.current || desktopDragStateRef.current.taskId !== taskId) return;

      desktopDayFlipCooldownUntilRef.current = Date.now() + DESKTOP_DRAG_DAY_FLIP_COOLDOWN_MS;
      moveDraggedTaskToDate(taskId, shiftDateByDays(selectedDateRef.current, direction));
    }, DESKTOP_DRAG_DAY_EDGE_HOLD_MS);
  }, [clearDesktopDayFlipTimer, moveDraggedTaskToDate]);

  const stopDesktopAutoScroll = useCallback(() => {
    desktopAutoScrollLastTsRef.current = null;
    if (desktopAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(desktopAutoScrollFrameRef.current);
      desktopAutoScrollFrameRef.current = null;
    }
  }, []);

  const runDesktopAutoScroll = useCallback((timestamp) => {
    if (!desktopDragModeRef.current || !desktopDragStateRef.current.taskId) {
      stopDesktopAutoScroll();
      return;
    }

    const mainScroll = mainScrollRef.current;
    if (!mainScroll) {
      stopDesktopAutoScroll();
      return;
    }

    if (desktopAutoScrollLastTsRef.current === null) {
      desktopAutoScrollLastTsRef.current = timestamp;
    }

    updateDesktopDragDayAutoFlip(
      desktopDragPointerRef.current.x,
      desktopDragStateRef.current.taskId,
    );

    const elapsed = Math.min(timestamp - desktopAutoScrollLastTsRef.current, 32);
    desktopAutoScrollLastTsRef.current = timestamp;
    const rect = mainScroll.getBoundingClientRect();
    const maxScrollTop = Math.max(0, mainScroll.scrollHeight - mainScroll.clientHeight);
    const clientY = desktopDragPointerRef.current.y;
    let velocity = 0;

    if (clientY < rect.top + DESKTOP_DRAG_SCROLL_ZONE) {
      const intensity = (rect.top + DESKTOP_DRAG_SCROLL_ZONE - clientY) / DESKTOP_DRAG_SCROLL_ZONE;
      velocity = -DESKTOP_DRAG_MAX_SCROLL_SPEED * Math.min(Math.max(intensity, 0), 1);
    } else if (clientY > rect.bottom - DESKTOP_DRAG_SCROLL_ZONE) {
      const intensity = (clientY - (rect.bottom - DESKTOP_DRAG_SCROLL_ZONE)) / DESKTOP_DRAG_SCROLL_ZONE;
      velocity = DESKTOP_DRAG_MAX_SCROLL_SPEED * Math.min(Math.max(intensity, 0), 1);
    }

    if ((velocity < 0 && mainScroll.scrollTop <= 0) || (velocity > 0 && mainScroll.scrollTop >= maxScrollTop)) {
      velocity = 0;
    }

    if (velocity !== 0) {
      const prevScrollTop = mainScroll.scrollTop;
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, prevScrollTop + (velocity * elapsed)));
      if (nextScrollTop !== prevScrollTop) {
        mainScroll.scrollTop = nextScrollTop;
        syncDesktopDraggedTaskPosition(
          desktopDragStateRef.current.taskId,
          desktopDragPointerRef.current.x,
          desktopDragPointerRef.current.y,
        );
      }
    }

    desktopAutoScrollFrameRef.current = window.requestAnimationFrame(runDesktopAutoScroll);
  }, [stopDesktopAutoScroll, syncDesktopDraggedTaskPosition, updateDesktopDragDayAutoFlip]);

  const startDesktopTaskDrag = useCallback((task) => {
    const taskId = task.id;
    desktopDragModeRef.current = true;
    dragOverSectionRef.current = task.timeOfDay;
    dragOverSlotRef.current = task.desktopSlot;
    lockedMainScrollTopRef.current = mainScrollRef.current?.scrollTop || 0;
    document.body.classList.add('desktop-task-dragging');

    const card = document.getElementById(`desktop-task-card-${taskId}`);
    const wrapper = document.getElementById(`desktop-task-wrapper-${taskId}`);
    if (wrapper) wrapper.classList.add('is-dragging');
    if (card) {
      const originRect = card.getBoundingClientRect();
      desktopDragOriginRectRef.current = originRect;
      desktopDragOverlayRectRef.current = {
        left: originRect.left,
        top: originRect.top,
        width: originRect.width,
        height: originRect.height,
      };
      desktopDragPointerOffsetRef.current = {
        x: desktopDragPointerRef.current.x - originRect.left,
        y: desktopDragPointerRef.current.y - originRect.top,
      };
    }

    setDraggedTaskId(taskId);
    setDragOverSection(task.timeOfDay);
    setDragOverSlot(task.desktopSlot);

    window.requestAnimationFrame(() => {
      syncDesktopDraggedTaskPosition(
        taskId,
        desktopDragPointerRef.current.x,
        desktopDragPointerRef.current.y,
      );
    });
    if (desktopAutoScrollFrameRef.current === null) {
      desktopAutoScrollFrameRef.current = window.requestAnimationFrame(runDesktopAutoScroll);
    }
  }, [runDesktopAutoScroll, syncDesktopDraggedTaskPosition]);

  const finishDesktopTaskDrag = useCallback((task, pointerTarget, pointerId) => {
    stopDesktopAutoScroll();
    clearDesktopDayFlipTimer();

    const wrapper = document.getElementById(`desktop-task-wrapper-${task.id}`);
    if (wrapper) {
      wrapper.classList.remove('is-dragging');
    }

    document.body.classList.remove('desktop-task-dragging');

    if (desktopDragModeRef.current) {
      suppressNextTaskClick(task.id);
      const targetSection = dragOverSectionRef.current;
      const targetSlot = dragOverSlotRef.current;
      if (targetSection && isValidDesktopSlot(targetSlot)) {
        flushSync(() => {
          setTasks((prev) => applyDesktopTaskDrop({
            tasks: prev,
            draggedTaskId: task.id,
            sourceDateString: task.dateString,
            sourceSection: task.timeOfDay,
            sourceSlot: task.desktopSlot,
            targetDateString: dateKey(selectedDateRef.current),
            targetSection,
            targetSlot,
          }));
        });
      }
    }

    desktopDragModeRef.current = false;
    desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
    desktopDragOriginRectRef.current = null;
    desktopDragPointerOffsetRef.current = { x: 0, y: 0 };
    desktopDragOverlayRectRef.current = null;
    desktopDayFlipCooldownUntilRef.current = 0;
    dragOverSectionRef.current = null;
    dragOverSlotRef.current = null;
    setDragOverSection(null);
    setDragOverSlot(null);
    setDraggedTaskId(null);

    if (pointerTarget?.hasPointerCapture?.(pointerId)) {
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch (_) {
        // Pointer capture may already be released.
      }
    }
  }, [clearDesktopDayFlipTimer, setTasks, stopDesktopAutoScroll, suppressNextTaskClick]);

  const handleTaskPointerDown = useCallback((task, event) => {
    if (!event.isPrimary || event.button !== 0) return;

    activePointerTaskRef.current = task;
    desktopDragModeRef.current = false;
    desktopDragStateRef.current = {
      pointerId: event.pointerId,
      taskId: task.id,
      startX: event.clientX,
      startY: event.clientY,
    };
    desktopDragPointerRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const processDesktopDragMove = useCallback((task, clientX, clientY, nativeEvent = null) => {
    desktopDragPointerRef.current = { x: clientX, y: clientY };
    const deltaX = clientX - desktopDragStateRef.current.startX;
    const deltaY = clientY - desktopDragStateRef.current.startY;

    if (!desktopDragModeRef.current) {
      const distance = Math.hypot(deltaX, deltaY);
      if (distance >= DESKTOP_DRAG_START_DISTANCE) {
        startDesktopTaskDrag(task);
      } else {
        return;
      }
    }

    if (nativeEvent?.cancelable) {
      nativeEvent.preventDefault();
    }
    syncDesktopDraggedTaskPosition(task.id, clientX, clientY);
    updateDesktopDragDayAutoFlip(clientX, task.id);
  }, [startDesktopTaskDrag, syncDesktopDraggedTaskPosition, updateDesktopDragDayAutoFlip]);

  const handleTaskPointerMove = useCallback((task, event) => {
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
    processDesktopDragMove(task, event.clientX, event.clientY, event);
  }, [processDesktopDragMove]);

  const handleTaskPointerUp = useCallback((task, event) => {
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
    if (desktopDragModeRef.current) {
      finishDesktopTaskDrag(task, event.currentTarget, event.pointerId);
      activePointerTaskRef.current = null;
      return;
    }

    desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
    activePointerTaskRef.current = null;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Pointer capture may already be released.
      }
    }
  }, [finishDesktopTaskDrag]);

  const handleTaskPointerCancel = useCallback((task, event) => {
    if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== task.id) return;
    if (desktopDragModeRef.current) {
      finishDesktopTaskDrag(task, event.currentTarget, event.pointerId);
      activePointerTaskRef.current = null;
      return;
    }

    desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
    activePointerTaskRef.current = null;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch (_) {
        // Pointer capture may already be released.
      }
    }
  }, [finishDesktopTaskDrag]);

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      const activeTask = activePointerTaskRef.current;
      if (!activeTask) return;
      if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== activeTask.id) return;
      processDesktopDragMove(activeTask, event.clientX, event.clientY, event);
    };

    const handleWindowPointerEnd = (event) => {
      const activeTask = activePointerTaskRef.current;
      if (!activeTask) return;
      if (desktopDragStateRef.current.pointerId !== event.pointerId || desktopDragStateRef.current.taskId !== activeTask.id) return;

      if (desktopDragModeRef.current) {
        finishDesktopTaskDrag(activeTask, null, event.pointerId);
      } else {
        desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
        desktopDragOriginRectRef.current = null;
        clearDesktopDayFlipTimer();
      }
      activePointerTaskRef.current = null;
    };

    const handleWindowMouseMove = (event) => {
      const activeTask = activePointerTaskRef.current;
      if (!activeTask) return;
      if (desktopDragStateRef.current.taskId !== activeTask.id) return;
      if ((event.buttons & 1) !== 1 && !desktopDragModeRef.current) return;

      processDesktopDragMove(activeTask, event.clientX, event.clientY, event);
    };

    const handleWindowMouseUp = () => {
      const activeTask = activePointerTaskRef.current;
      if (!activeTask) return;

      if (desktopDragModeRef.current) {
        finishDesktopTaskDrag(activeTask, null, null);
      } else {
        desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
        clearDesktopDayFlipTimer();
      }
      activePointerTaskRef.current = null;
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);
    window.addEventListener('mousemove', handleWindowMouseMove, { passive: false });
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [clearDesktopDayFlipTimer, finishDesktopTaskDrag, processDesktopDragMove]);

  const selectedDateKey = dateKey(selectedDate);
  const desktopPreviousDayLabel = useMemo(
    () => panelLabel(shiftDateByDays(selectedDate, -1), language),
    [language, selectedDate],
  );
  const desktopNextDayLabel = useMemo(
    () => panelLabel(shiftDateByDays(selectedDate, 1), language),
    [language, selectedDate],
  );
  const desktopSectionTasks = useMemo(() => buildDesktopRenderSections({
    tasks,
    selectedDateKey,
    draggedTaskId,
    dragOverSection,
    dragOverSlot,
  }), [dragOverSection, dragOverSlot, draggedTaskId, selectedDateKey, tasks]);

  useEffect(() => {
    if (!draggedTaskId || !desktopDragModeRef.current) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      syncDesktopDraggedTaskPosition(
        draggedTaskId,
        desktopDragPointerRef.current.x,
        desktopDragPointerRef.current.y,
      );
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [draggedTaskId, selectedDateKey, syncDesktopDraggedTaskPosition]);

  useLayoutEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-desktop-layout-id]'));
    const nextRects = new Map(
      elements.map((element) => [element.getAttribute('data-desktop-layout-id'), element.getBoundingClientRect()]),
    );
    const prevRects = desktopLayoutRectsRef.current;

    elements.forEach((element) => {
      const id = element.getAttribute('data-desktop-layout-id');
      const prevRect = prevRects.get(id);
      const nextRect = nextRects.get(id);
      if (!id || !prevRect || !nextRect) return;

      const deltaX = prevRect.left - nextRect.left;
      const deltaY = prevRect.top - nextRect.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

      element.style.transition = 'none';
      element.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
      element.getBoundingClientRect();
      element.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
      element.style.transform = 'translate3d(0, 0, 0)';
    });

    desktopLayoutRectsRef.current = nextRects;
  }, [desktopSectionTasks]);
  const editingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) || null : null;
  const canSaveEdit = editText.trim().length > 0;
  const handleTaskEdit = useCallback((task) => {
    setEditingTaskId(task.id);
    setEditText(task.text);
  }, []);

  const handleTaskDelete = useCallback((task) => {
    setTasks((prev) => {
      const nextTasks = prev.filter((t) => t.id !== task.id);
      reflowDesktopSectionSlots(nextTasks, task.dateString, task.timeOfDay);
      return nextTasks;
    });
  }, [setTasks]);

  const closeEditModal = useCallback(() => {
    setEditingTaskId(null);
    setEditText('');
  }, []);

  useEffect(() => {
    if (editingTaskId && !editingTask) {
      closeEditModal();
    }
  }, [closeEditModal, editingTask, editingTaskId]);

  useEffect(() => {
    if (!editingTaskId) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeEditModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeEditModal, editingTaskId]);

  const openTaskEditor = useCallback((task) => {
    setProfileOpen(false);
    setPanelOpen(false);
    setSelectedDate(parseSharedSelectedDate(task.dateString) || selectedDate);
    setEditingTaskId(task.id);
    setEditText(task.text || '');
  }, [selectedDate]);

  const {
    onPrimaryAction: handleTaskPrimaryAction,
    onEditAction: handleTaskEditAction,
  } = useTaskInteraction({
    platform: 'desktop',
    openTaskEditor,
  });

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: appearance === 'dark' ? '#121212' : '#faf7f2' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: `4px solid ${appearance === 'dark' ? '#333333' : '#e8e0d6'}`, borderTop: '4px solid #ED1F1F', animation: 'desktop-spin 1s linear infinite' }} />
        <style>{`@keyframes desktop-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!user) return <DesktopLogin />;
  const draggedTask = draggedTaskId ? tasks.find((task) => task.id === draggedTaskId) || null : null;
  const closePanel = () => {
    setInputText('');
    setPanelOpen(false);
  };
  const applyAsyncMetadata = (taskId, cardType, videoUrl, mapUrl, primaryUrl) => {
    if (cardType === 'video' && videoUrl) {
      fetchVideoMeta(videoUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta }) : task)));
      });
    } else if (cardType === 'place' && mapUrl) {
      fetchMapMeta(mapUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta }) : task)));
      });
    } else if ((cardType === 'music' || cardType === 'podcast') && primaryUrl) {
      fetchSpotifyMeta(primaryUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta }) : task)));
      });
    } else if (primaryUrl && (!cardType || cardType === 'link' || cardType === 'text')) {
      fetchLinkPreviewMeta(primaryUrl).then((meta) => {
        if (meta && meta.linkTitle) {
          setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, linkTitle: meta.linkTitle }) : task)));
        }
      });
    }
  };
  const saveTask = () => {
    const rawText = inputText.trim();
    if (!rawText) return;

    const resolvedSectionId = activeChip === 'now' ? currentBlock : activeChip;
    const typeFields = getDerivedTaskFields(rawText);
    const { cardType, videoUrl, mapUrl } = typeFields;
    const taskId = Date.now();

    const nextTask = normalizeTask({
      id: taskId,
      text: rawText,
      completed: false,
      timeOfDay: sectionIdToMobileId(resolvedSectionId),
      dateString: selectedDateKey,
      ...typeFields,
      desktopSlot: null,
    });

    setTasks((prev) => {
      const desktopSlot = getFirstAvailableDesktopSlot(prev, selectedDateKey, nextTask.timeOfDay);
      return [...prev, normalizeTask({ ...nextTask, desktopSlot })];
    });

    // Track analytics 
    if (user?.id) {
      trackUserEvent(user.id, 'task_added', { cardType, platform: 'desktop' });
    }

    setInputText('');
    setPanelOpen(false);
    applyAsyncMetadata(taskId, cardType, videoUrl, mapUrl, typeFields.primaryUrl);
  };
  const handleEditSave = () => {
    const rawText = editText.trim();
    if (!editingTask || !rawText) return;

    const typeFields = getDerivedTaskFields(rawText);
    setTasks((prev) => prev.map((task) => (
      task.id === editingTask.id
        ? normalizeTask({ ...task, text: rawText, ...typeFields })
        : task
    )));
    applyAsyncMetadata(editingTask.id, typeFields.cardType, typeFields.videoUrl, typeFields.mapUrl, typeFields.primaryUrl);
    closeEditModal();
  };
  const handleTaskClick = (task) => {
    if (Date.now() < suppressAllTaskClicksUntilRef.current) {
      return;
    }
    if (suppressTaskClickRef.current === task.id) {
      suppressTaskClickRef.current = null;
      return;
    }

    const { redirectUrl, isPlain } = getTaskCardPresentation(task, t);

    // Track analytics 
    if (user?.id) {
      trackUserEvent(user.id, 'task_clicked', { action: 'card_click', platform: 'desktop', isPlain, hasRedirect: !!redirectUrl });
    }

    if (isPlain) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? normalizeTask({ ...t, completed: !t.completed }) : t))
      );
      return;
    }

    if (redirectUrl) {
      window.open(redirectUrl, '_blank', 'noopener,noreferrer');
    }
  };
  const handleSignOut = async () => {
    try {
      await supabase?.auth?.signOut();
    } finally {
      setProfileOpen(false);
    }
  };

  return (
    <>
      <GlobalStyles appearance={appearance} />
      <div className={`desktop-app ${appearance === 'dark' ? 'desktop-app-dark dark-theme' : 'desktop-app-light'}`} style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--desktop-root-bg)', color: 'var(--desktop-root-text)', fontFamily: 'Inter, sans-serif' }}>
        <header style={{ height: 74, padding: '0 38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--desktop-header-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <h1 style={{ margin: 0, fontFamily: 'DM Serif Display, serif', fontSize: 28, fontStyle: 'italic', lineHeight: 1 }}>{panelLabel(selectedDate, language)}</h1>
            {!todaySelected ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(logicalToday);
                  setProfileOpen(false);
                }}
                aria-label={t.backToToday}
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: '1px solid var(--desktop-back-today-border)',
                  background: 'var(--desktop-back-today-bg)',
                  color: 'var(--desktop-back-today-text)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontFamily: 'DM Serif Display, serif',
                  fontSize: 16,
                  fontStyle: 'italic',
                  lineHeight: 1,
                  boxShadow: '0 6px 16px rgba(28, 17, 8, 0.05)',
                }}
              >
                <ReturnTodayIcon />
                <span>{t.today}</span>
              </button>
            ) : null}
            {todaySelected ? <Clock /> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <button type="button" className="desktop-profile-trigger" onClick={() => setProfileOpen(true)} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--desktop-avatar-border)', background: 'var(--desktop-avatar-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
              {userProfile.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt={userProfile.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18, color: 'var(--desktop-root-text)' }}>{userProfile.initial}</span>
              )}
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', height: 'calc(100vh - 74px)' }}>
          <div
            ref={desktopDragViewportRef}
            className={`desktop-main-stage ${desktopDragDayFeedback ? `desktop-main-stage-feedback-${desktopDragDayFeedback}` : ''}`}
            style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden' }}
          >
            <div className="desktop-main-stage-inner" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--desktop-main-gradient)' }}>
              <WeekStrip selectedDate={selectedDate} logicalToday={logicalToday} language={language} onSelect={(date) => { setSelectedDate(date); setProfileOpen(false); }} />
              <main ref={mainScrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--desktop-root-bg)' }}>
                {sections.map((section) => (
                  <ScheduleSection
                    key={section.id}
                    section={section}
                    appearance={appearance}
                    language={language}
                    labels={t}
                    renderSlots={desktopSectionTasks[section.mobileId]?.renderSlots || Array.from({ length: DESKTOP_BASE_SLOT_COUNT }, () => ({ type: 'empty' }))}
                    markerStyle={getSectionMarkerStyle(section, currentTime, selectedDate)}
                    onTaskClick={handleTaskClick}
                    onTaskEdit={handleTaskEdit}
                    onTaskDelete={handleTaskDelete}
                    onTaskPointerDown={handleTaskPointerDown}
                    onTaskPointerMove={handleTaskPointerMove}
                    onTaskPointerUp={handleTaskPointerUp}
                    onTaskPointerCancel={handleTaskPointerCancel}
                    draggedTaskId={draggedTaskId}
                    isDragOver={dragOverSection === section.mobileId}
                  />
                ))}
              </main>
            </div>
            <DragDayFeedbackOverlay
              direction={desktopDragDayFeedback}
              previousLabel={desktopPreviousDayLabel}
              nextLabel={desktopNextDayLabel}
              zones={desktopDragDayZones}
            />
          </div>
          <AddPanel open={panelOpen} language={language} selectedDate={selectedDate} chipsToShow={visibleChips} activeChip={activeChip} setActiveChip={setActiveChip} inputText={inputText} setInputText={setInputText} onClose={closePanel} onSubmit={saveTask} onSelectDate={setSelectedDate} />
        </div>

        {!panelOpen ? <button type="button" onClick={() => { setProfileOpen(false); closeEditModal(); setActiveChip(visibleChips[0]?.id || 'now'); setInputText(''); setPanelOpen(true); }} aria-label={t.addTaskAria} style={{ position: 'fixed', right: 42, bottom: 30, width: 50, height: 50, borderRadius: '50%', border: '1px solid var(--desktop-floating-border)', background: 'var(--desktop-floating-bg)', color: 'var(--desktop-floating-text)', boxShadow: 'var(--desktop-floating-shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 20 }}><PlusIcon /></button> : null}

        {editingTask ? (
          <div
            role="presentation"
            onClick={closeEditModal}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'var(--desktop-modal-backdrop)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 28,
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="desktop-edit-modal-title"
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 'min(100%, 560px)',
                maxHeight: 'min(640px, calc(100vh - 56px))',
                background: 'var(--desktop-edit-bg)',
                border: '1px solid var(--desktop-edit-border)',
                borderRadius: 24,
                boxShadow: 'var(--desktop-edit-shadow)',
                display: 'grid',
                gridTemplateRows: 'auto minmax(0, 1fr) auto',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '22px 24px 16px', borderBottom: '1px solid var(--desktop-edit-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <IntoDayLogo
                    showWordmark={false}
                    className="desktop-edit-modal-logo"
                    iconClassName="desktop-edit-modal-logo-icon"
                  />
                  <h2 id="desktop-edit-modal-title" style={{ margin: 0, fontFamily: 'DM Serif Display, serif', fontSize: 28, fontStyle: 'italic', lineHeight: 1, color: 'var(--desktop-root-text)' }}>
                    {t.editTaskTitle}
                  </h2>
                </div>
                <button type="button" onClick={closeEditModal} aria-label={t.close} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--desktop-modal-close-bg)', border: '1px solid var(--desktop-edit-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, color: 'var(--desktop-modal-close-text)' }}>
                  <CloseIcon />
                </button>
              </div>
              <div style={{ minHeight: 0, padding: 24 }}>
                <textarea
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      handleEditSave();
                    }
                  }}
                  autoFocus
                  rows={10}
                  placeholder={t.editTaskPlaceholder}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 280,
                    border: '1px solid var(--desktop-edit-input-border)',
                    background: 'var(--desktop-edit-input-bg)',
                    borderRadius: 18,
                    padding: 18,
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: 'var(--desktop-root-text)',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px 24px', borderTop: '1px solid var(--desktop-edit-border)' }}>
                <button type="button" onClick={closeEditModal} style={{ minWidth: 96, height: 44, padding: '0 18px', borderRadius: 14, border: '1px solid var(--desktop-cancel-border)', background: 'var(--desktop-cancel-bg)', color: 'var(--desktop-cancel-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  {t.cancel}
                </button>
                <button type="button" onClick={handleEditSave} disabled={!canSaveEdit} style={{ minWidth: 136, height: 44, padding: '0 20px', background: canSaveEdit ? 'var(--desktop-save-bg)' : 'var(--desktop-save-disabled-bg)', color: canSaveEdit ? 'var(--desktop-save-text)' : 'var(--desktop-save-disabled-text)', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: canSaveEdit ? 'pointer' : 'not-allowed' }}>
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <DesktopProfilePage
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          language={language}
          setLanguage={setLanguage}
          appearance={appearance}
          setAppearance={setAppearance}
          onSignOut={handleSignOut}
        />
        <DragOverlayCard task={draggedTask} rect={desktopDragOverlayRectRef.current} appearance={appearance} labels={t} />
      </div>
    </>
  );
}

export default App;
