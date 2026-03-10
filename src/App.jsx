import React, { useState, useEffect } from 'react';
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { subDays, addDays, format, isSameDay } from 'date-fns';
import './App.css';
import Login from './Login';
import { supabase } from './supabase';

const translations = {
  EN: {
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night', midnight: 'Midnight',
    now: 'Now', actionItem: 'Action Item', today: 'Today', yesterday: 'Yesterday',
    tmr: 'Tomorrow', thisWeek: 'This Week', nextWeek: 'Next Week', lastWeek: 'Last Week',
    weeksAgo: 'Weeks Ago', weeksLater: 'Weeks Later', add: 'Add', timeOfDay: 'TIME OF DAY',
    placeholder: 'e.g Buy groceries at 9pm...', setting: 'Setting', helpFeedback: 'Help & Feedback',
    signOut: 'Sign out', language: 'Language', appearance: 'Appearance', light: 'Light', dark: 'Dark'
  },
  ZH: {
    morning: '早上', afternoon: '下午', evening: '傍晚', night: '晚上', midnight: '午夜',
    now: '现在', actionItem: '待办事项', today: '今天', yesterday: '昨天',
    tmr: '明天', thisWeek: '本周', nextWeek: '下周', lastWeek: '上周',
    weeksAgo: '周前', weeksLater: '周后', add: '添加', timeOfDay: '时间段',
    placeholder: '例如：晚上9点买杂货...', setting: '设置', helpFeedback: '帮助与反馈',
    signOut: '退出登录', language: '语言', appearance: '外观', light: '浅色', dark: '深色'
  },
  MS: {
    morning: 'Pagi', afternoon: 'Tengahari', evening: 'Petang', night: 'Malam', midnight: 'Tengah Malam',
    now: 'Sekarang', actionItem: 'Tugasan', today: 'Hari Ini', yesterday: 'Semalam',
    tmr: 'Esok', thisWeek: 'Minggu Ini', nextWeek: 'Minggu Depan', lastWeek: 'Minggu Lepas',
    weeksAgo: 'Minggu Lepas', weeksLater: 'Minggu Kemudian', add: 'Tambah', timeOfDay: 'MASA',
    placeholder: 'cth. Beli barang dapur pada 9pm...', setting: 'Tetapan', helpFeedback: 'Bantuan & Maklum Balas',
    signOut: 'Log Keluar', language: 'Bahasa', appearance: 'Penampilan', light: 'Terang', dark: 'Gelap'
  }
};

const timeBlocks = [
  { id: 'Morning', key: 'morning', start: '06:00', end: '11:00', color: '#FFE3B4', textColor: '#000000', strokeColor: '#F59E0B', accentColor: '#ED1F1F', pastBgColor: 'rgba(219, 203, 178, 0.20)' },
  { id: 'Afternoon', key: 'afternoon', start: '12:00', end: '17:00', color: '#B6DEF3', textColor: '#000000', strokeColor: '#0284C7', accentColor: '#0284C7', pastBgColor: 'rgba(231, 243, 250, 0.43)' },
  { id: 'Evening', key: 'evening', start: '17:00', end: '21:00', color: '#EDE6FF', textColor: '#000000', strokeColor: '#A855F7', accentColor: '#A855F7', pastBgColor: 'rgba(237, 230, 255, 0.20)' },
  { id: 'Night', key: 'night', start: '21:00', end: '00:00', color: '#E1E7F2', textColor: '#000000', strokeColor: '#B8C1CC', accentColor: '#B8C1CC', pastBgColor: 'rgba(215, 229, 254, 0.53)' },
  { id: 'Midnight', key: 'midnight', start: '00:00', end: '06:00', color: '#648BD2', textColor: '#000000', strokeColor: '#BFDCFF', accentColor: '#648BD2', pastBgColor: 'rgba(100, 139, 210, 0.38)' }
];

