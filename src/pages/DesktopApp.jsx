import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import DesktopLogin from '../DesktopLogin';
import { useSyncedTodos } from '../todoSync';
import { getUserProfile } from '../userProfile';
import DesktopProfilePage from '../components/DesktopProfilePage';
import IntoDayLogo from '../components/IntoDayLogo';
import {
  detectCardType,
  extractMapUrl,
  extractVideoUrl,
  fetchMapMeta,
  fetchVideoMeta,
  getTaskCardPresentation,
} from '../taskCardUtils';

const SHARED_SELECTED_DATE_KEY = 'shared_selected_date';
const DESKTOP_LANGUAGE_KEY = 'desktop_profile_language';
const DESKTOP_APPEARANCE_KEY = 'desktop_profile_appearance';
const sections = [
  { id: 'morning', mobileId: 'Morning', label: 'Morning', start: '06:00', end: '12:00', pillBg: '#f7d8a5', pillColor: '#6b3f06', accent: '#2990d7', iconBg: '#e8f2fb' },
  { id: 'afternoon', mobileId: 'Afternoon', label: 'Afternoon', start: '12:00', end: '18:00', pillBg: '#bfe3fb', pillColor: '#0d4c82', accent: '#41a2e5', iconBg: '#eaf6ff' },
  { id: 'evening', mobileId: 'Evening', label: 'Evening', start: '18:00', end: '22:00', pillBg: '#eadffd', pillColor: '#5f2d90', accent: '#9161d4', iconBg: '#f5efff' },
  { id: 'night', mobileId: 'Night', label: 'Night', start: '22:00', end: '00:00', pillBg: '#dfe6ef', pillColor: '#213243', accent: '#70839a', iconBg: '#eef2f6' },
];
const chips = [
  { id: 'now', label: 'Now' },
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
];
const DESKTOP_DRAG_START_DISTANCE = 4;
const DESKTOP_DRAG_SCROLL_ZONE = 96;
const DESKTOP_DRAG_MAX_SCROLL_SPEED = 1.35;
const DESKTOP_DRAG_EDGE_OVERFLOW_TOP = 20;
const DESKTOP_DRAG_EDGE_OVERFLOW_BOTTOM = 64;
const DESKTOP_DRAG_EDGE_RESISTANCE = 0.22;
const DESKTOP_DRAG_MAX_EDGE_OVERFLOW = 96;

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const parseSharedSelectedDate = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const getLogicalToday = () => {
  const now = new Date();
  now.setHours(now.getHours() - 6);
  now.setHours(0, 0, 0, 0);
  return now;
};
const sectionIdToMobileId = (sectionId) => {
  const matched = sections.find((section) => section.id === sectionId);
  return matched?.mobileId || 'Morning';
};
const mobileIdToSectionId = (mobileId) => {
  const matched = sections.find((section) => section.mobileId === mobileId);
  return matched?.id || 'morning';
};
const normalizeTask = (task) => ({
  ...task,
  text: task.text || '',
  completed: task.completed ?? false,
  dateString: task.dateString || dateKey(getLogicalToday()),
  timeOfDay: task.timeOfDay || sectionIdToMobileId(task.section),
  cardType: task.cardType || 'plain',
});
const currentSection = (date = new Date()) => {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'night';
};
const panelLabel = (date) => sameDay(date, getLogicalToday()) ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const GlobalStyles = () => {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; min-height: 100%; background: #f8f5f1; }
      body { overflow: hidden; }
      button, input { font: inherit; }
      ::selection { background-color: #ef4444; color: white; }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);
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
      {[...hh].map((digit, i) => <span key={`h${i}`} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #ddd6cf', background: '#f4f1ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{digit}</span>)}
      <span style={{ color: '#7f7b76' }}>:</span>
      {[...mm].map((digit, i) => <span key={`m${i}`} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #ddd6cf', background: '#f4f1ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{digit}</span>)}
    </div>
  );
};

const ReturnTodayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" style={{ width: 14, height: 14 }}>
    <path d="M6.25 6.25H2.5V2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.917 6.25C3.921 3.785 6.341 2.083 9.167 2.083C12.892 2.083 15.917 5.108 15.917 8.833C15.917 12.559 12.892 15.583 9.167 15.583C6.422 15.583 4.06 13.944 3.011 11.592" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WeekStrip = ({ selectedDate, logicalToday, onSelect }) => {
  const logicalMidnight = new Date(logicalToday);
  logicalMidnight.setHours(0, 0, 0, 0);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selectedDate);
    date.setDate(selectedDate.getDate() - 3 + index);
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    return {
      key: date.toISOString(),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      num: date.getDate(),
      active: sameDay(date, selectedDate),
      isToday: sameDay(date, logicalToday),
      isPast: normalizedDate < logicalMidnight,
      isFuture: normalizedDate > logicalMidnight,
      date,
    };
  });
  return (
    <div style={{ borderTop: '1px solid #e6e0d9', borderBottom: '1px solid #ede7df', background: '#f6f3ef' }}>
      <div style={{ width: 'min(1120px, calc(100% - 72px))', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 12, padding: '8px 0' }}>
        {week.map((day) => (
          <button key={day.key} type="button" onClick={() => onSelect(day.date)} style={{ border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', height: 48, padding: '8px 0', position: 'relative' }}>
            <span style={{ fontSize: 14, fontWeight: day.active ? 700 : 500, letterSpacing: '0.06em', color: day.active ? '#111' : day.isPast ? '#a0a4ab' : '#7d7b77' }}>{day.label}</span>
            <span style={{ width: 22, minWidth: 22, maxWidth: 22, height: 22, minHeight: 22, maxHeight: 22, aspectRatio: '1 / 1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: day.active ? '#ef2f2f' : 'transparent', color: day.active ? '#fff' : day.isPast ? '#a0a4ab' : '#7d7b77', fontSize: 14, lineHeight: 1, fontWeight: day.active ? 700 : 500 }}>{day.num}</span>
            {!day.active && day.isToday ? <span style={{ position: 'absolute', left: '50%', bottom: 2, width: 4, height: 4, borderRadius: '50%', background: '#ef2f2f', transform: 'translateX(-50%)' }} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
};

const TaskCardContent = ({ task }) => {
  const { cfg, displayTitle, displaySub } = getTaskCardPresentation(task);

  return (
    <>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img src={cfg.icon} alt={task.cardType || 'plain'} style={{ width: 18, height: 18, objectFit: 'contain' }} />
      </div>
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', wordBreak: 'break-word', color: task.completed ? '#8e8e93' : '#181818', textDecoration: task.completed ? 'line-through' : 'none', fontSize: 13, fontWeight: 590, lineHeight: '20px' }}>
          {displayTitle}
        </div>
        <div style={{ color: '#8e8e93', fontSize: 11, fontWeight: 400, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displaySub}
        </div>
      </div>
    </>
  );
};

const TaskCard = ({
  task,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  isDragging,
}) => {
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
          border: '2px solid #f2f2f2',
          background: '#fff',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 2px 16px rgba(0, 0, 0, 0.03)',
          cursor: isDragging ? 'grabbing' : 'pointer',
          textAlign: 'left',
          opacity: task.completed ? 0.5 : 1,
          transition: 'none',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <TaskCardContent task={task} />
      </button>
    </div>
  );
};

const DragOverlayCard = ({ task, rect }) => {
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
      <div className="desktop-task-drag-overlay-card" style={{ opacity: task.completed ? 0.5 : 1 }}>
        <TaskCardContent task={task} />
      </div>
    </div>
  );
};

const ScheduleSection = ({
  section,
  tasks,
  showMarker,
  onTaskClick,
  onTaskPointerDown,
  onTaskPointerMove,
  onTaskPointerUp,
  onTaskPointerCancel,
  draggedTaskId,
  isDragOver,
}) => (
  <section style={{ borderBottom: '1px solid #ece4da', background: '#fffdfb' }}>
    <div style={{ width: 'min(1120px, calc(100% - 72px))', margin: '0 auto', padding: '22px 0 24px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 72, padding: '6px 14px', borderRadius: 999, background: section.pillBg, color: section.pillColor, fontFamily: 'DM Serif Display, serif', fontSize: 14, fontStyle: 'italic' }}>{section.label}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', gap: 24, marginTop: 18, alignItems: 'start' }}>
        <div style={{ position: 'relative', minHeight: 220 }}>
          <div style={{ color: '#161616', fontSize: 15, fontWeight: 500 }}>{section.start}</div>
          <div style={{ position: 'absolute', left: 5, top: 26, bottom: 36, width: 1, background: '#e2ddd7' }} />
          {showMarker ? <div style={{ position: 'absolute', left: 2, top: 48, width: 7, height: 7, borderRadius: '50%', background: '#ef2f2f' }} /> : null}
          <div style={{ position: 'absolute', left: 0, bottom: 0, color: '#161616', fontSize: 15, fontWeight: 500 }}>{section.end}</div>
        </div>
        <div
          data-desktop-block-id={section.mobileId}
          className={`desktop-schedule-task-grid ${isDragOver ? 'is-drag-over' : ''}`}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))', gap: 22, alignItems: 'start' }}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDragging={draggedTaskId === task.id}
              onClick={() => onTaskClick(task)}
              onPointerDown={(event) => onTaskPointerDown(task, event)}
              onPointerMove={(event) => onTaskPointerMove(task, event)}
              onPointerUp={(event) => onTaskPointerUp(task, event)}
              onPointerCancel={(event) => onTaskPointerCancel(task, event)}
            />
          ))}
        </div>
      </div>
    </div>
  </section>
);

const AddPanel = ({ open, selectedDate, chipsToShow, activeChip, setActiveChip, inputText, setInputText, onClose, onSubmit, onSelectDate }) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarOffset, setCalendarOffset] = useState(0);

  if (!open) return null;

  const rows = chipsToShow.length <= 3 ? [chipsToShow] : [chipsToShow.slice(0, 3), chipsToShow.slice(3)];
  const logicalToday = getLogicalToday();
  const maxDate = new Date(logicalToday);
  maxDate.setDate(maxDate.getDate() + 30);
  const calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + calendarOffset, 1);
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const startOffset = monthStart.getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const trailingCells = Math.max(0, 42 - startOffset - daysInMonth);
  const isAtMinMonth = monthStart.getFullYear() === logicalToday.getFullYear() && monthStart.getMonth() === logicalToday.getMonth();
  const isAtMaxMonth = monthStart.getFullYear() === maxDate.getFullYear() && monthStart.getMonth() === maxDate.getMonth();
  const desktopCalendarCellSize = 32;
  const desktopCalendarGap = 6;
  return (
    <aside style={{ width: 348, borderLeft: '1px solid #ece4da', background: '#fffdfb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#f5f1ec', color: '#202020', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><CloseIcon /></button>
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
        }} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isCalendarOpen ? 18 : 30, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: '#111' }}>
          <h2 style={{ margin: 0, fontFamily: 'DM Serif Display, serif', fontSize: 38, fontStyle: 'italic', lineHeight: 1 }}>{panelLabel(selectedDate)}</h2>
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="13" viewBox="0 0 9 14" fill="none" style={{ transform: isCalendarOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)' }}><path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="black" /></svg>
        </button>
        {isCalendarOpen ? (
          <div style={{ width: 'fit-content', maxWidth: '100%', marginBottom: 20, padding: '14px 14px 16px', borderRadius: 20, background: '#faf7f2', border: '1px solid #efe8de' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button type="button" disabled={isAtMinMonth} onClick={() => setCalendarOffset((prev) => prev - 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#f0ece6', color: isAtMinMonth ? '#c9c3bb' : '#111', cursor: isAtMinMonth ? 'default' : 'pointer' }}>
                {'<'}
              </button>
              <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20, fontStyle: 'italic' }}>{monthLabel}</span>
              <button type="button" disabled={isAtMaxMonth} onClick={() => setCalendarOffset((prev) => prev + 1)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#f0ece6', color: isAtMaxMonth ? '#c9c3bb' : '#111', cursor: isAtMaxMonth ? 'default' : 'pointer' }}>
                {'>'}
              </button>
            </div>
            <div style={{ display: 'grid', width: 'fit-content', maxWidth: '100%', gridTemplateColumns: `repeat(7, ${desktopCalendarCellSize}px)`, gap: desktopCalendarGap }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label) => (
                <div key={label} style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#a0a4ab' }}>{label}</div>
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
                      border: today && !selected ? '1px solid #ed1f1f' : 'none',
                      background: selected ? '#ed1f1f' : 'transparent',
                      color: selected ? '#fff' : today ? '#ed1f1f' : inRange ? '#111' : '#d0d0d0',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 13, fontWeight: 700, letterSpacing: '0.03em' }}><ClockOutline />TIME OF DAY</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {row.map((chip) => <button key={chip.id} type="button" onClick={() => setActiveChip(chip.id)} style={{ minWidth: 62, height: 30, padding: '0 14px', borderRadius: 999, border: 'none', background: activeChip === chip.id ? '#ef2f2f' : '#f5f5f5', color: activeChip === chip.id ? '#fff' : '#242424', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>{chip.label}</button>)}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <input type="text" autoFocus value={inputText} onChange={(event) => setInputText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onSubmit(); } }} placeholder="e.g Buy groceries at 9pm..." style={{ width: '100%', minHeight: 58, height: 58, borderRadius: 22, border: '1px solid #ddd7cf', background: '#fff', padding: '0 58px 0 16px', outline: 'none', fontSize: 15, boxShadow: '0 12px 28px rgba(17, 17, 17, 0.06)' }} />
          <button type="button" onClick={onSubmit} style={{ position: 'absolute', right: 8, bottom: 9, width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 18px rgba(17, 17, 17, 0.18)' }}><ArrowUpIcon /></button>
        </div>
      </div>
    </aside>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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
  const [tasks, setTasks] = useSyncedTodos({
    userId: user?.id || null,
    normalizeTodo: normalizeTask,
  });
  const userProfile = useMemo(() => getUserProfile(user), [user]);
  const mainScrollRef = useRef(null);
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
  const lockedMainScrollTopRef = useRef(0);
  const desktopAutoScrollFrameRef = useRef(null);
  const desktopAutoScrollLastTsRef = useRef(null);
  const suppressTaskClickRef = useRef(null);
  const suppressTaskClickTimeoutRef = useRef(null);

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
    suppressTaskClickRef.current = taskId;
    suppressTaskClickTimeoutRef.current = window.setTimeout(() => {
      if (suppressTaskClickRef.current === taskId) {
        suppressTaskClickRef.current = null;
      }
      suppressTaskClickTimeoutRef.current = null;
    }, 250);
  }, []);

  const getNearestDesktopSection = useCallback((targetY) => {
    const zones = document.querySelectorAll('[data-desktop-block-id]');
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    zones.forEach((zone) => {
      const rect = zone.getBoundingClientRect();
      const centerY = rect.top + (rect.height / 2);
      const distance = Math.abs(targetY - centerY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = zone.getAttribute('data-desktop-block-id');
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

    const nearestSection = getNearestDesktopSection(clientY);
    if (nearestSection !== dragOverSectionRef.current) {
      dragOverSectionRef.current = nearestSection;
      setDragOverSection(nearestSection);
    }
  }, [getNearestDesktopSection]);

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
  }, [stopDesktopAutoScroll, syncDesktopDraggedTaskPosition]);

  const startDesktopTaskDrag = useCallback((taskId) => {
    desktopDragModeRef.current = true;
    dragOverSectionRef.current = null;
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

    const wrapper = document.getElementById(`desktop-task-wrapper-${task.id}`);
    if (wrapper) {
      wrapper.classList.remove('is-dragging');
    }

    document.body.classList.remove('desktop-task-dragging');

    if (desktopDragModeRef.current) {
      suppressNextTaskClick(task.id);
      const targetSection = dragOverSectionRef.current;
      if (targetSection && targetSection !== task.timeOfDay) {
        setTasks((prev) => prev.map((item) => (
          item.id === task.id ? normalizeTask({ ...item, timeOfDay: targetSection }) : item
        )));
      }
    }

    desktopDragModeRef.current = false;
    desktopDragStateRef.current = { pointerId: null, taskId: null, startX: 0, startY: 0 };
    desktopDragOriginRectRef.current = null;
    desktopDragPointerOffsetRef.current = { x: 0, y: 0 };
    desktopDragOverlayRectRef.current = null;
    dragOverSectionRef.current = null;
    setDragOverSection(null);
    setDraggedTaskId(null);

    if (pointerTarget?.hasPointerCapture?.(pointerId)) {
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch (_) {
        // Pointer capture may already be released.
      }
    }
  }, [setTasks, stopDesktopAutoScroll, suppressNextTaskClick]);

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
        startDesktopTaskDrag(task.id);
      } else {
        return;
      }
    }

    if (nativeEvent?.cancelable) {
      nativeEvent.preventDefault();
    }
    syncDesktopDraggedTaskPosition(task.id, clientX, clientY);
  }, [startDesktopTaskDrag, syncDesktopDraggedTaskPosition]);

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
  }, [finishDesktopTaskDrag, processDesktopDragMove]);

  const selectedTasks = tasks.filter((task) => task.dateString === dateKey(selectedDate));
  const editingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) || null : null;
  const canSaveEdit = editText.trim().length > 0;
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

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf7f2' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', border: '4px solid #e8e0d6', borderTop: '4px solid #ef2f2f', animation: 'desktop-spin 1s linear infinite' }} />
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
  const applyAsyncMetadata = (taskId, cardType, videoUrl, mapUrl) => {
    if (cardType === 'video' && videoUrl) {
      fetchVideoMeta(videoUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta }) : task)));
      });
    } else if (cardType === 'map' && mapUrl) {
      fetchMapMeta(mapUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta }) : task)));
      });
    }
  };
  const saveTask = () => {
    const rawText = inputText.trim();
    if (!rawText) return;

    const resolvedSectionId = activeChip === 'now' ? currentBlock : activeChip;
    const cardType = detectCardType(rawText);
    const videoUrl = cardType === 'video' ? extractVideoUrl(rawText) : null;
    const mapUrl = cardType === 'map' ? extractMapUrl(rawText) : null;
    const taskId = Date.now();

    const nextTask = normalizeTask({
      id: taskId,
      text: rawText,
      completed: false,
      timeOfDay: sectionIdToMobileId(resolvedSectionId),
      dateString: dateKey(selectedDate),
      cardType,
      videoUrl,
      mapUrl,
      videoTitle: null,
      videoPlatform: null,
      mapTitle: null,
      mapSubtitle: null,
      redirectUrl: null,
    });

    setTasks((prev) => [...prev, nextTask]);

    setInputText('');
    setPanelOpen(false);
    applyAsyncMetadata(taskId, cardType, videoUrl, mapUrl);
  };
  const openTaskEditor = (task) => {
    setProfileOpen(false);
    setPanelOpen(false);
    setSelectedDate(parseSharedSelectedDate(task.dateString) || selectedDate);
    setEditingTaskId(task.id);
    setEditText(task.text || '');
  };
  const handleEditSave = () => {
    const rawText = editText.trim();
    if (!editingTask || !rawText) return;

    setTasks((prev) => prev.map((task) => (
      task.id === editingTask.id
        ? normalizeTask({ ...task, text: rawText })
        : task
    )));
    closeEditModal();
  };
  const toggleTask = (taskId) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, completed: !task.completed }) : task)));
  };
  const handleTaskClick = (task) => {
    if (suppressTaskClickRef.current === task.id) {
      suppressTaskClickRef.current = null;
      return;
    }
    const { redirectUrl, isPlain } = getTaskCardPresentation(task);
    if (isPlain) {
      openTaskEditor(task);
      return;
    }
    if (redirectUrl) {
      window.open(redirectUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    toggleTask(task.id);
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
      <GlobalStyles />
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#fffdfb', color: '#111', fontFamily: 'Inter, sans-serif' }}>
        <header style={{ height: 74, padding: '0 38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fbf9f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <h1 style={{ margin: 0, fontFamily: 'DM Serif Display, serif', fontSize: 28, fontStyle: 'italic', lineHeight: 1 }}>{panelLabel(selectedDate)}</h1>
            {!todaySelected ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(logicalToday);
                  setProfileOpen(false);
                }}
                aria-label="Back to Today"
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: '1px solid #ddd6cf',
                  background: '#f4f1ed',
                  color: '#a63024',
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
                <span>Today</span>
              </button>
            ) : null}
            {todaySelected ? <Clock /> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            <button type="button" className="desktop-profile-trigger" onClick={() => setProfileOpen(true)} style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #ddd6cf', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, overflow: 'hidden' }}>
              {userProfile.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt={userProfile.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18, color: '#111' }}>{userProfile.initial}</span>
              )}
            </button>
          </div>
        </header>

        <div style={{ display: 'flex', height: 'calc(100vh - 74px)' }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #fbf9f6 0%, #fbf9f6 52px, #fffdfb 52px, #fffdfb 100%)' }}>
            <WeekStrip selectedDate={selectedDate} logicalToday={logicalToday} onSelect={(date) => { setSelectedDate(date); setProfileOpen(false); }} />
            <main ref={mainScrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#fffdfb' }}>
              {sections.map((section) => (
                <ScheduleSection
                  key={section.id}
                  section={section}
                  tasks={selectedTasks.filter((task) => task.timeOfDay === section.mobileId)}
                  showMarker={todaySelected && currentBlock === section.id}
                  onTaskClick={handleTaskClick}
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
          <AddPanel open={panelOpen} selectedDate={selectedDate} chipsToShow={visibleChips} activeChip={activeChip} setActiveChip={setActiveChip} inputText={inputText} setInputText={setInputText} onClose={closePanel} onSubmit={saveTask} onSelectDate={setSelectedDate} />
        </div>

        {!panelOpen ? <button type="button" onClick={() => { setProfileOpen(false); closeEditModal(); setActiveChip(visibleChips[0]?.id || 'now'); setInputText(''); setPanelOpen(true); }} aria-label="Add task" style={{ position: 'fixed', right: 42, bottom: 30, width: 50, height: 50, borderRadius: '50%', border: '1px solid #d9d1c8', background: '#fffefc', color: '#111', boxShadow: '0 14px 30px rgba(28,17,8,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 20 }}><PlusIcon /></button> : null}

        {editingTask ? (
          <div
            role="presentation"
            onClick={closeEditModal}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(17, 17, 17, 0.34)',
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
                background: '#fffdfb',
                border: '1px solid rgba(99, 77, 52, 0.08)',
                borderRadius: 24,
                boxShadow: '0 24px 60px rgba(26, 20, 12, 0.18)',
                display: 'grid',
                gridTemplateRows: 'auto minmax(0, 1fr) auto',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '22px 24px 16px', borderBottom: '1px solid rgba(99, 77, 52, 0.08)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <IntoDayLogo
                    showWordmark={false}
                    className="desktop-edit-modal-logo"
                    iconClassName="desktop-edit-modal-logo-icon"
                  />
                  <h2 id="desktop-edit-modal-title" style={{ margin: 0, fontFamily: 'DM Serif Display, serif', fontSize: 28, fontStyle: 'italic', lineHeight: 1, color: '#1f1a14' }}>
                    Edit Task
                  </h2>
                </div>
                <button type="button" onClick={closeEditModal} aria-label="Close edit modal" style={{ width: 32, height: 32, borderRadius: '50%', background: '#f4f1ec', border: '1px solid rgba(99, 77, 52, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, color: '#3a3026' }}>
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
                  placeholder="Edit task..."
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: 280,
                    border: '1px solid rgba(99, 77, 52, 0.1)',
                    background: '#fff',
                    borderRadius: 18,
                    padding: 18,
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: '#16120d',
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 24px 24px', borderTop: '1px solid rgba(99, 77, 52, 0.08)' }}>
                <button type="button" onClick={closeEditModal} style={{ minWidth: 96, height: 44, padding: '0 18px', borderRadius: 14, border: '1px solid rgba(99, 77, 52, 0.12)', background: '#f5f1ec', color: '#2b241d', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleEditSave} disabled={!canSaveEdit} style={{ minWidth: 136, height: 44, padding: '0 20px', background: canSaveEdit ? '#17120d' : '#b8afa5', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 600, cursor: canSaveEdit ? 'pointer' : 'not-allowed' }}>
                  Save
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
        <DragOverlayCard task={draggedTask} rect={desktopDragOverlayRectRef.current} />
      </div>
    </>
  );
}

export default App;
