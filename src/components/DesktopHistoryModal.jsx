import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { getLogicalToday } from '../lib/dateHelpers';

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
import { getTaskCardPresentation, normalizeCardType } from '../taskCardUtils';

const getCalendarWeekdayLabels = (language) => {
  if (language === 'ZH') return ['日', '一', '二', '三', '四', '五', '六'];
  if (language === 'JA') return ['日', '月', '火', '水', '木', '金', '土'];
  if (language === 'MS') return ['AH', 'IS', 'SE', 'RA', 'KH', 'JU', 'SA'];
  if (language === 'TH') return ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
};

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="15" height="15">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const CheckboxIcon = ({ checked, appearance }) => (
  <div style={{
    width: 18,
    height: 18,
    borderRadius: 5,
    border: checked
      ? 'none'
      : `2px solid ${appearance === 'dark' ? '#555' : '#CCC'}`,
    background: checked
      ? (appearance === 'dark' ? '#5B8AF5' : '#4A7CF7')
      : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  }}>
    {checked && (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )}
  </div>
);

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftDateByDays = (date, dayOffset) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
};

const GroupedDateLabel = ({ labelKey }) => {
  return (
    <div style={{ fontSize: 13, color: 'var(--desktop-muted)', marginTop: 16, marginBottom: 8, paddingLeft: 12, fontWeight: 500 }}>
      {labelKey}
    </div>
  );
};



const HistoryTaskItem = ({ task, appearance, labels, onClick, onToggleSelect, selectionMode, isSelected }) => {
  const { cfg, displayTitle } = getTaskCardPresentation(task, labels);
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';

  const handleClick = useCallback(() => {
    onClick(task);
  }, [onClick, task]);

  const selectedBg = appearance === 'dark' ? 'rgba(91,138,245,0.12)' : 'rgba(74,124,247,0.07)';
  const hoverBg = appearance === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseLeave={(e) => {
        setIsHovered(false);
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
      onMouseEnter={(e) => {
        setIsHovered(true);
        if (!isSelected) e.currentTarget.style.background = hoverBg;
      }}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: isSelected ? selectedBg : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s ease',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {(selectionMode || isHovered) && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(task.id);
          }}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <CheckboxIcon checked={isSelected} appearance={appearance} />
        </div>
      )}
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
      <div style={{
        flex: 1,
        minWidth: 0,
        color: 'var(--desktop-root-text)',
        fontSize: 14,
        fontWeight: isSelected ? 600 : 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        transition: 'font-weight 0.15s ease',
      }}>
        {displayTitle}
      </div>
    </button>
  );
};

