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

const LONG_PRESS_MS = 500;

const HistoryTaskItem = ({ task, appearance, labels, onClick, onLongPress, selectionMode, isSelected }) => {
  const { cfg, displayTitle } = getTaskCardPresentation(task, labels);
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';

  const longPressTimer = useRef(null);
  const didLongPress = useRef(false);
  const isMouseDown = useRef(false);

  const handleMouseDown = useCallback(() => {
    didLongPress.current = false;
    isMouseDown.current = true;
    longPressTimer.current = setTimeout(() => {
      if (isMouseDown.current) {
        didLongPress.current = true;
        onLongPress(task);
      }
    }, LONG_PRESS_MS);
  }, [onLongPress, task]);

  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleMouseLeave = useCallback(() => {
    isMouseDown.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleClick = useCallback(() => {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    onClick(task);
  }, [onClick, task]);

  // Touch support for desktop too (touchscreen laptops etc.)
  const handleTouchStart = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress(task);
    }, LONG_PRESS_MS);
  }, [onLongPress, task]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const selectedBg = appearance === 'dark' ? 'rgba(91,138,245,0.12)' : 'rgba(74,124,247,0.07)';
  const hoverBg = appearance === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = hoverBg;
      }}
      onMouseOut={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
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

const DesktopHistoryModal = ({ open, tasks, appearance, language, t, onClose, onTaskClick, onMoveSelected }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [movePanelOpen, setMovePanelOpen] = useState(false);
  const dateInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectionMode) {
          setSelectionMode(false);
          setSelectedIds(new Set());
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, selectionMode]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!open) {
      setSelectionMode(false);
      setSelectedIds(new Set());
      setSearchQuery('');
      setMovePanelOpen(false);
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
    setMovePanelOpen(false);
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
  const accentColor = isDark ? '#5B8AF5' : '#4A7CF7';
  const mutedColor = 'var(--desktop-muted)';

  return (
    <>
      <div
        role="presentation"
        onClick={selectionMode ? undefined : onClose}
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
            background: isDark ? '#1C1C1E' : '#FFFFFF',
            border: `1px solid ${isDark ? '#333' : '#E5E5E5'}`,
            borderRadius: 24,
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
            padding: '16px 16px 8px',
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
                    fontSize: 14,
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
                  fontSize: 14,
                  fontWeight: 600,
                  color: isDark ? '#FFF' : '#111',
                }}>
                  {selectedIds.size === 0
                    ? (t.selectItems || 'Select items')
                    : `${selectedIds.size} ${t.selected || 'selected'}`}
                </div>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setMovePanelOpen((prev) => !prev)}
                    disabled={selectedIds.size === 0}
                    style={{
                      background: movePanelOpen ? (isDark ? '#333' : '#E8EEFF') : 'none',
                      border: 'none',
                      borderRadius: 6,
                      color: selectedIds.size === 0 ? 'var(--desktop-muted)' : accentColor,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: selectedIds.size === 0 ? 'default' : 'pointer',
                      padding: '6px 10px',
                      flexShrink: 0,
                      transition: 'all 0.15s',
                    }}
                  >
                    {t.move || 'Move'}
                  </button>

                  {movePanelOpen && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                        onClick={() => setMovePanelOpen(false)}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          right: 0,
                          width: 160,
                          background: isDark ? '#2C2C2E' : '#FFF',
                          border: `1px solid ${isDark ? '#444' : '#E5E5E5'}`,
                          borderRadius: 12,
                          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.08)',
                          zIndex: 100,
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
                            background: 'transparent', border: 'none', textAlign: 'left',
                            padding: '8px 12px', fontSize: 13, borderRadius: 6,
                            color: 'var(--desktop-root-text)', cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.target.style.background = isDark ? '#3A3A3C' : '#F5F5F5'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          {t.today || 'Today'}
                        </button>
                        <button
                          type="button"
                          className="desktop-move-option"
                          onClick={() => handleMoveToDate(tomorrowKey)}
                          style={{
                            background: 'transparent', border: 'none', textAlign: 'left',
                            padding: '8px 12px', fontSize: 13, borderRadius: 6,
                            color: 'var(--desktop-root-text)', cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.target.style.background = isDark ? '#3A3A3C' : '#F5F5F5'}
                          onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                          {t.tomorrow || 'Tomorrow'}
                        </button>
                        <div style={{ height: 1, background: isDark ? '#444' : '#F0F0F0', margin: '4px 8px' }} />
                        
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            className="desktop-move-option"
                            onClick={() => dateInputRef.current?.showPicker?.()}
                            style={{
                              width: '100%',
                              background: 'transparent', border: 'none', textAlign: 'left',
                              padding: '8px 12px', fontSize: 13, borderRadius: 6,
                              color: 'var(--desktop-root-text)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}
                            onMouseEnter={(e) => e.target.style.background = isDark ? '#3A3A3C' : '#F5F5F5'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                          >
                            <span>{t.pickDate || 'Pick a date...'}</span>
                          </button>
                          <input
                            ref={dateInputRef}
                            type="date"
                            style={{
                              position: 'absolute', opacity: 0, width: 0, height: 0, bottom: 0, right: 0, pointerEvents: 'none'
                            }}
                            onChange={(e) => {
                              if (e.target.value) handleMoveToDate(e.target.value);
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
                    color: mutedColor,
                    cursor: 'pointer',
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
        </div>
      </div>
    </>
  );
};

export default DesktopHistoryModal;
