import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { getLogicalToday } from '../lib/dateHelpers';
import { getTaskCardPresentation, normalizeCardType } from '../taskCardUtils';
import { format, isSameDay, addDays } from 'date-fns';

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const CloseIcon = ({ isDark }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 22 22" fill="none">
    <path fillRule="evenodd" clipRule="evenodd" d="M5.01417 5.01423C5.14308 4.88548 5.31782 4.81316 5.50001 4.81316C5.68219 4.81316 5.85693 4.88548 5.98584 5.01423L11 10.0284L16.0142 5.01423C16.0771 4.94668 16.153 4.8925 16.2373 4.85493C16.3217 4.81735 16.4127 4.79715 16.505 4.79552C16.5973 4.79389 16.689 4.81087 16.7746 4.84545C16.8602 4.88002 16.938 4.93149 17.0033 4.99677C17.0686 5.06206 17.12 5.13982 17.1546 5.22543C17.1892 5.31103 17.2062 5.40273 17.2045 5.49504C17.2029 5.58735 17.1827 5.67839 17.1451 5.76272C17.1076 5.84705 17.0534 5.92295 16.9858 5.98589L11.9717 11.0001L16.9858 16.0142C17.0534 16.0772 17.1076 16.1531 17.1451 16.2374C17.1827 16.3217 17.2029 16.4128 17.2045 16.5051C17.2062 16.5974 17.1892 16.6891 17.1546 16.7747C17.12 16.8603 17.0686 16.9381 17.0033 17.0033C16.938 17.0686 16.8602 17.1201 16.7746 17.1547C16.689 17.1892 16.5973 17.2062 16.505 17.2046C16.4127 17.203 16.3217 17.1828 16.2373 17.1452C16.153 17.1076 16.0771 17.0534 16.0142 16.9859L11 11.9717L5.98584 16.9859C5.85551 17.1073 5.68314 17.1734 5.50503 17.1703C5.32692 17.1672 5.15698 17.095 5.03102 16.969C4.90506 16.8431 4.8329 16.6731 4.8329 16.495C4.82662 16.3169 4.89273 16.1446 5.01417 16.0142L10.0283 11.0001L5.01417 5.98589C4.88543 5.85699 4.81311 5.68225 4.81311 5.50006C4.81311 5.31787 4.88543 5.14313 5.01417 5.01423Z" fill={isDark ? "white" : "black"} />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

const CheckboxIcon = ({ checked, appearance }) => (
  <div style={{
    width: 20,
    height: 20,
    borderRadius: 6,
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
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
    <div style={{ fontSize: 13, color: 'var(--mobile-muted, #737373)', marginTop: 13.5, marginBottom: 8, paddingLeft: 12, fontWeight: 500 }}>
      {labelKey}
    </div>
  );
};

const LONG_PRESS_MS = 500;

const HistoryTaskItem = ({ task, appearance, labels, onClick, onLongPress, selectionMode, isSelected }) => {
  const { cfg, displayTitle } = getTaskCardPresentation(task, labels);
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';

  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);

  const handleTouchStart = useCallback((e) => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress(task);
    }, LONG_PRESS_MS);
  }, [onLongPress, task]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleClick = useCallback(() => {
    if (didLongPress.current) return; // swallow click after long-press
    onClick(task);
  }, [didLongPress, onClick, task]);

  const selectedBg = appearance === 'dark' ? 'rgba(91,138,245,0.12)' : 'rgba(74,124,247,0.07)';

  return (
    <button
      type="button"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 12px',
        background: isSelected ? selectedBg : 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.15s ease',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {selectionMode && (
        <CheckboxIcon checked={isSelected} appearance={appearance} />
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
        color: appearance === 'dark' ? '#FFF' : '#111',
        fontSize: 15,
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

const MobileHistoryModal = ({ open, tasks, appearance, language, t, onClose, onTaskClick, onMoveSelected, onDeleteSelected }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isPickingCustomDate, setIsPickingCustomDate] = useState(false);
  const [calPickerDate, setCalPickerDate] = useState(() => getLogicalToday());
  const [isTrashPressed, setIsTrashPressed] = useState(false);
  const dateInputRef = useRef(null);

  // Prevent background scroll when modal is active
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [open]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!open) {
      setSelectionMode(false);
      setSelectedIds(new Set());
      setSearchQuery('');
      setMoveSheetOpen(false);
      setIsPickingCustomDate(false);
    }
  }, [open]);

  const handleLongPress = useCallback((task) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds(new Set([task.id]));
    }
  }, [selectionMode]);

  const handleToggleSelect = useCallback((task) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(task.id)) {
        next.delete(task.id);
      } else {
        next.add(task.id);
      }
      return next;
    });
  }, []);

  const handleTaskClick = useCallback((task) => {
    if (selectionMode) {
      handleToggleSelect(task);
    } else {
      onTaskClick(task);
      onClose();
    }
  }, [selectionMode, handleToggleSelect, onTaskClick, onClose]);

  const handleCancel = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setMoveSheetOpen(false);
  };

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
  const mutedColor = isDark ? '#777' : '#999';
  const accentColor = isDark ? '#5B8AF5' : '#4A7CF7';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: isDark ? '#121212' : '#FDFDFD',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{
        paddingTop: 'max(env(safe-area-inset-top, 48px), 24px)',
        background: isDark ? '#121212' : '#FDFDFD',
        borderBottom: `1px solid ${isDark ? '#333' : '#F0F0F0'}`,
        zIndex: 10,
      }}>
        {selectionMode ? (
          /* Selection Action Bar - One row */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
          }}>
            <div style={{
              flex: 1,
              fontSize: 16,
              fontWeight: 600,
              color: isDark ? '#FFF' : '#111',
            }}>
              {selectedIds.size === 0
                ? (t.selectTasks || 'Select tasks')
                : `${selectedIds.size} ${t.selected || 'selected'}`}
            </div>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                width: 31,
                height: 31,
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
              <CloseIcon isDark={isDark} />
            </button>
          </div>
        ) : (
          /* Normal Search Bar - Single Row */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
          }}>
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
                  height: 42,
                  padding: '0 16px 0 38px',
                  borderRadius: 999,
                  border: 'none',
                  background: isDark ? '#2C2C2E' : '#F0F0F0',
                  color: isDark ? '#FFF' : '#111',
                  fontSize: 16,
                  outline: 'none',
                }}
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 31,
                height: 31,
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
              <CloseIcon isDark={isDark} />
            </button>
          </div>
        )}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px', minHeight: 0, position: 'relative' }}>
        {!selectionMode && groupKeys.length > 0 && (
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '8.5px 16px',
            pointerEvents: 'none',
          }}>
            <button
              type="button"
              onClick={() => setSelectionMode(true)}
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                borderRadius: 25,
                color: isDark ? '#CCC' : '#666',
                fontSize: 17.5,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '7.5px 17.5px',
                pointerEvents: 'auto',
                transition: 'background-color 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {t.select || 'Select'}
            </button>
          </div>
        )}
        {groupKeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: mutedColor, fontSize: 15 }}>
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
                    onLongPress={handleLongPress}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(task.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete and Move Action Bar */}
      {selectionMode && selectedIds.size > 0 && !moveSheetOpen && (
        <div style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: isDark ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderTop: `1px solid ${isDark ? '#333' : '#E5E5E5'}`,
          padding: '12px 24px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 100,
        }}>
          <button
            type="button"
            onClick={() => setMoveSheetOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: accentColor,
              fontSize: '17.6px',
              marginLeft: 3,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 4px',
            }}
          >
            {t.move || 'Move'}
          </button>
          <button
            type="button"
            onPointerDown={() => setIsTrashPressed(true)}
            onPointerUp={() => setIsTrashPressed(false)}
            onPointerLeave={() => setIsTrashPressed(false)}
            onClick={() => setDeleteConfirmOpen(true)}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              marginRight: 3,
              background: isTrashPressed 
                ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') 
                : 'transparent',
              border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.08)',
              color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.65)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'background 0.15s ease',
            }}
            aria-label={t.delete || 'Delete'}
          >
            <TrashIcon />
          </button>
        </div>
      )}

      {/* Move Bottom Sheet */}
      {selectionMode && moveSheetOpen && (
        <>
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1001,
              background: 'rgba(0,0,0,0.4)',
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={() => setMoveSheetOpen(false)}
          />
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1002,
              background: isDark ? '#1C1C1E' : '#FFF',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: '24px 16px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
              display: 'flex', flexDirection: 'column', gap: 8,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ width: 40, height: 4, background: isDark ? '#444' : '#E0E0E0', borderRadius: 2, margin: '0 auto 16px' }} />
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: isDark ? '#FFF' : '#111' }}>
                {t.moveSelected || 'Move Selected Tasks'}
              </h3>
            </div>
            
            {!isPickingCustomDate ? (
              <>
                <button
                  type="button"
                  onClick={() => handleMoveToDate(todayKey)}
                  style={{
                    background: isDark ? '#2C2C2E' : '#F5F5F7', border: 'none',
                    padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 500,
                    color: isDark ? '#FFF' : '#111', textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  {t.today || 'Today'}
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveToDate(tomorrowKey)}
                  style={{
                    background: isDark ? '#2C2C2E' : '#F5F5F7', border: 'none',
                    padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 500,
                    color: isDark ? '#FFF' : '#111', textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  {t.tomorrow || 'Tomorrow'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPickingCustomDate(true)}
                  style={{
                    width: '100%',
                    background: isDark ? '#2C2C2E' : '#F5F5F7', border: 'none',
                    padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 500,
                    color: isDark ? '#FFF' : '#111', textAlign: 'center', cursor: 'pointer',
                  }}
                >
                  {t.pickDate || 'Pick a date...'}
                </button>
              </>
            ) : (
              <div className="sheet-calendar-picker open" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                <div className="cal-picker-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button 
                    className="cal-nav-btn" 
                    onClick={() => setCalPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })}
                    style={{ background: 'none', border: 'none', color: isDark ? '#FFF' : '#111', padding: 8 }}
                  >
                    <svg width="9" height="14" viewBox="0 0 9 14" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M0.219809 7.45072C0.0790625 7.33113 0 7.16902 0 7C0 6.83098 0.0790625 6.66887 0.219809 6.54928L7.73599 0.171181C7.87847 0.0585185 8.06692 -0.00281603 8.26164 9.93682e-05C8.45636 0.00301477 8.64215 0.0699525 8.77986 0.18681C8.91757 0.303668 8.99645 0.461322 8.99988 0.626558C9.00332 0.791795 8.93104 0.951712 8.79827 1.07262L1.81324 7L8.79827 12.9274C8.93104 13.0483 9.00332 13.2082 8.99988 13.3734C8.99645 13.5387 8.91757 13.6963 8.77986 13.8132C8.64215 13.93 8.45636 13.997 8.26164 13.9999C8.06692 14.0028 7.87847 13.9415 7.73599 13.8288L0.219809 7.45072Z" fill="currentColor" /></svg>
                  </button>
                  <span 
                    className="cal-picker-month-label"
                    style={{ 
                      fontFamily: '"LTC Bodoni 175", var(--font-serif)',
                      fontStyle: 'italic',
                      fontSize: '24px',
                      color: isDark ? '#FFF' : '#000',
                      textTransform: 'lowercase'
                    }}
                  >
                    {format(calPickerDate, 'yyyy eee MMM').toLowerCase()}
                  </span>
                  <button 
                    className="cal-nav-btn" 
                    onClick={() => setCalPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })}
                    style={{ background: 'none', border: 'none', color: isDark ? '#FFF' : '#111', padding: 8 }}
                  >
                    <svg width="9" height="14" viewBox="0 0 9 14" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="currentColor" /></svg>
                  </button>
                </div>
                <div 
                  className="cal-picker-grid" 
                  style={{ 
                    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' 
                  }}
                >
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="cal-picker-dow" style={{ fontSize: 12, fontWeight: 600, color: mutedColor, padding: '4px 0' }}>{d}</div>
                  ))}
                  {Array.from({ length: new Date(calPickerDate.getFullYear(), calPickerDate.getMonth(), 1).getDay() }).map((_, i) => (
                    <div key={`e${i}`} />
                  ))}
                  {(() => {
                    const today = getLogicalToday();
                    const year = calPickerDate.getFullYear();
                    const month = calPickerDate.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    return Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const cellDate = new Date(year, month, day);
                      const isToday = isSameDay(cellDate, today);
                      return (
                        <button
                          key={day}
                          className="cal-picker-day"
                          onClick={() => handleMoveToDate(dateKey(cellDate))}
                          style={{
                            aspectRatio: '1', borderRadius: '50%', border: 'none', background: 'transparent',
                            fontSize: 15, fontWeight: isToday ? 700 : 500,
                            color: isToday ? '#ED1F1F' : (isDark ? '#FFF' : '#111'),
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: isToday ? '1.5px solid #ED1F1F' : 'none'
                          }}
                        >
                          {day}
                        </button>
                      );
                    });
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickingCustomDate(false)}
                  style={{
                    width: '100%', marginTop: 12, background: 'none', border: 'none',
                    color: accentColor, fontSize: 14, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  {t.cancel || 'Cancel'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Sheet */}
      {selectionMode && deleteConfirmOpen && (
        <>
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1001,
              background: 'rgba(0,0,0,0.4)',
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={() => setDeleteConfirmOpen(false)}
          />
          <div
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1002,
              background: isDark ? '#1C1C1E' : '#FFF',
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: '24px 16px',
              paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
              display: 'flex', flexDirection: 'column', gap: 20,
              boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <h2 style={{
                margin: '0 0 4px 0',
                fontSize: 19,
                fontWeight: 600,
                color: isDark ? '#FFF' : '#111'
              }}>
                {`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'item' : 'items'}?`}
              </h2>
              <p style={{
                margin: 0,
                fontSize: 14,
                color: isDark ? '#A0A0A0' : '#666'
              }}>
                This will remove it from your list
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSelected) onDeleteSelected(selectedIds);
                  setDeleteConfirmOpen(false);
                  handleCancel();
                }}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 14,
                  background: '#FF3B30',
                  border: 'none',
                  color: '#FFF',
                  fontSize: 17,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderRadius: 14,
                  background: isDark ? '#2C2C2E' : '#F2F2F7',
                  border: 'none',
                  color: isDark ? '#FFF' : '#111',
                  fontSize: 17,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MobileHistoryModal;
