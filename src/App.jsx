import React, { useState, useEffect } from 'react';
import { Plus, X, ArrowUp } from 'lucide-react';
import { subDays, addDays, format, isSameDay } from 'date-fns';
import './App.css';

const timeBlocks = [
  { id: 'Morning', label: 'Morning', start: '06:00', end: '11:00', color: '#FFE3B4', textColor: 'black', accentColor: '#ED1F1F' },
  { id: 'Afternoon', label: 'Afternoon', start: '12:00', end: '17:00', color: '#B6DEF3', textColor: 'black', accentColor: '#0284C7' },
  { id: 'Evening', label: 'Evening', start: '17:00', end: '21:00', color: '#EDE6FF', textColor: 'black', accentColor: '#A855F7' },
  { id: 'Night', label: 'Night', start: '21:00', end: '00:00', color: '#E1E7F2', textColor: 'black', accentColor: '#B8C1CC' }
];

function App() {
  const [activeChip, setActiveChip] = useState('Now');
  const [inputText, setInputText] = useState('');

  // Track the actual selected date (defaults to today)
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Track real time for the clock display
  const [currentTime, setCurrentTime] = useState(new Date());

  // Track modal states
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Track how many weeks we are offset from current week (0 = this week, -1 = last week, 1 = next week)
  const [weekOffset, setWeekOffset] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Interval to update the real time clock every second so it rolls over exactly on the minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // State for todos
  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('todos');
    if (saved) {
      // Parse dates out of strings
      const parsed = JSON.parse(saved);
      return parsed.map(t => ({ ...t, dateString: t.dateString || format(new Date(), 'yyyy-MM-dd') }));
    } else {
      return [];
    }
  });

  // Save to local storage whenever todos change
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const handleAddTodo = () => {
    if (!inputText.trim()) return;
    const newTodo = {
      id: Date.now(),
      text: inputText.trim(),
      timeOfDay: activeChip,
      completed: false,
      dateString: format(selectedDate, 'yyyy-MM-dd') // Save the task to the currently selected date
    };
    setTodos([...todos, newTodo]);
    setInputText('');
    setIsSheetOpen(false); // close modal after add
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  // Generate dynamic calendar data based on selectedDate (3 days before, selectedDate, 3 days after)
  const realToday = new Date(); // Get today's date once

  const calendarDays = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(subDays(selectedDate, 3), i); // Anchor around explicitly selected day

    // Compare dates ignoring time to determine strictly if it's "past"
    const d1 = new Date(date); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(realToday); d2.setHours(0, 0, 0, 0);

    return {
      name: format(date, 'E').toUpperCase(),
      date: format(date, 'd'),
      fullDate: date,
      active: isSameDay(date, selectedDate), // Highlight the explicitly selected user date (which is now always in the middle)
      isPast: d1 < d2 // True if generating a date strictly before today
    };
  });

  // Filter tasks to only show ones that belong to the currently selected date
  const selectedDateTodos = todos.filter(t => t.dateString === format(selectedDate, 'yyyy-MM-dd'));

  const chips = ['Now', 'Morning', 'Afternoon', 'Evening', 'Night'];

  // Swipe handlers for calendar strip
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const swipeThreshold = 30; // lower threshold makes it easier to swipe
    const isLeftSwipe = distance > swipeThreshold;
    const isRightSwipe = distance < -swipeThreshold;

    if (isLeftSwipe) {
      // Swipe left -> Go forward exactly 7 days
      setSelectedDate(prev => addDays(prev, 7));
    } else if (isRightSwipe) {
      // Swipe right -> Go backward exactly 7 days
      setSelectedDate(prev => subDays(prev, 7));
    }
  };

  // Helper to render relative week text based on selected date vs real today
  const getRelativeWeekText = () => {
    const today = new Date();
    // Zero out time perfectly to compare calendar days
    const d1 = new Date(selectedDate); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(today); d2.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d1 - d2) / (1000 * 3600 * 24));

    if (diffDays === 0) return <strong>Today</strong>;
    if (diffDays === -1) return <strong>Yesterday</strong>;
    if (diffDays === 1) return <strong>Tmr</strong>;

    if (diffDays > 1 && diffDays < 7) return <strong>This week</strong>;
    if (diffDays < -1 && diffDays > -7) return <strong>This week</strong>;

    if (diffDays >= 7 && diffDays < 14) return <strong>Next week</strong>;
    if (diffDays <= -7 && diffDays > -14) return <strong>Last week</strong>;

    if (diffDays <= -14) return <strong>{Math.abs(Math.round(diffDays / 7))} weeks ago</strong>;
    return <strong>{Math.round(diffDays / 7)} weeks later</strong>;
  };

  return (
    <div className="app-container" style={{
      background: `url("/background-pattern.png") lightgray 0px -92.075px / 100% 1240.631% no-repeat`
    }}>
      {/* Top Header */}
      <header className="header">
        <div className="avatar" onClick={() => setIsProfileOpen(true)} style={{ cursor: 'pointer' }}>
          <img src="https://lh3.googleusercontent.com/a/default-user=s64-c" alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        </div>

        <div className="header-center">
          <div className="header-title" style={{ transition: 'all 0.3s', fontSize: isSameDay(selectedDate, new Date()) ? '18px' : '14px', fontStyle: isSameDay(selectedDate, new Date()) ? 'italic' : 'normal', color: '#111111', fontFamily: isSameDay(selectedDate, new Date()) ? '"LTC Bodoni 175", serif' : 'inherit', fontWeight: 400, wordWrap: 'break-word' }}>
            {getRelativeWeekText()}
          </div>
          <div className="header-stats" style={{ visibility: isSameDay(selectedDate, new Date()) ? 'visible' : 'hidden' }}>
            <div className="stat-pill"><span>{format(currentTime, 'hh').charAt(0)}</span></div>
            <div className="stat-pill"><span>{format(currentTime, 'hh').charAt(1)}</span></div>
            <div className="stat-colon">:</div>
            <div className="stat-pill"><span>{format(currentTime, 'mm').charAt(0)}</span></div>
            <div className="stat-pill"><span>{format(currentTime, 'mm').charAt(1)}</span></div>
          </div>
        </div>

        <button className="add-btn" onClick={() => setIsSheetOpen(true)}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 0V11.5M0 5.5H11.5" stroke="black" strokeWidth="1.2" />
          </svg>
          <span>Add</span>
        </button>
      </header>

      {/* Calendar Strip with Swipe */}
      <div
        className="calendar-strip"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-y' }} // prevent browser from hijacking horizontal swipe to go back/forward in history
      >
        {calendarDays.map((day, idx) => (
          <div className="day-col" key={idx} onClick={() => setSelectedDate(day.fullDate)} style={{ cursor: 'pointer' }}>
            <span className="day-name" style={{ color: day.active ? (day.isPast ? '#A0A4AB' : '#111111') : (day.isPast ? '#A0A4AB' : '#111111') }}>{day.name}</span>
            <span className={`day-date ${day.active ? 'active' : ''}`} style={!day.active ? { color: day.isPast ? '#A0A4AB' : '#111111' } : {}}>
              {day.date}
            </span>
          </div>
        ))}
      </div>

      {/* Main List Area Placeholder */}
      <main className="timeline-area">
        {/* Render 'Now' tasks at the top if any */}
        {selectedDateTodos.filter(t => t.timeOfDay === 'Now').length > 0 && (
          <div className="time-block">
            <div className="time-col">
              <div className="time-pill" style={{ backgroundColor: '#FF3B30', color: '#FFF' }}>Now</div>
            </div>
            <div className="tasks-col">
              {selectedDateTodos.filter(t => t.timeOfDay === 'Now').map(todo => (
                <div key={todo.id} className={`task-card ${todo.completed ? 'completed' : ''}`} onClick={() => toggleTodo(todo.id)}>
                  <div className="task-icon-placeholder" style={{ backgroundColor: '#FFECEB', color: '#FF3B30' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  </div>
                  <div className="task-content">
                    <span className="task-title">{todo.text}</span>
                    <span className="task-desc">Action Item</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Render rest of the timeline blocks */}
        {timeBlocks.map((block) => {
          const blockTodos = selectedDateTodos.filter(t => t.timeOfDay === block.id);
          return (
            <div className="time-block" key={block.id}>
              <div className="time-col">
                <div className="time-pill" style={{ backgroundColor: block.color, color: block.textColor }}>
                  {block.label}
                </div>
                <span className="time-text">{block.start}</span>

                {/* Visual red dot indicator - hardcoded for Morning block to match design screenshot */}
                {block.id === 'Morning' && (
                  <div className="current-time-indicator"></div>
                )}

                <span className="time-text bottom">{block.end}</span>
              </div>
              <div className="tasks-col">
                {blockTodos.map(todo => (
                  <div
                    key={todo.id}
                    className={`task-card ${todo.completed ? 'completed' : ''}`}
                    onClick={() => toggleTodo(todo.id)}
                  >
                    <div className="task-icon-placeholder" style={{ backgroundColor: `${block.accentColor}20`, color: block.accentColor }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    </div>
                    <div className="task-content">
                      <span className="task-title">{todo.text}</span>
                      <span className="task-desc">Action Item</span>
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
              <div className="sheet-title-row">
                <h1 className="sheet-title"><strong>Today</strong></h1>
                <svg xmlns="http://www.w3.org/2000/svg" width="9" height="14" viewBox="0 0 9 14" fill="none" className="sheet-title-icon">
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="black" />
                </svg>
              </div>

              <div className="section-label">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 4.5V9H12.375M15.75 9C15.75 9.88642 15.5754 10.7642 15.2362 11.5831C14.897 12.4021 14.3998 13.1462 13.773 13.773C13.1462 14.3998 12.4021 14.897 11.5831 15.2362C10.7642 15.5754 9.88642 15.75 9 15.75C8.11358 15.75 7.23583 15.5754 6.41689 15.2362C5.59794 14.897 4.85382 14.3998 4.22703 13.773C3.60023 13.1462 3.10303 12.4021 2.76381 11.5831C2.42459 10.7642 2.25 9.88642 2.25 9C2.25 7.20979 2.96116 5.4929 4.22703 4.22703C5.4929 2.96116 7.20979 2.25 9 2.25C10.7902 2.25 12.5071 2.96116 13.773 4.22703C15.0388 5.4929 15.75 7.20979 15.75 9Z" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                TIME OF DAY
              </div>

              <div className="chips-container">
                {chips.map((chip, idx) => (
                  <button
                    key={idx}
                    className={`chip ${activeChip === chip ? 'active' : ''}`}
                    onClick={() => setActiveChip(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form at bottom of sheet */}
            <div className="sheet-input-area">
              <button className="add-circle-btn">
                <Plus size={20} />
              </button>

              <div className="input-wrapper">
                <input
                  type="text"
                  className="task-input"
                  placeholder="e.g Buy groceries at 9pm..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTodo();
                    }
                  }}
                />
                <button
                  className="submit-btn"
                  onClick={handleAddTodo}
                >
                  <ArrowUp size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal Overlay */}
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
                <img src="https://lh3.googleusercontent.com/a/default-user=s64-c" alt="Profile Large" />
                <div className="edit-badge">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10.5974 0.402648C10.3395 0.144835 9.98979 0 9.62516 0C9.26052 0 8.91082 0.144835 8.65296 0.402648L8.04692 1.0087L9.9913 2.95308L10.5974 2.34703C10.8552 2.08918 11 1.73947 11 1.37484C11 1.01021 10.8552 0.660505 10.5974 0.402648ZM9.43554 3.50885L7.49115 1.56446L1.12685 7.92876C0.803581 8.25187 0.565942 8.65046 0.43542 9.08848L0.0163715 10.4949C-0.0038601 10.5628 -0.00536903 10.6349 0.0120044 10.7035C0.0293779 10.7722 0.0649875 10.8349 0.115066 10.8849C0.165143 10.935 0.227827 10.9706 0.296484 10.988C0.365141 11.0054 0.437217 11.0039 0.505087 10.9836L1.91152 10.5646C2.34954 10.4341 2.74813 10.1964 3.07124 9.87315L9.43554 3.50885Z" fill="white" />
                  </svg>
                </div>
              </div>
              <h2 className="profile-name">VINCENT</h2>
              <p className="profile-email">lowvincent18@gmail.com</p>
            </div>

            <div className="profile-menu">
              <button className="menu-btn" onClick={() => setIsSettingsOpen(true)}>
                <div className="menu-btn-left">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  <span>Setting</span>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
              <button className="menu-btn">
                <div className="menu-btn-left">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  <span>Help & Feedback</span>
                </div>
              </button>
            </div>

            <div className="profile-footer">
              <button className="signout-btn" onClick={() => setIsProfileOpen(false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Settings Modal Overlay */}
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
                  <span>language</span>
                </div>
                <div className="settings-item-right">
                  <span>EN</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A0A4AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </div>

              <div className="settings-item-row">
                <div className="settings-item-left">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M6.34 17.66l-1.41 1.41"></path><path d="M19.07 4.93l-1.41 1.41"></path></svg>
                  <span>Apperance</span>
                </div>
                <div className="settings-item-right">
                  <span>Light</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A0A4AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
