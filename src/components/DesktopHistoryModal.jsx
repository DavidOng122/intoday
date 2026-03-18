import React, { useMemo, useState, useEffect } from 'react';
import { getLogicalToday } from '../lib/dateHelpers';
import { getTaskCardPresentation, normalizeCardType } from '../taskCardUtils';

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="16" height="16">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const shiftDateByDays = (date, dayOffset) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
};

const GroupedDateLabel = ({ labelKey, t }) => {
  return (
    <div style={{ fontSize: 13, color: 'var(--desktop-muted)', marginTop: 16, marginBottom: 8, paddingLeft: 12, fontWeight: 500 }}>
      {labelKey}
    </div>
  );
};

const HistoryTaskItem = ({ task, appearance, labels, onClick }) => {
  const { cfg, displayTitle } = getTaskCardPresentation(task, labels);
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';

  return (
    <button
      type="button"
      onClick={() => onClick(task)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = appearance === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ width: 24, height: 24, borderRadius: 6, background: iconBackground, border: iconBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {appearance === 'dark' && cfg.darkIconColor ? (
          <div
            style={{
              width: 14,
              height: 14,
              backgroundColor: cfg.darkIconColor,
              maskImage: `url(${cfg.icon})`,
              WebkitMaskImage: `url(${cfg.icon})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          />
        ) : (
          <img src={cfg.icon} alt={normalizeCardType(task.cardType)} style={{ width: 14, height: 14, objectFit: 'contain' }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, color: 'var(--desktop-root-text)', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {displayTitle}
      </div>
    </button>
  );
};

const DesktopHistoryModal = ({ open, tasks, appearance, language, t, onClose, onTaskClick }) => {
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const logicalToday = getLogicalToday();
  const logicalYesterday = shiftDateByDays(logicalToday, -1);
  const logicalTomorrow = shiftDateByDays(logicalToday, 1);

  const todayKey = dateKey(logicalToday);
  const yesterdayKey = dateKey(logicalYesterday);
  const tomorrowKey = dateKey(logicalTomorrow);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    let list = [...tasks];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(task => {
        const { displayTitle, displaySub } = getTaskCardPresentation(task, t);
        return displayTitle.toLowerCase().includes(q) || (displaySub && displaySub.toLowerCase().includes(q));
      });
    }

    // Sort by date descending
    list.sort((a, b) => b.dateString.localeCompare(a.dateString));

    return list;
  }, [tasks, searchQuery, t]);

  const groupedTasks = useMemo(() => {
    const groups = {};
    filteredTasks.forEach(task => {
      if (!groups[task.dateString]) {
        groups[task.dateString] = [];
      }
      groups[task.dateString].push(task);
    });
    return groups;
  }, [filteredTasks]);

  const getGroupLabel = (dateStr) => {
    if (dateStr === todayKey) return t.today || 'Today';
    if (dateStr === yesterdayKey) return t.yesterday || 'Yesterday';
    if (dateStr === tomorrowKey) return t.tomorrow || 'Tomorrow';

    // Parse dateStr (YYYY-MM-DD)
    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, Number(day));

    if (isNaN(dateObj.getTime())) return dateStr;

    // Use current locale to format nicely if not today/yesterday/tomorrow
    const locale = language === 'ZH' ? 'zh-CN' : 'en-US';
    return dateObj.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const groupKeys = Object.keys(groupedTasks).sort((a, b) => b.localeCompare(a));

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'var(--desktop-modal-backdrop)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 28,
        }}
      >
        <div
          style={{
            width: 'min(100%, 560px)',
            height: 'min(640px, calc(100vh - 56px))',
            background: appearance === 'dark' ? '#1C1C1E' : '#FFFFFF',
            border: `1px solid ${appearance === 'dark' ? '#333' : '#E5E5E5'}`,
            borderRadius: 24,
            boxShadow: appearance === 'dark' ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '16px 16px 8px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${appearance === 'dark' ? '#333' : '#F0F0F0'}` }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 12, color: 'var(--desktop-muted)', display: 'flex', alignItems: 'center' }}>
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder={t.searchChat || "Search..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 16px 0 38px',
                  borderRadius: 999,
                  border: 'none',
                  background: appearance === 'dark' ? '#2C2C2E' : '#F5F5F5',
                  color: 'var(--desktop-root-text)',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: 'var(--desktop-muted)',
                cursor: 'pointer',
              }}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="desktop-history-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px', minHeight: 0, paddingRight: 4 }}>
            {groupKeys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--desktop-muted)', fontSize: 14 }}>
                No tasks found
              </div>
            ) : (
              groupKeys.map(dateStr => (
                <div key={dateStr}>
                  <GroupedDateLabel labelKey={getGroupLabel(dateStr)} t={t} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {groupedTasks[dateStr].map(task => (
                      <HistoryTaskItem
                        key={task.id}
                        task={task}
                        appearance={appearance}
                        labels={t}
                        onClick={(t) => {
                          onTaskClick(t);
                          onClose(); // Optional: close modal on click
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DesktopHistoryModal;