function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoadingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const [activeChip, setActiveChip] = useState('Morning');
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState('EN');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [appearance, setAppearance] = useState('light');
  const [isAppearanceDropdownOpen, setIsAppearanceDropdownOpen] = useState(false);

  // Day boundary is 06:00 AM — midnight–05:59 belongs to the previous calendar day.
  const getLogicalToday = () => {
    const now = new Date();
    now.setHours(now.getHours() - 6);
    now.setHours(0, 0, 0, 0);
    return now;
  };

  const [selectedDate, setSelectedDate] = useState(() => getLogicalToday());
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calPickerDate, setCalPickerDate] = useState(() => getLogicalToday());

  const [weekOffset, setWeekOffset] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('todos');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map(t => ({ ...t, dateString: t.dateString || format(new Date(), 'yyyy-MM-dd') }));
    } else {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const getCurrentTimeBlock = () => {
    const hour = currentTime.getHours();
    if (hour >= 0 && hour < 6) return 'Midnight';
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  };

  const handleAddTodo = () => {
    if (!inputText.trim()) return;
    const resolvedBlock = activeChip === 'Now' ? getCurrentTimeBlock() : activeChip;
    const newTodo = {
      id: Date.now(),
      text: inputText.trim(),
      timeOfDay: resolvedBlock,
      completed: false,
      dateString: format(selectedDate, 'yyyy-MM-dd')
    };
    setTodos([...todos, newTodo]);
    setInputText('');
    setIsSheetOpen(false);
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const [draggedTodoId, setDraggedTodoId] = useState(null);

  const handleDragStart = (e, id) => {
    e.stopPropagation();
    setDraggedTodoId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => { setDraggedTodoId(null); };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnTodo = (e, targetTodo) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTodoId || draggedTodoId === targetTodo.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isBottomHalf = e.clientY > rect.top + rect.height / 2;
    const todosCopy = [...todos];
    const draggedIndex = todosCopy.findIndex(t => t.id === draggedTodoId);
    if (draggedIndex === -1) return;
    const draggedTodo = todosCopy[draggedIndex];
    draggedTodo.timeOfDay = targetTodo.timeOfDay;
    todosCopy.splice(draggedIndex, 1);
    const newTargetIndex = todosCopy.findIndex(t => t.id === targetTodo.id);
    const insertIndex = isBottomHalf ? newTargetIndex + 1 : newTargetIndex;
    todosCopy.splice(insertIndex, 0, draggedTodo);
    setTodos(todosCopy);
  };

  const handleDropOnBlock = (e, blockId) => {
    e.preventDefault();
    if (!draggedTodoId) return;
    const todosCopy = [...todos];
    const draggedIndex = todosCopy.findIndex(t => t.id === draggedTodoId);
    if (draggedIndex === -1) return;
    const draggedTodo = todosCopy[draggedIndex];
    draggedTodo.timeOfDay = blockId;
    todosCopy.splice(draggedIndex, 1);
    todosCopy.push(draggedTodo);
    setTodos(todosCopy);
  };

  const logicalToday = getLogicalToday();
  const calendarDays = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(subDays(selectedDate, 3), i);
    const d1 = new Date(date); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(logicalToday); d2.setHours(0, 0, 0, 0);
    return {
      name: format(date, 'E').toUpperCase(),
      date: format(date, 'd'),
      fullDate: date,
      active: isSameDay(date, selectedDate),
      isPast: d1 < d2,
      isFuture: d1 > d2,
      isToday: isSameDay(date, new Date())
    };
  });

  const selectedDateTodos = todos.filter(t => t.dateString === format(selectedDate, 'yyyy-MM-dd'));

  const chips = [
    { id: 'Now', key: 'now' },
    { id: 'Morning', key: 'morning' },
    { id: 'Afternoon', key: 'afternoon' },
    { id: 'Evening', key: 'evening' },
    { id: 'Night', key: 'night' },
    { id: 'Midnight', key: 'midnight' }
  ];

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const handleTouchMove = (e) => { setTouchEnd(e.targetTouches[0].clientX); };
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const swipeThreshold = 30;
    if (distance > swipeThreshold) setSelectedDate(prev => addDays(prev, 7));
    else if (distance < -swipeThreshold) setSelectedDate(prev => subDays(prev, 7));
  };

  const getTimeIndicatorStyle = (block) => {
    if (!isSameDay(selectedDate, getLogicalToday())) return null;

    // Only show the indicator in the block that matches current time
    const currentBlockId = getCurrentTimeBlock();
    if (block.id !== currentBlockId) return null;

    const parseTime = (timeStr, isEnd) => {
      const [h, m] = timeStr.split(':').map(Number);
      return (h === 0 && timeStr === '00:00' && isEnd) ? 24 * 60 : h * 60 + m;
    };
    const startMins = parseTime(block.start, false);
    let endMins = parseTime(block.end, true);
    if (endMins <= startMins) endMins += 24 * 60;
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

    let percentage = (currentMins - startMins) / (endMins - startMins);
    // Clamp between 0 and 1 just in case of edge timing
    percentage = Math.max(0, Math.min(1, percentage));

    return { top: `calc(70px + (100% - 110px) * ${percentage})` };
  };

  const isTimeBlockPast = (block) => {
    // If selected date is in the past, all blocks are past.
    const today = getLogicalToday();
    const selDateMidnight = new Date(selectedDate);
    selDateMidnight.setHours(0, 0, 0, 0);

    if (selDateMidnight < today) return true;
    if (selDateMidnight > today) return false;

    // If it's today, check if the block's absolute end time has passed.
    const [h, m] = block.end.split(':').map(Number);
    let endDateTime = new Date(selectedDate);
    endDateTime.setHours(h, m, 0, 0);

    // Cross-midnight adjustment:
    // Night (ends at 00:00) and Midnight (ends at 06:00) are technically on the next calendar day.
    if (block.id === 'Midnight' || (block.id === 'Night' && h === 0)) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    return currentTime > endDateTime;
  };

  const getRelativeWeekText = () => {
    const today = getLogicalToday();
    const d1 = new Date(selectedDate); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(today); d2.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d1 - d2) / (1000 * 3600 * 24));
    const t = translations[language];
    if (diffDays === 0) return <strong>{t.today}</strong>;
    if (diffDays === -1) return <strong>{t.yesterday}</strong>;
    if (diffDays === 1) return <strong>{t.tmr}</strong>;
    return <strong>{format(selectedDate, 'EEE, MMM d')}</strong>;
  };

  if (loadingAuth) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F2F0' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTop: '3px solid #000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container">
        <Login />
      </div>
    );
  }

  return (
    <>
      {/* Login page overlay — only shown when user explicitly clicks avatar */}
      {isLoginOpen && (
        <div className="app-container" style={{ background: '#FFFFFF', position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
          <Login onClose={() => setIsLoginOpen(false)} />
        </div>
      )}

      <div className={`app-container ${appearance === 'dark' ? 'dark-theme' : ''}`} style={{
        background: `url("/background-pattern.png") lightgray 0px -92.075px / 100% 1240.631% no-repeat`
      }}>
        {/* Top Header */}
        <header className="header">
          <div className="avatar" onClick={() => {
            if (session) {
              setIsProfileOpen(true);
            } else {
              setIsLoginOpen(true);
            }
          }} style={{ cursor: 'pointer' }}>
            <img src={session?.user?.user_metadata?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s64-c'} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          </div>

          <div className="header-center">
            <div className="header-title" style={{ transition: 'all 0.3s', fontSize: '18px', fontStyle: 'italic', color: '#111111', fontFamily: '"LTC Bodoni 175", serif', fontWeight: 400, wordWrap: 'break-word' }}>
              {getRelativeWeekText()}
            </div>
            <div className="header-sub-row">
              {isSameDay(selectedDate, getLogicalToday()) ? (
                <div className="header-stats">
                  <div className="stat-pill"><span>{format(currentTime, 'hh').charAt(0)}</span></div>
                  <div className="stat-pill"><span>{format(currentTime, 'hh').charAt(1)}</span></div>
                  <div className="stat-colon">:</div>
                  <div className="stat-pill"><span>{format(currentTime, 'mm').charAt(0)}</span></div>
                  <div className="stat-pill"><span>{format(currentTime, 'mm').charAt(1)}</span></div>
                </div>
              ) : (
                <button className="back-to-today-btn" onClick={() => setSelectedDate(getLogicalToday())}>
                  {translations[language].today}
                </button>
              )}
            </div>
          </div>

          <button className="add-btn" onClick={() => setIsSheetOpen(true)}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.5 0V11.5M0 5.5H11.5" stroke="black" strokeWidth="1.2" />
            </svg>
            <span>{translations[language].add}</span>
          </button>
        </header>

        {/* Calendar Strip with Swipe */}
        <div
          className="calendar-strip"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'pan-y' }}
        >
          {calendarDays.map((day, idx) => (
            <div className="day-col" key={idx} onClick={() => setSelectedDate(day.fullDate)} style={{ cursor: 'pointer' }}>
              <span className={`day-name ${day.active ? 'active' : ''}`} style={!day.active ? { color: day.isPast ? '#989FAC' : '#000000' } : {}}>{day.name}</span>
              <span className={`day-date ${day.active ? 'active' : ''}`} style={!day.active ? { color: day.isPast ? '#989FAC' : '#000000' } : {}}>
                {day.date}
              </span>
            </div>
          ))}
        </div>

        {/* Main Timeline */}
        <main className="timeline-area">

          {timeBlocks.map((block) => {
            const blockTodos = selectedDateTodos.filter(t => t.timeOfDay === block.id);
            const indicatorStyle = getTimeIndicatorStyle(block);
            const isPast = isTimeBlockPast(block);
            return (
              <div className={`time-block ${isPast ? 'expired' : ''}`} key={block.id}>
                <div
                  className={`time-col ${isPast ? 'past-block' : ''}`}
                  style={isPast ? { backgroundColor: block.pastBgColor } : {}}
                >
                  <div className="time-pill" style={{
                    backgroundColor: block.color,
                    color: block.textColor,
                    WebkitTextStroke: `0.3px ${block.strokeColor}`,
                    paintOrder: 'stroke fill'
                  }}>
                    {translations[language][block.key]}
                  </div>
                  <span className="time-text">{block.start}</span>
                  {indicatorStyle && (
                    <img
                      src="/pin.png"
                      alt="now"
                      className="current-time-indicator-wrapper"
                      style={indicatorStyle}
                    />
                  )}
                  <span className="time-text bottom">{block.end}</span>
                </div>
                <div className="tasks-col" onDragOver={handleDragOver} onDrop={(e) => handleDropOnBlock(e, block.id)}>
                  {blockTodos.map(todo => (
                    <div
                      key={todo.id}
                      className={`task-card ${todo.completed ? 'completed' : ''} ${draggedTodoId === todo.id ? 'dragging' : ''}`}
                      onClick={() => toggleTodo(todo.id)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, todo.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnTodo(e, todo)}
                    >
                      <div className="task-icon-placeholder" style={{ backgroundColor: `${block.accentColor}20`, color: block.accentColor }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                      </div>
                      <div className="task-content">
                        <span className="task-title">{todo.text}</span>
                        <span className="task-desc">{translations[language].actionItem}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </main>

        {/* Bottom Sheet Modal */}
        {isSheetOpen && (
          <div className="backdrop" onClick={() => setIsSheetOpen(false)}>
            <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
              <button className="sheet-close" onClick={() => setIsSheetOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M5.01417 5.01423C5.14308 4.88548 5.31782 4.81316 5.50001 4.81316C5.68219 4.81316 5.85693 4.88548 5.98584 5.01423L11 10.0284L16.0142 5.01423C16.0771 4.94668 16.153 4.8925 16.2373 4.85493C16.3217 4.81735 16.4127 4.79715 16.505 4.79552C16.5973 4.79389 16.689 4.81087 16.7746 4.84545C16.8602 4.88002 16.938 4.93149 17.0033 4.99677C17.0686 5.06206 17.12 5.13982 17.1546 5.22543C17.1892 5.31103 17.2062 5.40273 17.2045 5.49504C17.2029 5.58735 17.1827 5.67839 17.1451 5.76272C17.1076 5.84705 17.0534 5.92295 16.9858 5.98589L11.9717 11.0001L16.9858 16.0142C17.0534 16.0772 17.1076 16.1531 17.1451 16.2374C17.1827 16.3217 17.2029 16.4128 17.2045 16.5051C17.2062 16.5974 17.1892 16.6891 17.1546 16.7747C17.12 16.8603 17.0686 16.9381 17.0033 17.0033C16.938 17.0686 16.8602 17.1201 16.7746 17.1547C16.689 17.1892 16.5973 17.2062 16.505 17.2046C16.4127 17.203 16.3217 17.1828 16.2373 17.1452C16.153 17.1076 16.0771 17.0534 16.0142 16.9859L11 11.9717L5.98584 16.9859C5.85551 17.1073 5.68314 17.1734 5.50503 17.1703C5.32692 17.1672 5.15698 17.095 5.03102 16.969C4.90506 16.8431 4.8329 16.6731 4.82976 16.495C4.82662 16.3169 4.89273 16.1446 5.01417 16.0142L10.0283 11.0001L5.01417 5.98589C4.88543 5.85699 4.81311 5.68225 4.81311 5.50006C4.81311 5.31787 4.88543 5.14313 5.01417 5.01423Z" fill="black" />
                </svg>
              </button>

              <div className="sheet-content">
                <div className="sheet-title-row" onClick={() => {
                  setCalPickerDate(new Date(selectedDate));
                  setIsCalendarOpen(o => !o);
                }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <h1 className="sheet-title" style={{ fontSize: language === 'EN' ? '34px' : '30px', margin: 0, lineHeight: 1 }}><strong>{getRelativeWeekText()}</strong></h1>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="19" viewBox="0 0 9 14" fill="none" className="sheet-title-icon" style={{ transform: isCalendarOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.25s', marginLeft: '12px' }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="black" />
                  </svg>
                </div>

                {/* Inline calendar picker */}
                <div className={`sheet-calendar-picker ${isCalendarOpen ? 'open' : ''}`}>
                  <div className="cal-picker-header">
                    <button className="cal-nav-btn" onClick={e => { e.stopPropagation(); setCalPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; }); }}>
                      <svg width="7" height="12" viewBox="0 0 9 14" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M0.219809 7.45072C0.0790625 7.33113 0 7.16902 0 7C0 6.83098 0.0790625 6.66887 0.219809 6.54928L7.73599 0.171181C7.87847 0.0585185 8.06692 -0.00281603 8.26164 9.93682e-05C8.45636 0.00301477 8.64215 0.0699525 8.77986 0.18681C8.91757 0.303668 8.99645 0.461322 8.99988 0.626558C9.00332 0.791795 8.93104 0.951712 8.79827 1.07262L1.81324 7L8.79827 12.9274C8.93104 13.0483 9.00332 13.2082 8.99988 13.3734C8.99645 13.5387 8.91757 13.6963 8.77986 13.8132C8.64215 13.93 8.45636 13.997 8.26164 13.9999C8.06692 14.0028 7.87847 13.9415 7.73599 13.8288L0.219809 7.45072Z" fill="#111" /></svg>
                    </button>
                    <span className="cal-picker-month-label">{format(calPickerDate, 'MMMM yyyy')}</span>
                    <button className="cal-nav-btn" onClick={e => { e.stopPropagation(); setCalPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; }); }}>
                      <svg width="7" height="12" viewBox="0 0 9 14" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="#111" /></svg>
                    </button>
                  </div>
                  <div className="cal-picker-grid">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                      <div key={i} className="cal-picker-dow">{d}</div>
                    ))}
                    {Array.from({ length: new Date(calPickerDate.getFullYear(), calPickerDate.getMonth(), 1).getDay() }).map((_, i) => (
                      <div key={`e${i}`} />
                    ))}
                    {Array.from({ length: new Date(calPickerDate.getFullYear(), calPickerDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                      const day = i + 1;
                      const cellDate = new Date(calPickerDate.getFullYear(), calPickerDate.getMonth(), day);
                      const isSelected = isSameDay(cellDate, selectedDate);
                      const isToday = isSameDay(cellDate, new Date());
                      return (
                        <button
                          key={day}
                          className={`cal-picker-day ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''}`}
                          onClick={e => { e.stopPropagation(); setSelectedDate(cellDate); setIsCalendarOpen(false); }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!isCalendarOpen && (
                  <>
                    <div className="section-label">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M9 4.5V9H12.375M15.75 9C15.75 9.88642 15.5754 10.7642 15.2362 11.5831C14.897 12.4021 14.3998 13.1462 13.773 13.773C13.1462 14.3998 12.4021 14.897 11.5831 15.2362C10.7642 15.5754 9.88642 15.75 9 15.75C8.11358 15.75 7.23583 15.5754 6.41689 15.2362C5.59794 14.897 4.85382 14.3998 4.22703 13.773C3.60023 13.1462 3.10303 12.4021 2.76381 11.5831C2.42459 10.7642 2.25 9.88642 2.25 9C2.25 7.20979 2.96116 5.4929 4.22703 4.22703C5.4929 2.96116 7.20979 2.25 9 2.25C10.7902 2.25 12.5071 2.96116 13.773 4.22703C15.0388 5.4929 15.75 7.20979 15.75 9Z" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {translations[language].timeOfDay}
                    </div>

                    <div className="chips-container">
                      {chips.map((chip, idx) => (
                        <button
                          key={idx}
                          className={`chip ${activeChip === chip.id ? 'active' : ''}`}
                          onClick={() => setActiveChip(chip.id)}
                        >
                          {translations[language][chip.key]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="sheet-input-area">
                <button className="add-circle-btn">
                  <Plus size={20} />
                </button>
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="task-input"
                    placeholder={translations[language].placeholder}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); }}
                  />
                  <button className="submit-btn" onClick={handleAddTodo}>
                    <ArrowUp size={18} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {isProfileOpen && (
          <div className="backdrop" onClick={(e) => {
            if (e.target.className === 'backdrop') setIsProfileOpen(false);
          }}>
            <div className="profile-modal">
              <button className="profile-close-btn" onClick={() => setIsProfileOpen(false)}>
                <X size={20} color="#111" />
              </button>
              <div className="profile-header">
                <div className="profile-avatar-large">
                  <img src={session?.user?.user_metadata?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s64-c'} alt="Profile Large" />
                  <div className="edit-badge">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10.5974 0.402648C10.3395 0.144835 9.98979 0 9.62516 0C9.26052 0 8.91082 0.144835 8.65296 0.402648L8.04692 1.0087L9.9913 2.95308L10.5974 2.34703C10.8552 2.08918 11 1.73947 11 1.37484C11 1.01021 10.8552 0.660505 10.5974 0.402648ZM9.43554 3.50885L7.49115 1.56446L1.12685 7.92876C0.803581 8.25187 0.565942 8.65046 0.43542 9.08848L0.0163715 10.4949C-0.0038601 10.5628 -0.00536903 10.6349 0.0120044 10.7035C0.0293779 10.7722 0.0649875 10.8349 0.115066 10.8849C0.165143 10.935 0.227827 10.9706 0.296484 10.988C0.365141 11.0054 0.437217 11.0039 0.505087 10.9836L1.91152 10.5646C2.34954 10.4341 2.74813 10.1964 3.07124 9.87315L9.43554 3.50885Z" fill="white" />
                    </svg>
                  </div>
                </div>
                <h2 className="profile-name">{session?.user?.user_metadata?.full_name?.toUpperCase() || 'USER'}</h2>
                <p className="profile-email">{session?.user?.email || ''}</p>
              </div>

              <div className="profile-menu">
                <button className="menu-btn" onClick={() => setIsSettingsOpen(true)}>
                  <div className="menu-btn-left">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    <span>{translations[language].setting}</span>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
                <button className="menu-btn">
                  <div className="menu-btn-left">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span>{translations[language].helpFeedback}</span>
                  </div>
                </button>
              </div>

              <div className="profile-footer">
                <button className="signout-btn" style={{ cursor: 'pointer', position: 'relative', zIndex: 100 }} onClick={async (e) => {
                  e.stopPropagation();
                  setIsProfileOpen(false);
                  await supabase.auth.signOut();
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                  {translations[language].signOut}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="backdrop" onClick={(e) => {
            if (e.target.className === 'backdrop') setIsSettingsOpen(false);
          }}>
            <div className="settings-modal">
              <button className="settings-back-btn" onClick={() => setIsSettingsOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>

              <div className="settings-panel">
                <div className="settings-item-row" style={{ borderBottom: '1px solid #F0F0F0' }}>
                  <div className="settings-item-left">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 17.5C11.6625 17.4999 13.2779 16.9477 14.5925 15.93C15.9072 14.9124 16.8466 13.4869 17.2633 11.8775M10 17.5C8.33751 17.4999 6.72212 16.9477 5.40748 15.93C4.09284 14.9124 3.1534 13.4869 2.73667 11.8775M10 17.5C12.0708 17.5 13.75 14.1417 13.75 10C13.75 5.85833 12.0708 2.5 10 2.5M10 17.5C7.92917 17.5 6.25 14.1417 6.25 10C6.25 5.85833 7.92917 2.5 10 2.5M17.2633 11.8775C17.4175 11.2775 17.5 10.6483 17.5 10C17.5021 8.71009 17.1699 7.44166 16.5358 6.31833M17.2633 11.8775C15.041 13.1095 12.541 13.754 10 13.75C7.365 13.75 4.88917 13.0708 2.73667 11.8775M2.73667 11.8775C2.57896 11.2641 2.49944 10.6333 2.5 10C2.5 8.6625 2.85 7.40583 3.46417 6.31833M10 2.5C11.3302 2.49945 12.6366 2.8528 13.7852 3.5238C14.9337 4.19481 15.8831 5.15931 16.5358 6.31833M10 2.5C8.6698 2.49945 7.3634 2.8528 6.21484 3.5238C5.06628 4.19481 4.11692 5.15931 3.46417 6.31833M16.5358 6.31833C14.7214 7.88994 12.4004 8.75345 10 8.75C7.50167 8.75 5.21667 7.83333 3.46417 6.31833" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{translations[language].language}</span>
                  </div>
                  <div className="language-dropdown-container">
                    <div className="settings-item-right settings-item-right-clickable" onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}>
                      <span>{language === 'EN' ? 'EN' : language === 'ZH' ? '中文' : 'MS'}</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A0A4AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isLanguageDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                    {isLanguageDropdownOpen && (
                      <div className="language-dropdown-menu">
                        {['EN', 'ZH', 'MS'].map(lang => (
                          <div key={lang} className={`language-option ${language === lang ? 'selected' : ''}`} onClick={() => { setLanguage(lang); setIsLanguageDropdownOpen(false); }}>
                            {lang === 'EN' ? 'EN' : lang === 'ZH' ? '中文' : 'MS'}
                            {language === lang && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-left">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M6.34 17.66l-1.41 1.41"></path><path d="M19.07 4.93l-1.41 1.41"></path></svg>
                    <span>{translations[language].appearance}</span>
                  </div>
                  <div className="language-dropdown-container">
                    <div className="settings-item-right settings-item-right-clickable" onClick={() => setIsAppearanceDropdownOpen(!isAppearanceDropdownOpen)}>
                      <span>{appearance === 'light' ? translations[language].light : translations[language].dark}</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A0A4AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isAppearanceDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                    {isAppearanceDropdownOpen && (
                      <div className="language-dropdown-menu">
                        {['light', 'dark'].map(mode => (
                          <div key={mode} className={`language-option ${appearance === mode ? 'selected' : ''}`} onClick={() => { setAppearance(mode); setIsAppearanceDropdownOpen(false); }}>
                            {mode === 'light' ? translations[language].light : translations[language].dark}
                            {appearance === mode && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
