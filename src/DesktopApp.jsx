import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import DesktopLogin from './DesktopLogin';

// Inject Google Fonts and custom styles
const GlobalStyles = () => {
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; }
      ::selection { background-color: #e53e3e; color: white; }
      .font-serif-dm { font-family: 'DM Serif Display', serif; }
      .font-inter { font-family: 'Inter', sans-serif; }
      .font-jetbrains { font-family: 'JetBrains Mono', monospace; }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(style);
    };
  }, []);
  return null;
};

// Reusable Components
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '12px', height: '12px', color: 'white' }}>
    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 0 1 1.04-.208Z" clipRule="evenodd" />
  </svg>
);

const CalendarCheckbox = ({ color, label }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
    <div style={{
      width: '16px', height: '16px', borderRadius: '4px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: color, border: `1px solid ${color}`
    }}>
      <CheckIcon />
    </div>
    <span style={{ fontSize: '14px', color: '#334155', fontFamily: 'Inter, sans-serif' }}>{label}</span>
  </label>
);

const NavItem = ({ icon, label, active, onClick }) => (
  <a
    href="#"
    onClick={(e) => { e.preventDefault(); onClick && onClick(); }}
    style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px', borderRadius: '12px', textDecoration: 'none',
      backgroundColor: active ? '#fef2f2' : 'transparent',
      color: active ? '#e53e3e' : '#475569',
      fontWeight: active ? '500' : '400',
      transition: 'all 0.15s',
      fontFamily: 'Inter, sans-serif', fontSize: '14px',
    }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; } }}
    onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; } }}
  >
    {icon}
    {label}
  </a>
);

const DayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const WeekIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
  </svg>
);

const MonthIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </svg>
);

const ScheduleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
  </svg>
);

const ClockIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const MiniCalendar = ({ currentMonth, currentYear, selectedDay, onDaySelect, onPrev, onNext }) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, outside: false });
  }
  const remaining = 35 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, outside: true });
  }

  const today = new Date();
  const isCurrentMonthYear = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontWeight: '600', fontSize: '14px', fontFamily: 'Inter, sans-serif', margin: 0 }}>
          {monthNames[currentMonth]} {currentYear}
        </h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={onPrev}
            style={{
              padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent',
              color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={onNext}
            style={{
              padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent',
              color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0 0', marginBottom: '8px' }}>
        {dayHeaders.map((h, i) => (
          <div key={i} style={{ fontSize: '10px', fontWeight: '500', color: '#94a3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Inter, sans-serif' }}>
            {h}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px 0' }}>
        {cells.map((cell, i) => {
          const isToday = !cell.outside && isCurrentMonthYear && cell.day === today.getDate();
          const isSelected = !cell.outside && selectedDay === cell.day && isCurrentMonthYear;
          return (
            <div
              key={i}
              onClick={() => !cell.outside && onDaySelect(cell.day)}
              style={{
                padding: '4px 2px', fontSize: '12px', textAlign: 'center', borderRadius: '50%',
                cursor: cell.outside ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif',
                color: cell.outside ? '#cbd5e1' : isToday || isSelected ? 'white' : '#334155',
                backgroundColor: isToday || isSelected ? '#e53e3e' : 'transparent',
                fontWeight: isToday || isSelected ? '500' : '400',
                boxShadow: isToday || isSelected ? '0 1px 2px rgba(229,62,62,0.2)' : 'none',
              }}
              onMouseEnter={e => { if (!cell.outside && !isToday && !isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
              onMouseLeave={e => { if (!cell.outside && !isToday && !isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WeekDayStrip = ({ selectedDay, onDaySelect }) => {
  const days = [
    { label: 'Tue', num: 10 },
    { label: 'Wed', num: 11 },
    { label: 'Thu', num: 12 },
    { label: 'Fri', num: 13 },
    { label: 'Sat', num: 14 },
    { label: 'Sun', num: 15 },
    { label: 'Mon', num: 16 },
  ];

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '20px 48px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fcfcfc'
    }}>
      {days.map((d) => {
        const isActive = selectedDay === d.num;
        return (
          <div
            key={d.num}
            onClick={() => onDaySelect(d.num)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '56px', cursor: 'pointer' }}
          >
            <span style={{
              fontSize: '11px', fontWeight: isActive ? '700' : '600',
              color: isActive ? '#0f172a' : '#64748b', letterSpacing: '0.1em',
              textTransform: 'uppercase', fontFamily: 'Inter, sans-serif',
              transition: 'color 0.15s'
            }}>
              {d.label}
            </span>
            {isActive ? (
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#e53e3e',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '20px', fontWeight: '500', boxShadow: '0 4px 6px rgba(229,62,62,0.3)',
                fontFamily: 'Inter, sans-serif'
              }}>
                {d.num}
              </div>
            ) : (
              <span style={{
                fontSize: '20px', color: '#94a3b8', fontFamily: 'Inter, sans-serif',
                transition: 'color 0.15s'
              }}>
                {d.num}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

const TimeBlock = ({ label, time, bgColor, textColor, borderColor }) => (
  <div style={{ position: 'relative', width: '100%' }}>
    <div style={{
      width: '128px', display: 'flex', flexDirection: 'column', gap: '12px',
      position: 'relative', zIndex: 10, backgroundColor: 'white', paddingRight: '16px'
    }}>
      <span style={{
        display: 'inline-flex', justifyContent: 'center', alignItems: 'center',
        backgroundColor: bgColor, color: textColor,
        padding: '6px 20px', borderRadius: '9999px',
        fontFamily: 'DM Serif Display, serif', fontStyle: 'italic', fontSize: '14px',
        width: 'fit-content', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        border: `1px solid ${borderColor}`
      }}>
        {label}
      </span>
      <span style={{
        color: '#94a3b8', fontWeight: '500', fontSize: '16px', marginLeft: '8px',
        letterSpacing: '0.05em', fontFamily: 'Inter, sans-serif'
      }}>
        {time}
      </span>
    </div>
    <div style={{ position: 'absolute', left: 0, top: '60px', width: '100%', height: '1px', backgroundColor: '#f1f5f9' }} />
  </div>
);

const CurrentTimeLine = () => (
  <div style={{ position: 'relative', width: '100%', height: '64px', marginTop: '40px', marginBottom: '80px' }}>
    <div style={{ position: 'absolute', left: '16px', top: 0, display: 'flex', alignItems: 'center', width: 'calc(100% - 16px)' }}>
      <div style={{
        width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#e53e3e',
        position: 'relative', zIndex: 10, boxShadow: '0 0 0 4px white, 0 1px 3px rgba(0,0,0,0.1)', flexShrink: 0
      }} />
      <div style={{ height: '2px', backgroundColor: '#e53e3e', flex: 1, marginLeft: '-4px', boxShadow: '0 1px 2px rgba(229,62,62,0.2)' }} />
    </div>
    <span style={{
      position: 'absolute', left: '8px', top: '24px',
      color: '#1e293b', fontWeight: '700', fontSize: '16px',
      letterSpacing: '0.05em', fontFamily: 'Inter, sans-serif'
    }}>
      22:00
    </span>
  </div>
);

const AddEventModal = ({ isOpen, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedTime, setSelectedTime] = useState('Now');

  const timeOptions = ['Now', 'Morning', 'Afternoon', 'Evening', 'Night'];

  const handleSubmit = () => {
    if (inputValue.trim()) {
      setInputValue('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '32px', width: '560px', maxWidth: '90vw',
        maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '24px 24px 0 24px' }}>
          <button
            onClick={onClose}
            style={{
              width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f5f9',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b', cursor: 'pointer', transition: 'background-color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
          >
            <XIcon />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 32px 32px' }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{ width: '64px', height: '64px', marginBottom: '16px' }}>
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="32" cy="48" rx="20" ry="8" fill="#94a3b8" opacity="0.4" />
                <ellipse cx="28" cy="40" rx="14" ry="6" fill="#64748b" />
                <ellipse cx="32" cy="32" rx="12" ry="5" fill="#d4c4a8" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 style={{
                fontSize: '48px', color: '#0f172a', fontStyle: 'italic',
                fontFamily: 'DM Serif Display, serif', margin: 0, lineHeight: 1
              }}>
                Today
              </h2>
              <ChevronRightIcon />
            </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#334155' }}>
              <ClockIcon />
              <span style={{ fontWeight: '600', fontSize: '14px', letterSpacing: '0.025em', fontFamily: 'Inter, sans-serif' }}>
                TIME OF DAY
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {timeOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedTime(option)}
                  style={{
                    padding: '10px 24px', borderRadius: '50px', border: 'none',
                    fontWeight: '500', fontSize: '14px', cursor: 'pointer',
                    transition: 'all 0.15s',
                    backgroundColor: selectedTime === option ? '#e53e3e' : '#f1f5f9',
                    color: selectedTime === option ? 'white' : '#334155',
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: selectedTime === option ? '0 10px 15px -3px rgba(229,62,62,0.1), 0 4px 6px -2px rgba(229,62,62,0.05)' : 'none'
                  }}
                  onMouseEnter={e => {
                    if (selectedTime !== option) {
                      e.currentTarget.style.backgroundColor = '#e2e8f0';
                    }
                  }}
                  onMouseLeave={e => {
                    if (selectedTime !== option) {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 32px 32px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button style={{
              width: '48px', height: '48px', borderRadius: '50%', border: '2px solid #cbd5e1',
              backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b', cursor: 'pointer', transition: 'all 0.15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#94a3b8';
              e.currentTarget.style.color = '#475569';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#64748b';
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '24px', height: '24px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="e.g. Buy groceries at 9pm..."
                style={{
                  width: '100%', height: '56px', padding: '0 24px 0 24px', borderRadius: '50px',
                  border: '2px solid #e2e8f0', outline: 'none', fontSize: '16px',
                  color: '#0f172a', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#e53e3e'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
              />
              <button
                onClick={handleSubmit}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0f172a',
                  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', cursor: 'pointer', transition: 'background-color 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0f172a'}
              >
                <ArrowUpIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Clock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const h = String(time.getHours()).padStart(2, '0');
  const m = String(time.getMinutes()).padStart(2, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', marginBottom: '2px', color: '#334155' }}>
      {[...h].map((digit, i) => (
        <span key={`h${i}`} style={{
          backgroundColor: '#f8fafc', padding: '4px 8px', borderRadius: '6px',
          border: '1px solid #f1f5f9', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
        }}>
          {digit}
        </span>
      ))}
      <span style={{ color: '#94a3b8', paddingBottom: '4px', fontFamily: 'Inter, sans-serif', fontSize: '20px' }}>:</span>
      {[...m].map((digit, i) => (
        <span key={`m${i}`} style={{
          backgroundColor: '#f8fafc', padding: '4px 8px', borderRadius: '6px',
          border: '1px solid #f1f5f9', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
        }}>
          {digit}
        </span>
      ))}
    </div>
  );
};

const Sidebar = ({ activeView, onViewChange, miniCalMonth, miniCalYear, selectedMiniDay, onMiniDaySelect, onMiniPrev, onMiniNext }) => (
  <aside style={{
    width: '280px', height: '100%', borderRight: '1px solid #f1f5f9',
    display: 'flex', flexDirection: 'column', backgroundColor: '#fafafa', flexShrink: 0
  }}>
    {/* Logo */}
    <div style={{
      height: '96px', padding: '0 32px', display: 'flex', alignItems: 'center',
      borderBottom: '1px solid rgba(241,245,249,0.5)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#e53e3e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(239,68,68,0.3)'
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: '20px', height: '20px', color: 'white' }}>
            <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
          </svg>
        </div>
        <span style={{ fontWeight: '700', fontSize: '18px', letterSpacing: '-0.02em', fontFamily: 'Inter, sans-serif' }}>Chronos</span>
      </div>
    </div>

    {/* Scrollable content */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Navigation */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <NavItem icon={<DayIcon />} label="Day" active={activeView === 'day'} onClick={() => onViewChange('day')} />
        <NavItem icon={<WeekIcon />} label="Week" active={activeView === 'week'} onClick={() => onViewChange('week')} />
        <NavItem icon={<MonthIcon />} label="Month" active={activeView === 'month'} onClick={() => onViewChange('month')} />
        <NavItem icon={<ScheduleIcon />} label="Schedule" active={activeView === 'schedule'} onClick={() => onViewChange('schedule')} />
      </nav>

      {/* Mini Calendar */}
      <MiniCalendar
        currentMonth={miniCalMonth}
        currentYear={miniCalYear}
        selectedDay={selectedMiniDay}
        onDaySelect={onMiniDaySelect}
        onPrev={onMiniPrev}
        onNext={onMiniNext}
      />

      <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '0 16px' }} />

      {/* My Calendars */}
      <div style={{ padding: '0 16px' }}>
        <h3 style={{ fontWeight: '600', fontSize: '14px', marginBottom: '16px', margin: '0 0 16px 0', fontFamily: 'Inter, sans-serif' }}>
          My Calendars
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <CalendarCheckbox color="#3b82f6" label="Work" />
          <CalendarCheckbox color="#10b981" label="Personal" />
          <CalendarCheckbox color="#a855f7" label="Family" />
        </div>
      </div>
    </div>
  </aside>
);

const ProfileMenu = ({ isOpen, onClose }) => {
  const [language, setLanguage] = useState('EN');
  const [appearance, setAppearance] = useState('LIGHT');

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest('.profile-menu') && !e.target.closest('.profile-button') && !e.target.closest('.profile-avatar')) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="profile-menu"
      style={{
        position: 'absolute', top: 80, right: 48, width: 280, backgroundColor: 'white',
        borderRadius: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
        zIndex: 1000, overflow: 'hidden'
      }}
    >
      <div style={{ padding: 24, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#9f3a1e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontFamily: 'DM Serif Display, serif' }}>
            q
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, color: '#0f172a' }}>QX</span>
            <span style={{ fontSize: 12, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>lowvincent18@gmail.com</span>
          </div>
        </div>
      </div>

      <div style={{ padding: 12 }}>
        <button
          onClick={() => setLanguage((prev) => (prev === 'EN' ? 'FR' : 'EN'))}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: 18, border: 'none', backgroundColor: 'transparent',
            cursor: 'pointer', transition: 'background 0.15s',
            fontSize: 14, fontWeight: 500, color: '#334155'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20, color: '#64748b' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
            </svg>
            Language
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{language}</span>
        </button>

        <button
          onClick={() => setAppearance((prev) => (prev === 'LIGHT' ? 'DARK' : 'LIGHT'))}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderRadius: 18, border: 'none', backgroundColor: 'transparent',
            cursor: 'pointer', transition: 'background 0.15s',
            marginTop: 8, fontSize: 14, fontWeight: 500, color: '#334155'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: 20, height: 20, color: '#64748b' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
            Appearance
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{appearance}</span>
        </button>

        <button
          onClick={() => {
            alert('Signed out successfully!');
            onClose?.();
          }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 18, border: 'none', backgroundColor: 'transparent',
            cursor: 'pointer', transition: 'background 0.15s', marginTop: 12,
            fontSize: 14, fontWeight: 600, color: '#dc2626'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: 20, height: 20, color: '#dc2626' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          Sign out
        </button>
      </div>
    </div>
  );
};

const MainHeader = ({ onAddClick, profileOpen, onToggleProfile }) => (
  <header style={{
    height: '96px', padding: '0 48px', borderBottom: '1px solid #f1f5f9',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px' }}>
      <h1 style={{
        fontFamily: 'DM Serif Display, serif', fontStyle: 'italic', fontSize: '36px',
        color: '#0f172a', lineHeight: 1, margin: 0
      }}>
        Today
      </h1>
      <Clock />
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', position: 'relative' }}>
      <button
        onClick={onAddClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
          borderRadius: '9999px', border: '1px solid #e2e8f0', backgroundColor: 'white',
          color: '#334155', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontFamily: 'Inter, sans-serif', fontSize: '14px'
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add
      </button>

      <div style={{ width: '1px', height: '32px', backgroundColor: '#e2e8f0', margin: '0 4px' }} />

      <button
        className="profile-button"
        onClick={onToggleProfile}
        style={{
          width: '40px', height: '40px', borderRadius: '50%', border: 'none', backgroundColor: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer'
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      </button>

      <div
        className="profile-avatar"
        style={{
          width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#9f3a1e',
          color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontFamily: 'DM Serif Display, serif', cursor: 'pointer',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: '2px solid white',
          outline: '2px solid transparent', transition: 'outline 0.15s'
        }}
        onClick={onToggleProfile}
        onMouseEnter={e => e.currentTarget.style.outline = '2px solid #f1f5f9'}
        onMouseLeave={e => e.currentTarget.style.outline = '2px solid transparent'}
      >
        q
      </div>

      <ProfileMenu isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  </header>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('day');
  const [selectedWeekDay, setSelectedWeekDay] = useState(13);
  const [miniCalMonth, setMiniCalMonth] = useState(8); // September (0-indexed)
  const [miniCalYear, setMiniCalYear] = useState(2024);
  const [selectedMiniDay, setSelectedMiniDay] = useState(13);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    // Safety timeout to prevent infinite loading screen
    const timeout = setTimeout(() => {
      setLoading(p => {
        if (p) console.warn('Desktop Auth session fetch timed out');
        return false;
      });
    }, 5000);

    if (!supabase) {
      setLoading(false);
      clearTimeout(timeout);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      clearTimeout(timeout);
    }).catch(err => {
      console.error('Error fetching desktop session:', err);
      setLoading(false);
      clearTimeout(timeout);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FDFDFD',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #e53e3e',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <DesktopLogin />;
  }

  const handleMiniPrev = () => {
    if (miniCalMonth === 0) {
      setMiniCalMonth(11);
      setMiniCalYear(y => y - 1);
    } else {
      setMiniCalMonth(m => m - 1);
    }
  };

  const handleMiniNext = () => {
    if (miniCalMonth === 11) {
      setMiniCalMonth(0);
      setMiniCalYear(y => y + 1);
    } else {
      setMiniCalMonth(m => m + 1);
    }
  };

  return (
    <>
      <GlobalStyles />
      <div style={{
        backgroundColor: 'white', color: '#0f172a', fontFamily: 'Inter, sans-serif',
        width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex'
      }}>
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          miniCalMonth={miniCalMonth}
          miniCalYear={miniCalYear}
          selectedMiniDay={selectedMiniDay}
          onMiniDaySelect={setSelectedMiniDay}
          onMiniPrev={handleMiniPrev}
          onMiniNext={handleMiniNext}
        />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'white', minWidth: '700px' }}>
          <MainHeader
            onAddClick={() => setIsModalOpen(true)}
            profileOpen={profileOpen}
            onToggleProfile={() => setProfileOpen((p) => !p)}
          />

          <WeekDayStrip selectedDay={selectedWeekDay} onDaySelect={setSelectedWeekDay} />

          {/* Scrollable day content */}
          <div style={{ flex: 1, overflowY: 'auto', width: '100%', position: 'relative' }}>
            <div style={{
              padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: '160px',
              maxWidth: '1152px', margin: '0 auto', minHeight: '100%'
            }}>
              <TimeBlock
                label="Morning"
                time="06:00"
                bgColor="#fff7ed"
                textColor="#c2410c"
                borderColor="rgba(254,215,170,0.5)"
              />
              <TimeBlock
                label="Afternoon"
                time="12:00"
                bgColor="#f0f9ff"
                textColor="#0369a1"
                borderColor="rgba(224,242,254,0.5)"
              />
              <TimeBlock
                label="Evening"
                time="18:00"
                bgColor="#faf5ff"
                textColor="#7e22ce"
                borderColor="#rgba(243,232,255,0.5)"
              />
              <TimeBlock
                label="Night"
                time="22:00"
                bgColor="#e1e7f2"
                textColor="#000000"
                borderColor="#b8c1cc"
              />
              <CurrentTimeLine />
            </div>
          </div>
        </main>

        <AddEventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </>
  );
};

export default App;