const CalendarPopover = ({ open, anchorRef, language, onClose, onSelectDate, appearance }) => {
  const [calendarOffset, setCalendarOffset] = useState(0);

  if (!open || !anchorRef.current) return null;

  const logicalToday = getLogicalToday();
  const maxDate = new Date(logicalToday);
  maxDate.setDate(maxDate.getDate() + 30);

  const calendarMonth = new Date(logicalToday.getFullYear(), logicalToday.getMonth() + calendarOffset, 1);
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const localeMap = { 'ZH': 'zh-CN', 'JA': 'ja-JP', 'MS': 'ms-MY', 'TH': 'th-TH', 'EN': 'en-US' };
  const locale = localeMap[language] || 'en-US';
  const monthLabel = monthStart.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  const startOffset = monthStart.getDay();
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const trailingCells = Math.max(0, 42 - startOffset - daysInMonth);

  const isAtMinMonth = monthStart.getFullYear() === logicalToday.getFullYear() && monthStart.getMonth() === logicalToday.getMonth();
  const isAtMaxMonth = monthStart.getFullYear() === maxDate.getFullYear() && monthStart.getMonth() === maxDate.getMonth();

  const desktopCalendarCellSize = 30;
  const desktopCalendarGap = 4;
  const calendarWeekdayLabels = getCalendarWeekdayLabels(language);
  const isDark = appearance === 'dark';

  const anchorRect = anchorRef.current.getBoundingClientRect();
  const popoverTop = anchorRect.bottom + 4;
  const popoverRight = window.innerWidth - anchorRect.right;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={onClose} />
      <div style={{
        position: 'fixed',
        top: popoverTop,
        right: popoverRight,
        width: 260,
        background: isDark ? '#2C2C2E' : '#FFF',
        border: `1px solid ${isDark ? '#444' : '#E5E5E5'}`,
        borderRadius: 11,
        boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)',
        zIndex: 1000,
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button type="button" disabled={isAtMinMonth} onClick={() => setCalendarOffset((prev) => prev - 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: isDark ? '#3A3A3C' : '#F5F5F5', color: isAtMinMonth ? (isDark ? '#555' : '#CCC') : (isDark ? '#FFF' : '#111'), cursor: isAtMinMonth ? 'default' : 'pointer' }}>
            {'<'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#FFF' : '#111' }}>{monthLabel}</span>
          <button type="button" disabled={isAtMaxMonth} onClick={() => setCalendarOffset((prev) => prev + 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: isDark ? '#3A3A3C' : '#F5F5F5', color: isAtMaxMonth ? (isDark ? '#555' : '#CCC') : (isDark ? '#FFF' : '#111'), cursor: isAtMaxMonth ? 'default' : 'pointer' }}>
            {'>'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${desktopCalendarCellSize}px)`, gap: desktopCalendarGap, justifyContent: 'center' }}>
          {calendarWeekdayLabels.map((label, index) => (
            <div key={`${label}-${index}`} style={{ textTransform: 'uppercase', textAlign: 'center', fontSize: 11, fontWeight: 700, color: isDark ? '#777' : '#999', marginBottom: 4 }}>{label}</div>
          ))}
          {Array.from({ length: startOffset }).map((_, index) => <div key={`empty-${index}`} />)}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const cellDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
            const inRange = cellDate >= logicalToday && cellDate <= maxDate;
            const today = sameDay(cellDate, logicalToday);
            return (
              <button
                key={day}
                type="button"
                disabled={!inRange}
                onClick={() => {
                  if (!inRange) return;
                  onSelectDate(dateKey(cellDate));
                }}
                style={{
                  width: desktopCalendarCellSize,
                  height: desktopCalendarCellSize,
                  borderRadius: '50%',
                  border: today ? `1.5px solid ${isDark ? '#FF453A' : '#FF3B30'}` : 'none',
                  background: 'transparent',
                  color: inRange ? (isDark ? '#FFF' : '#111') : (isDark ? '#555' : '#CCC'),
                  fontSize: 13,
                  fontWeight: today ? 700 : 500,
                  cursor: inRange ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                onMouseEnter={(e) => { if (inRange) e.target.style.background = isDark ? '#3A3A3C' : '#F5F5F5'; }}
                onMouseLeave={(e) => { if (inRange) e.target.style.background = 'transparent'; }}
              >
                {day}
              </button>
            );
          })}
          {Array.from({ length: trailingCells }).map((_, index) => <div key={`trail-${index}`} />)}
        </div>
      </div >
    </>
  );
};

const DesktopHistoryModal = ({ open, tasks, appearance, language, t, onClose, onTaskClick, onMoveSelected, onDeleteSelected }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [movePanelOpen, setMovePanelOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const moveButtonRef = useRef(null);
  const closeTopLayerOrModal = useCallback(() => {
    if (calendarOpen) {
      setCalendarOpen(false);
      return;
    }

    if (movePanelOpen) {
      setMovePanelOpen(false);
      return;
    }

    onClose?.();
  }, [calendarOpen, movePanelOpen, onClose]);
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeTopLayerOrModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeTopLayerOrModal]);
  // Reset selection when modal closes
  useEffect(() => {
    if (!open) {
      setSelectionMode(false);
      setSelectedIds(new Set());
      setSearchQuery('');
      setMovePanelOpen(false);
      setCalendarOpen(false);
    }
  }, [open]);

  const handleCancel = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setMovePanelOpen(false);
    setCalendarOpen(false);
  };

  const handleDeleteSelected = () => {
    if (onDeleteSelected) {
      onDeleteSelected(selectedIds);
    }
    handleCancel();
  };

  const handleToggleSelect = useCallback((taskId) => {
    setSelectionMode(true);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleTaskClick = useCallback((task) => {
    if (selectionMode) {
      handleToggleSelect(task.id);
    } else {
      onTaskClick(task);
      onClose();
    }
  }, [selectionMode, handleToggleSelect, onTaskClick, onClose]);

  const handleMoveToDate = (targetDateStr) => {
    if (onMoveSelected) {
      onMoveSelected(selectedIds, targetDateStr);
    }
    handleCancel();
  };

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

    const [year, month, day] = dateStr.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, Number(day));

    if (isNaN(dateObj.getTime())) return dateStr;

    const locale = language === 'ZH' ? 'zh-CN' : 'en-US';
    return dateObj.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const groupKeys = Object.keys(groupedTasks).sort((a, b) => b.localeCompare(a));

  if (!open) return null;

  const isDark = appearance === 'dark';
  const accentColor = isDark ? '#5B8AF5' : '#4A7CF7';
  const mutedColor = 'var(--desktop-muted)';

  return (
    <>
      <div
        role="presentation"
        onClick={closeTopLayerOrModal}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 90,
          background: 'transparent',
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
            background: isDark ? '#1C1C1E' : '#FFFFFF',
            border: `1px solid ${isDark ? '#333' : '#E5E5E5'}`,
            borderRadius: 11,
            boxShadow: isDark ? '0 10px 40px rgba(0,0,0,0.5)' : '0 10px 40px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${isDark ? '#333' : '#F0F0F0'}`,
          }}>
            {selectionMode ? (
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                  {/* Left: Delete */}
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                    {selectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteSelected}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#FF3B30',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '6px 0',
                          flexShrink: 0,
                          transition: 'color 0.15s ease',
                        }}
                      >
                        {t.delete || 'Delete'}
                      </button>
                    )}
                  </div>

                  {/* Center: Count */}
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: isDark ? '#FFF' : '#111',
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                  }}>
                    {selectedIds.size === 0
                      ? (t.selectTasks || 'Select tasks')
                      : `${selectedIds.size} ${t.selected || 'selected'}`}
                  </div>

                  {/* Right: Move & X */}
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                    {selectedIds.size > 0 && (
                      <div 
                        onMouseEnter={() => setMovePanelOpen(true)}
                        onMouseLeave={() => setMovePanelOpen(false)}
                        style={{ position: 'relative' }}
                      >
                        <button
                          ref={moveButtonRef}
                          type="button"
                          style={{
                            background: movePanelOpen ? (isDark ? '#333' : '#E8EEFF') : 'none',
                            border: 'none',
                            borderRadius: 6,
                            color: accentColor,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '6px 10px',
                            flexShrink: 0,
                            transition: 'all 0.15s',
                          }}
                        >
                          {t.move || 'Move'}
                        </button>
                        {movePanelOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              paddingTop: 4,
                              zIndex: 100,
                            }}
                          >
                            <div
                              style={{
                                width: 160,
                                background: isDark ? '#2C2C2E' : '#FFF',
                                border: `1px solid ${isDark ? '#444' : '#E5E5E5'}`,
                                borderRadius: 9,
                                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: 6,
                              }}
                            >
                              <button
                                type="button"
                                className="desktop-move-option"
                                onClick={() => handleMoveToDate(todayKey)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  fontSize: 13,
                                  borderRadius: 6,
                                  color: 'var(--desktop-root-text)',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  if (isDark) e.target.style.background = '#3A3A3C';
                                  else e.target.style.background = '#F5F5F5';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.background = 'transparent';
                                }}
                              >
                                {t.today || 'Today'}
                              </button>

                              <button
                                type="button"
                                className="desktop-move-option"
                                onClick={() => handleMoveToDate(tomorrowKey)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  fontSize: 13,
                                  borderRadius: 6,
                                  color: 'var(--desktop-root-text)',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  if (isDark) e.target.style.background = '#3A3A3C';
                                  else e.target.style.background = '#F5F5F5';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.background = 'transparent';
                                }}
                              >
                                {t.tomorrow || 'Tomorrow'}
                              </button>

                              <div style={{ height: 1, background: isDark ? '#444' : '#F0F0F0', margin: '4px 8px' }} />

                              <button
                                type="button"
                                className="desktop-move-option"
                                onClick={() => {
                                  setMovePanelOpen(false);
                                  setCalendarOpen(true);
                                }}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  fontSize: 13,
                                  borderRadius: 6,
                                  color: 'var(--desktop-root-text)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                                onMouseEnter={(e) => {
                                  if (isDark) e.target.style.background = '#3A3A3C';
                                  else e.target.style.background = '#F5F5F5';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.background = 'transparent';
                                }}
                              >
                                <span>{t.pickDate || 'Pick a date...'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                        
                        <CalendarPopover
                          open={calendarOpen}
                          anchorRef={moveButtonRef}
                          language={language}
                          appearance={appearance}
                          onClose={() => setCalendarOpen(false)}
                          onSelectDate={handleMoveToDate}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCancel}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isDark ? '#2C2C2E' : 'rgba(255, 255, 255, 0.78)',
                        border: isDark ? '1px solid #333' : '1px solid #E8E1D9',
                        color: isDark ? '#FFF' : '#111',
                        boxShadow: isDark ? 'none' : '0 8px 18px rgba(28, 23, 18, 0.05)',
                        backdropFilter: isDark ? 'none' : 'blur(8px)',
                        WebkitBackdropFilter: isDark ? 'none' : 'blur(8px)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
            ) : (
              /* Normal search bar */
              <>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: 12, color: mutedColor, display: 'flex', alignItems: 'center' }}>
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
                      background: isDark ? '#2C2C2E' : '#F5F5F5',
                      color: 'var(--desktop-root-text)',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setSelectionMode(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderRadius: 6,
                    color: accentColor,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '6px 10px',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                >
                  {t.select || 'Select'}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isDark ? '#2C2C2E' : 'rgba(255, 255, 255, 0.78)',
                    border: isDark ? '1px solid #333' : '1px solid #E8E1D9',
                    color: isDark ? '#FFF' : '#111',
                    boxShadow: isDark ? 'none' : '0 8px 18px rgba(28, 23, 18, 0.05)',
                    backdropFilter: isDark ? 'none' : 'blur(8px)',
                    WebkitBackdropFilter: isDark ? 'none' : 'blur(8px)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <CloseIcon />
                </button>
              </>
            )}
          </div>

          {/* Task list */}
          <div className="desktop-history-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px', minHeight: 0, paddingRight: 4 }}>
            {groupKeys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: mutedColor, fontSize: 14 }}>
                No tasks found
              </div>
            ) : (
              groupKeys.map(dateStr => (
                <div key={dateStr}>
                  <GroupedDateLabel labelKey={getGroupLabel(dateStr)} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {groupedTasks[dateStr].map(task => (
                      <HistoryTaskItem
                        key={task.id}
                        task={task}
                        appearance={appearance}
                        labels={t}
                        onClick={handleTaskClick}
                        onToggleSelect={handleToggleSelect}
                        selectionMode={selectionMode}
                        isSelected={selectedIds.has(task.id)}
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
