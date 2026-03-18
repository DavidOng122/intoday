import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
    <div style={{ fontSize: 13, color: 'var(--mobile-muted, #737373)', marginTop: 16, marginBottom: 8, paddingLeft: 12, fontWeight: 500 }}>
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

const MobileHistoryModal = ({ open, tasks, appearance, language, t, onClose, onTaskClick, onMoveSelected }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
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
        paddingBottom: 8,
        paddingLeft: 16,
        paddingRight: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: `1px solid ${isDark ? '#333' : '#F0F0F0'}`,
      }}>
        {selectionMode ? (
          /* Selection action bar */
          <>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                background: 'none',
                border: 'none',
                color: accentColor,
                fontSize: 16,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 0',
                flexShrink: 0,
              }}
            >
              {t.cancel || 'Cancel'}
            </button>
            <div style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 15,
              fontWeight: 600,
              color: isDark ? '#FFF' : '#111',
            }}>
              {selectedIds.size === 0
                ? (t.selectItems || 'Select items')
                : `${selectedIds.size} ${t.selected || 'selected'}`}
            </div>
            <button
              type="button"
              onClick={() => setMoveSheetOpen(!moveSheetOpen)}
              disabled={selectedIds.size === 0}
              style={{
                background: moveSheetOpen ? (isDark ? '#333' : '#E8EEFF') : 'none',
                border: 'none',
                borderRadius: 8,
                color: selectedIds.size === 0 ? mutedColor : accentColor,
                fontSize: 16,
                fontWeight: 600,
                cursor: selectedIds.size === 0 ? 'default' : 'pointer',
                padding: '6px 12px',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {t.move || 'Move'}
            </button>
          </>
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
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: isDark ? '#CCC' : '#666',
                cursor: 'pointer',
              }}
            >
              <CloseIcon />
            </button>
          </>
        )}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px', minHeight: 0 }}>
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
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.()}
                style={{
                  width: '100%',
                  background: isDark ? '#2C2C2E' : '#F5F5F7', border: 'none',
                  padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 500,
                  color: isDark ? '#FFF' : '#111', textAlign: 'center', cursor: 'pointer',
                }}
              >
                {t.pickDate || 'Pick a date...'}
              </button>
              <input
                ref={dateInputRef}
                type="date"
                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, bottom: 0, right: 0, pointerEvents: 'none' }}
                onChange={(e) => {
                  if (e.target.value) handleMoveToDate(e.target.value);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MobileHistoryModal;
