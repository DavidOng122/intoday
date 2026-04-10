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

const getPackDisplayName = (tasks) => (
  tasks.find((task) => typeof task.desktopGroupName === 'string' && task.desktopGroupName.trim())?.desktopGroupName
  || tasks[0]?.text
  || 'Untitled pack'
);

const PackSearchResultCard = ({ packInfo, appearance, labels, onClickPack, onClickItem, onResultPointerDown, onResultPointerEnd }) => {
  const isDark = appearance === 'dark';
  const packDragTask = {
    ...packInfo.tasks[0],
    groupTaskIds: packInfo.tasks.map((task) => task.id),
    groupSize: packInfo.tasks.length,
    desktopGroupName: packInfo.packTitle,
  };
  return (
    <div
      onClick={() => onClickPack(packInfo.tasks)}
      onPointerDown={(e) => onResultPointerDown?.(packDragTask, e)}
      onPointerUp={() => onResultPointerEnd?.()}
      onPointerCancel={() => onResultPointerEnd?.()}
      style={{
        background: isDark ? '#252527' : '#F9F9F9',
        border: `1px solid ${isDark ? '#333' : '#EFEFEF'}`,
        borderRadius: 12,
        padding: '14px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? '#2C2C2E' : '#F0F0F0'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? '#252527' : '#F9F9F9'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: isDark ? '#FFF' : '#111' }}>
          {packInfo.packTitle}
        </div>
        <div style={{ fontSize: 12, color: isDark ? '#777' : '#999', background: isDark ? '#1C1C1E' : '#FFF', padding: '2px 8px', borderRadius: 999 }}>
          {packInfo.matchedCount} {packInfo.matchedCount === 1 ? 'item' : 'items'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {packInfo.previews.map(task => {
          const { cfg, displayTitle, displaySub } = getTaskCardPresentation(task, labels);
          return (
            <div
              key={task.id}
              onClick={(e) => {
                e.stopPropagation();
                onClickItem(task);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onResultPointerDown?.(task, e);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                onResultPointerEnd?.();
              }}
              onPointerCancel={(e) => {
                e.stopPropagation();
                onResultPointerEnd?.();
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 6,
                background: isDark ? '#1C1C1E' : '#FFF',
                border: `1px solid ${isDark ? '#333' : '#F0F0F0'}`,
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? '#333' : '#F9F9F9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? '#1C1C1E' : '#FFF'; }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 4, background: isDark ? cfg.darkBg : cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isDark && cfg.darkIconColor ? (
                   <div style={{ width: 10, height: 10, backgroundColor: cfg.darkIconColor, maskImage: `url(${cfg.icon})`, WebkitMaskImage: `url(${cfg.icon})`, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }} />
                ) : (
                   <img src={cfg.icon} alt="icon" style={{ width: 10, height: 10, objectFit: 'contain' }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: isDark ? '#DDD' : '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayTitle}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};



const HistoryTaskItem = ({ task, appearance, labels, onClick, onResultPointerDown, onResultPointerEnd }) => {
  const { cfg, displayTitle } = getTaskCardPresentation(task, labels);
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';

  const handleClick = useCallback(() => {
    onClick(task);
  }, [onClick, task]);

  const hoverBg = appearance === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={(e) => onResultPointerDown?.(task, e)}
      onPointerUp={() => onResultPointerEnd?.()}
      onPointerCancel={() => onResultPointerEnd?.()}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg;
      }}
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
        transition: 'background 0.15s ease',
        userSelect: 'none',
        WebkitUserSelect: 'none',
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
      <div style={{
        flex: 1,
        minWidth: 0,
        color: 'var(--desktop-root-text)',
        fontSize: 14,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
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

const DesktopHistoryModal = ({ open, tasks, appearance, language, t, onClose, onTaskClick, onPackClick, onPackItemClick, onTaskPointerDown, onTaskLongPress }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const resultLongPressTimerRef = useRef(null);
  const closeTopLayerOrModal = useCallback(() => {
    onClose?.();
  }, [onClose]);
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
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      if (resultLongPressTimerRef.current) {
        clearTimeout(resultLongPressTimerRef.current);
        resultLongPressTimerRef.current = null;
      }
    }
  }, [open]);

  const clearLongPressTimer = useCallback(() => {
    if (resultLongPressTimerRef.current) {
      clearTimeout(resultLongPressTimerRef.current);
      resultLongPressTimerRef.current = null;
    }
  }, []);

  const handleResultPointerDown = useCallback((task, event) => {
    onTaskPointerDown?.(task, event);
    clearLongPressTimer();
    resultLongPressTimerRef.current = setTimeout(() => {
      onTaskLongPress?.(task);
      resultLongPressTimerRef.current = null;
    }, 500);
  }, [clearLongPressTimer, onTaskLongPress, onTaskPointerDown]);

  const handleResultPointerEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTaskClick = useCallback((task) => {
    onTaskClick(task);
    onClose?.();
  }, [onTaskClick, onClose]);

  const { matchedPacks, matchedItems } = useMemo(() => {
    if (!tasks || tasks.length === 0) return { matchedPacks: [], matchedItems: [] };

    const q = searchQuery.trim().toLowerCase();
    
    // 1. Group tasks into packs and standalone items
    const packsMap = new Map();
    const standaloneItems = [];

    tasks.forEach(task => {
      if (task.desktopGroupId) {
        if (!packsMap.has(task.desktopGroupId)) {
          packsMap.set(task.desktopGroupId, []);
        }
        packsMap.get(task.desktopGroupId).push(task);
      } else {
        standaloneItems.push(task);
      }
    });

    // 2. Evaluate Packs
    const resultPacks = [];
    packsMap.forEach((packTasks, groupId) => {
      packTasks.sort((a, b) => b.id - a.id); // newest first
      
      const packTitle = getPackDisplayName(packTasks);
      
      let matches = false;
      const matchedChildTasks = [];

      if (!q) {
        matches = true;
      } else {
        if (packTitle.toLowerCase().includes(q)) {
          matches = true;
          matchedChildTasks.push(...packTasks);
        } else {
          packTasks.forEach(pt => {
            const { displayTitle, displaySub } = getTaskCardPresentation(pt, t);
            if (displayTitle.toLowerCase().includes(q) || (displaySub && displaySub.toLowerCase().includes(q)) || pt.text.toLowerCase().includes(q)) {
              matches = true;
              matchedChildTasks.push(pt);
            }
          });
        }
      }

      if (matches) {
        const previews = q ? matchedChildTasks : packTasks;
        resultPacks.push({
          groupId,
          packTitle,
          tasks: packTasks,
          matchedCount: previews.length,
          previews: previews.slice(0, 2),
          updatedAt: Math.max(...packTasks.map(t => t.updatedAt || t.id))
        });
      }
    });

    // 3. Evaluate Standalone Items
    const resultItems = [];
    standaloneItems.forEach(item => {
      if (!q) {
        resultItems.push(item);
      } else {
        const { displayTitle, displaySub } = getTaskCardPresentation(item, t);
        if (displayTitle.toLowerCase().includes(q) || (displaySub && displaySub.toLowerCase().includes(q)) || item.text.toLowerCase().includes(q)) {
          resultItems.push(item);
        }
      }
    });

    resultPacks.sort((a, b) => b.updatedAt - a.updatedAt);
    resultItems.sort((a, b) => {
      if (a.dateString !== b.dateString) return b.dateString.localeCompare(a.dateString);
      return b.id - a.id;
    });

    return { matchedPacks: resultPacks, matchedItems: resultItems };
  }, [tasks, searchQuery, t]);

  const isEmpty = matchedPacks.length === 0 && matchedItems.length === 0;

  if (!open) return null;

  const isDark = appearance === 'dark';
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
          <div style={{
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${isDark ? '#333' : '#F0F0F0'}`,
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

          <div style={{ display: 'flex', gap: 16, padding: '0 16px', borderBottom: `1px solid ${isDark ? '#333' : '#F0F0F0'}` }}>
            {['all', 'packs', 'items'].map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
                  padding: '12px 4px', fontSize: 13, fontWeight: activeTab === tab ? 600 : 500,
                  color: activeTab === tab ? (isDark ? '#FFF' : '#111') : (isDark ? '#777' : '#999'),
                  borderBottom: activeTab === tab ? `2px solid ${isDark ? '#FFF' : '#111'}` : '2px solid transparent',
                  textTransform: 'capitalize', transition: 'all 0.15s ease'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="desktop-history-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 8px 16px 8px', minHeight: 0, paddingRight: 4 }}>
            {isEmpty ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: mutedColor, fontSize: 14 }}>
                No results found
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(activeTab === 'all' || activeTab === 'packs') && matchedPacks.map(pack => (
                  <PackSearchResultCard
                    key={pack.groupId}
                    packInfo={pack}
                    appearance={appearance}
                    labels={t}
                    onClickPack={onPackClick}
                    onClickItem={onPackItemClick}
                    onResultPointerDown={handleResultPointerDown}
                    onResultPointerEnd={handleResultPointerEnd}
                  />
                ))}

                {(activeTab === 'all' || activeTab === 'items') && matchedItems.map(task => (
                  <HistoryTaskItem
                    key={task.id}
                    task={task}
                    appearance={appearance}
                    labels={t}
                    onClick={handleTaskClick}
                    onResultPointerDown={handleResultPointerDown}
                    onResultPointerEnd={handleResultPointerEnd}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DesktopHistoryModal;
