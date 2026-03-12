import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowUp } from 'lucide-react';
import { subDays, addDays, format, isSameDay } from 'date-fns';
import './App.css';
import Login from './Login';
import { supabase, isSupabaseConfigured } from './supabase';
import { SendIntent } from 'send-intent';

const translations = {
  EN: {
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night', midnight: 'Midnight',
    now: 'Now', actionItem: 'Action Item', today: 'Today', yesterday: 'Yesterday',
    tmr: 'Tomorrow', thisWeek: 'This Week', nextWeek: 'Next Week', lastWeek: 'Last Week',
    weeksAgo: 'Weeks Ago', weeksLater: 'Weeks Later', add: 'Add', timeOfDay: 'TIME OF DAY',
    placeholder: 'e.g Buy groceries at 9pm...', setting: 'Setting', helpFeedback: 'Help & Feedback',
    signOut: 'Sign out', language: 'Language', appearance: 'Appearance', light: 'Light', dark: 'Dark',
    backToToday: 'Back to Today',
    dayNames: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  },
  ZH: {
    morning: '早上', afternoon: '下午', evening: '傍晚', night: '晚上', midnight: '午夜',
    now: '现在', actionItem: '待办事项', today: '今天', yesterday: '昨天',
    tmr: '明天', thisWeek: '本周', nextWeek: '下周', lastWeek: '上周',
    weeksAgo: '周前', weeksLater: '周后', add: '添加', timeOfDay: '时间段',
    placeholder: '例如：晚上9点买杂货...', setting: '设置', helpFeedback: '帮助与反馈',
    signOut: '退出登录', language: '语言', appearance: '外观', light: '浅色', dark: '深色',
    backToToday: '返回今天',
    dayNames: ['日', '一', '二', '三', '四', '五', '六']
  },
  MS: {
    morning: 'Pagi', afternoon: 'Tengahari', evening: 'Petang', night: 'Malam', midnight: 'Tengah Malam',
    now: 'Sekarang', actionItem: 'Tugasan', today: 'Hari Ini', yesterday: 'Semalam',
    tmr: 'Esok', thisWeek: 'Minggu Ini', nextWeek: 'Minggu Depan', lastWeek: 'Minggu Lepas',
    weeksAgo: 'Minggu Lepas', weeksLater: 'Minggu Kemudian', add: 'Tambah', timeOfDay: 'MASA',
    placeholder: 'cth. Beli barang dapur pada 9pm...', setting: 'Tetapan', helpFeedback: 'Bantuan & Maklum Balas',
    signOut: 'Log Keluar', language: 'Bahasa', appearance: 'Penampilan', light: 'Terang', dark: 'Gelap',
    backToToday: 'Kembali ke Hari Ini',
    dayNames: ['AHD', 'ISN', 'SEL', 'RAB', 'KHA', 'JUM', 'SAB']
  },
  JA: {
    morning: '朝', afternoon: '昼', evening: '夕方', night: '夜', midnight: '深夜',
    now: '今', actionItem: 'タスク', today: '今日', yesterday: '昨日',
    tmr: '明日', thisWeek: '今週', nextWeek: '来週', lastWeek: '先週',
    weeksAgo: '週間前', weeksLater: '週間後', add: '追加', timeOfDay: '時間帯',
    placeholder: '例：21時に食料品を買う...', setting: '設定', helpFeedback: 'ヘルプとフィードバック',
    signOut: 'サインアウト', language: '言語', appearance: '外観', light: 'ライト', dark: 'ダーク',
    backToToday: '今日に戻る',
    dayNames: ['日', '月', '火', '水', '木', '金', '土']
  },
  TH: {
    morning: 'เช้า', afternoon: 'บ่าย', evening: 'เย็น', night: 'กลางคืน', midnight: 'เที่ยงคืน',
    now: 'ตอนนี้', actionItem: 'รายการที่ต้องทำ', today: 'วันนี้', yesterday: 'เมื่อวาน',
    tmr: 'พรุ่งนี้', thisWeek: 'สัปดาห์นี้', nextWeek: 'สัปดาห์หน้า', lastWeek: 'สัปดาห์ที่แล้ว',
    weeksAgo: 'สัปดาห์ก่อน', weeksLater: 'สัปดาห์หน้า', add: 'เพิ่ม', timeOfDay: 'ช่วงเวลา',
    placeholder: 'เช่น ซื้อของเวลา 21:00...', setting: 'การตั้งค่า', helpFeedback: 'ความช่วยเหลือและคำแนะนำ',
    signOut: 'ออกจากระบบ', language: 'ภาษา', appearance: 'รูปแบบ', light: 'สว่าง', dark: 'มืด',
    backToToday: 'กลับไปวันนี้',
    dayNames: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
  }
};

const timeBlocks = [
  { id: 'Morning', key: 'morning', start: '06:00', end: '12:00', color: '#FFE3B4', textColor: '#000000', strokeColor: '#F59E0B', accentColor: '#ED1F1F', pastBgColor: 'rgba(219, 203, 178, 0.20)' },
  { id: 'Afternoon', key: 'afternoon', start: '12:00', end: '18:00', color: '#B6DEF3', textColor: '#000000', strokeColor: '#0284C7', accentColor: '#0284C7', pastBgColor: 'rgba(231, 243, 250, 0.43)' },
  { id: 'Evening', key: 'evening', start: '18:00', end: '22:00', color: '#EDE6FF', textColor: '#000000', strokeColor: '#A855F7', accentColor: '#A855F7', pastBgColor: 'rgba(237, 230, 255, 0.20)' },
  { id: 'Night', key: 'night', start: '22:00', end: '00:00', color: '#E1E7F2', textColor: '#000000', strokeColor: '#B8C1CC', accentColor: '#B8C1CC', pastBgColor: 'rgba(215, 229, 254, 0.53)' },
  { id: 'Midnight', key: 'midnight', start: '00:00', end: '06:00', color: '#648BD2', textColor: '#000000', strokeColor: '#BFDCFF', accentColor: '#648BD2', pastBgColor: 'rgba(100, 139, 210, 0.38)' }
];

const cardTypeConfig = {
  meeting: { icon: '/video.png', bg: '#DCEAFB', darkBg: '#276F94B3', darkStroke: '#7698C2' },
  map: { icon: '/map.png', bg: '#A9F1A2', darkBg: '#437A3FB3', darkStroke: '#64C15E' },
  document: { icon: '/document01.png', bg: '#E7CFFF', darkBg: '#57307EB3', darkStroke: '#715A87' },
  video: { icon: '/play.png', bg: '#FFD9D9', darkBg: '#5C2727B3', darkStroke: '#4D2727' },
  plain: { icon: '/text.png', bg: '#FFE5B9', darkBg: '#8B622AB3', darkStroke: '#BF8A30' },
};

const SheetPebbleIcon = () => (
  <svg width="42" height="38" viewBox="0 0 42 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="21" cy="27.125" rx="21" ry="10.5" fill="url(#sheet_pebble_0)" />
    <ellipse cx="27.125" cy="19.25" rx="13.125" ry="7" fill="url(#sheet_pebble_1)" />
    <ellipse cx="21.875" cy="8.3125" rx="14.875" ry="8.3125" fill="url(#sheet_pebble_2)" />
    <defs>
      <linearGradient id="sheet_pebble_0" x1="21" y1="16.625" x2="21" y2="44.625" gradientUnits="userSpaceOnUse">
        <stop stopColor="#625F57" />
        <stop offset="1" stopColor="#C8C1B2" />
      </linearGradient>
      <linearGradient id="sheet_pebble_1" x1="27.125" y1="12.25" x2="27.125" y2="38.0625" gradientUnits="userSpaceOnUse">
        <stop stopColor="#707070" />
        <stop offset="1" />
      </linearGradient>
      <linearGradient id="sheet_pebble_2" x1="21.875" y1="0" x2="21.875" y2="24.9375" gradientUnits="userSpaceOnUse">
        <stop offset="0.182692" stopColor="#E6D2A8" />
        <stop offset="1" stopColor="#80755D" />
      </linearGradient>
    </defs>
  </svg>
);

const detectCardType = (text) => {
  const t = text.toLowerCase();
  // Video call / meeting links — check BEFORE generic video links
  if (/https?:\/\/(www\.)?(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|us\d+web\.zoom\.us|whereby\.com|webex\.com|gotomeeting\.com|meet\.jit\.si)/.test(t)) return 'meeting';
  // Video links
  if (/https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)/.test(t)) return 'video';
  // Map / place
  if (/google\.com\/maps|maps\.app\.goo\.gl/.test(t)) return 'map';
  if (/\b(address|jalan|street|avenue|blvd|road|mall|plaza|restaurant|café|cafe|mcdonald|kfc|starbucks|sunway|pavilion|mid valley)\b/.test(t)) return 'map';
  // Document / work task
  if (/\b(pdf|slides?|document|doc|submit|submission|export|report|file|spreadsheet|excel|powerpoint|proposal|revise|revision|review|draft|send|finale?)\b/.test(t)) return 'document';
  // Meeting — time pattern AND a meeting keyword (for text-only entries)
  const hasTime = /\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/.test(t);
  const hasMeetingWord = /\b(meeting|interview|call|sync|standup|stand-up|catch up|catchup|briefing|session|zoom|teams|google meet|webinar|オンライン)\b/.test(t);
  if (hasTime && hasMeetingWord) return 'meeting';
  return 'plain';
};

const extractVideoUrl = (text) => {
  const match = text.match(/https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)\S*/i);
  return match ? match[0] : null;
};

const fetchVideoMeta = async (url) => {
  try {
    if (/youtube\.com|youtu\.be/.test(url)) {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) {
        const data = await res.json();
        return { videoTitle: data.title, videoPlatform: 'Saved from YouTube', videoUrl: url };
      }
    }
    if (/vimeo\.com/.test(url)) {
      const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        return { videoTitle: data.title, videoPlatform: 'Saved from Vimeo', videoUrl: url };
      }
    }
    if (/tiktok\.com/.test(url)) {
      return { videoTitle: 'TikTok Video', videoPlatform: 'Saved from TikTok', videoUrl: url };
    }
  } catch (_) { }
  return { videoTitle: null, videoPlatform: 'Saved Video', videoUrl: url };
};

const extractMapUrl = (text) => {
  const match = text.match(/https?:\/\/(www\.)?(google\.com\/maps|maps\.app\.goo\.gl)\S*/i);
  return match ? match[0] : null;
};

// Parse place name directly from a full Google Maps URL
const parsePlaceFromUrl = (url) => {
  try {
    const decoded = decodeURIComponent(url);
    const match = decoded.match(/\/maps\/place\/([^/@?#]+)/);
    if (match && match[1]) {
      return match[1].replace(/\+/g, ' ').trim();
    }
  } catch (_) { }
  return null;
};

const fetchMapMeta = async (url) => {
  try {
    // 1. If it's already a full /maps/place/ URL, parse directly – no request needed
    const directName = parsePlaceFromUrl(url);
    if (directName) {
      return { mapTitle: directName, mapSubtitle: 'Google Maps', mapUrl: url };
    }

    // 2. It's a short link (maps.app.goo.gl) — resolve it via allorigins
    //    allorigins follows redirects and returns the final page URL in status.url
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    if (res.ok) {
      const json = await res.json();
      const finalUrl = json?.status?.url || '';
      const resolved = parsePlaceFromUrl(finalUrl);
      if (resolved) {
        return { mapTitle: resolved, mapSubtitle: 'Google Maps', mapUrl: url };
      }
      // Fallback: try to find the place name in the raw HTML redirect meta tag
      const html = json?.contents || '';
      const urlMatch = html.match(/URL=([^"']+google\.com\/maps\/place\/[^"']+)/i)
        || html.match(/href="(https?:\/\/[^"]*\/maps\/place\/[^"]+)"/i);
      if (urlMatch) {
        const name = parsePlaceFromUrl(decodeURIComponent(urlMatch[1]));
        if (name) return { mapTitle: name, mapSubtitle: 'Google Maps', mapUrl: url };
      }
    }
  } catch (err) {
    console.error('Map meta error:', err);
  }
  return { mapTitle: null, mapSubtitle: 'Google Maps', mapUrl: url };
};

function App() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoadingAuth(false);
      return;
    }

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

  // Handle incoming share intent from other apps (YouTube, Instagram, etc.)
  useEffect(() => {
    const handleShareIntent = async () => {
      try {
        const result = await SendIntent.checkSendIntentReceived();
        if (result && (result.url || result.title || result.description)) {
          // Prefer URL, fallback to title or description
          const sharedText = result.url || result.title || result.description || '';
          if (sharedText) {
            setInputText(sharedText);
            setActiveChip(getCurrentTimeBlock());
            setIsSheetOpen(true);
          }
        }
      } catch (_) {
        // Not running in Capacitor (e.g. browser dev mode) — skip silently
      }
    };
    handleShareIntent();
  }, []);

  const [activeChip, setActiveChip] = useState('Morning');
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState('EN');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [appearance, setAppearance] = useState('light');
  const [isAppearanceDropdownOpen, setIsAppearanceDropdownOpen] = useState(false);
  const taskInputRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const [isTaskInputFocused, setIsTaskInputFocused] = useState(false);
  const [sheetBaseHeight, setSheetBaseHeight] = useState(null);
  const [sheetKeyboardOffset, setSheetKeyboardOffset] = useState(0);
  const [sheetBaseViewportHeight, setSheetBaseViewportHeight] = useState(0);

  const startVoiceInput = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language === 'ZH' ? 'zh-CN' : language === 'MS' ? 'ms-MY' : language === 'JA' ? 'ja-JP' : language === 'TH' ? 'th-TH' : 'en-US';
    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev ? prev + ' ' + transcript : transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, language]);

  useEffect(() => {
    const textarea = taskInputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, 110); // 110px approx 5 lines
    textarea.style.height = `${nextHeight}px`;
  }, [inputText]);

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
  const [isClosingProfile, setIsClosingProfile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClosingSettings, setIsClosingSettings] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calPickerDate, setCalPickerDate] = useState(() => getLogicalToday());

  useEffect(() => {
    if (!isSheetOpen) {
      setIsTaskInputFocused(false);
      setSheetKeyboardOffset(0);
      setSheetBaseHeight(null);
      setSheetBaseViewportHeight(0);
      return;
    }

    const baseViewportHeight = window.innerHeight;
    setSheetBaseViewportHeight(baseViewportHeight);
    setSheetBaseHeight(Math.min(760, Math.max(0, baseViewportHeight - 24)));
  }, [isSheetOpen]);

  useEffect(() => {
    if (!isSheetOpen || !sheetBaseViewportHeight) return;

    const updateKeyboardOffset = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setSheetKeyboardOffset(0);
        return;
      }

      const offset = Math.max(0, Math.round(sheetBaseViewportHeight - vv.height - vv.offsetTop));
      setSheetKeyboardOffset(offset);
    };

    updateKeyboardOffset();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', updateKeyboardOffset);
    vv?.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      vv?.removeEventListener('resize', updateKeyboardOffset);
      vv?.removeEventListener('scroll', updateKeyboardOffset);
    };
  }, [isSheetOpen, sheetBaseViewportHeight]);

  const keyboardLiftOffset = sheetKeyboardOffset > 120 ? sheetKeyboardOffset : 0;
  const sheetGapCollapse = 190;
  const composerLift = keyboardLiftOffset > 0
    ? Math.min(
      keyboardLiftOffset,
      Math.max(0, (sheetBaseHeight || 0) - 170)
    )
    : 0;
  const sheetContentLift = composerLift > sheetGapCollapse
    ? composerLift - sheetGapCollapse
    : 0;

  const closeProfile = (isSwipe = false) => {
    if (isSwipe) {
      setIsProfileOpen(false);
      return;
    }
    setIsClosingProfile(true);
    setTimeout(() => {
      setIsProfileOpen(false);
      setIsClosingProfile(false);
    }, 250);
  };
  const closeSettings = (isSwipe = false) => {
    if (isSwipe) {
      setIsSettingsOpen(false);
      return;
    }
    setIsClosingSettings(true);
    setTimeout(() => {
      setIsSettingsOpen(false);
      setIsClosingSettings(false);
    }, 250);
  };

  // --- Profile Swipe-to-Close State ---
  const profileTouchStartY = React.useRef(null);
  const profileCurrentY = React.useRef(0);

  const handleProfileTouchStart = (e) => {
    profileTouchStartY.current = e.touches[0].clientY;
  };
  const handleProfileTouchMove = (e) => {
    if (profileTouchStartY.current === null) return;
    const dy = e.touches[0].clientY - profileTouchStartY.current;
    if (dy > 0) {
      profileCurrentY.current = dy;
      const el = e.currentTarget;
      el.style.transform = `translateX(-50%) translateY(${dy}px)`;
      el.style.transition = 'none';
    }
  };
  const handleProfileTouchEnd = (e) => {
    if (profileTouchStartY.current === null) return;
    const dy = profileCurrentY.current;
    const el = e.currentTarget;
    if (dy > 120) {
      el.style.transition = 'transform 0.25s ease-out';
      el.style.transform = `translateX(-50%) translateY(100vh)`;
      setTimeout(() => closeProfile(true), 200);
    } else {
      el.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = `translateX(-50%) translateY(0)`;
    }
    profileTouchStartY.current = null;
    profileCurrentY.current = 0;
  };

  // --- Settings Swipe-to-Close State ---
  const settingsTouchStartY = React.useRef(null);
  const settingsCurrentY = React.useRef(0);

  const handleSettingsTouchStart = (e) => {
    settingsTouchStartY.current = e.touches[0].clientY;
  };
  const handleSettingsTouchMove = (e) => {
    const scrollEl = e.currentTarget.querySelector('.settings-panel');
    // Only allow swipe down if we are at the top of the scrollable area
    if (scrollEl && scrollEl.scrollTop > 0) return;
    
    if (settingsTouchStartY.current === null) return;
    const dy = e.touches[0].clientY - settingsTouchStartY.current;
    if (dy > 0) {
      settingsCurrentY.current = dy;
      const el = e.currentTarget;
      el.style.transform = `translateX(-50%) translateY(${dy}px)`;
      el.style.transition = 'none';
      // Prevent scrolling while swiping down
      if (e.cancelable) e.preventDefault();
    }
  };
  const handleSettingsTouchEnd = (e) => {
    if (settingsTouchStartY.current === null) return;
    const dy = settingsCurrentY.current;
    const el = e.currentTarget;
    if (dy > 120) {
      el.style.transition = 'transform 0.25s ease-out';
      el.style.transform = `translateX(-50%) translateY(100vh)`;
      setTimeout(() => closeSettings(true), 200);
    } else {
      el.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = `translateX(-50%) translateY(0)`;
    }
    settingsTouchStartY.current = null;
    settingsCurrentY.current = 0;
  };

  // ── Android Back Button (PWA) ──────────────────────────────────────────────
  // When any overlay is open we push a dummy history entry so the Android
  // hardware back-button fires `popstate` instead of closing the whole app.
  const [editingTodo, setEditingTodo] = useState(null);
  const [editText, setEditText] = useState('');

  const anyOverlayOpen =
    isSheetOpen || isProfileOpen || isSettingsOpen ||
    isCalendarOpen || !!editingTodo || isLoginOpen;

  useEffect(() => {
    if (anyOverlayOpen) {
      // Push a state so the back gesture has somewhere to go back TO.
      window.history.pushState({ modal: true }, '');
    }
  }, [anyOverlayOpen]);

  useEffect(() => {
    const handlePopState = () => {
      // Close overlays from top (most-modal) to bottom
      if (editingTodo) { setEditingTodo(null); setEditText(''); return; }
      if (isSettingsOpen) { setIsSettingsOpen(false); return; }
      if (isProfileOpen) { setIsProfileOpen(false); return; }
      if (isCalendarOpen) { setIsCalendarOpen(false); return; }
      if (isSheetOpen) { setIsSheetOpen(false); return; }
      if (isLoginOpen) { setIsLoginOpen(false); return; }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [editingTodo, isSettingsOpen, isProfileOpen, isCalendarOpen, isSheetOpen, isLoginOpen]);
  // ─────────────────────────────────────────────────────────────────────────

  const [weekOffset, setWeekOffset] = useState(0);
  const [contentKey, setContentKey] = useState(0);
  const stripRef = React.useRef(null);
  const dayRefs = React.useRef({});
  const timelineRef = React.useRef(null);

  const scrollToCurrentTime = (behavior = 'smooth') => {
    if (!isSameDay(selectedDate, getLogicalToday())) return;
    const currentBlockId = getCurrentTimeBlock();
    const el = document.querySelector(`[data-block-id="${currentBlockId}"]`);
    if (el && timelineRef.current) {
      el.scrollIntoView({ behavior, block: 'start' });
    }
  };

  // Auto-scroll the selected day into center of the strip
  useEffect(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    const el = dayRefs.current[key];
    if (el && stripRef.current) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    if (isSameDay(selectedDate, getLogicalToday())) {
      setTimeout(() => scrollToCurrentTime(), 400);
    }
    setContentKey(k => k + 1);
  }, [selectedDate]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial scroll to current time on mount
  useEffect(() => {
    // Small delay to ensure layout is ready
    const timer = setTimeout(() => {
      scrollToCurrentTime('auto');
    }, 100);
    return () => clearTimeout(timer);
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
    if (hour >= 12 && hour < 18) return 'Afternoon';
    if (hour >= 18 && hour < 22) return 'Evening';
    return 'Night';
  };

  const handleAddTodo = () => {
    if (!inputText.trim()) return;
    const resolvedBlock = activeChip === 'Now' ? getCurrentTimeBlock() : activeChip;
    const rawText = inputText.trim();
    const cardType = detectCardType(rawText);

    const newTodoId = Date.now();
    const videoUrl = cardType === 'video' ? extractVideoUrl(rawText) : null;
    const mapUrl = cardType === 'map' ? extractMapUrl(rawText) : null;

    const newTodo = {
      id: newTodoId,
      text: rawText,
      timeOfDay: resolvedBlock,
      completed: false,
      dateString: format(selectedDate, 'yyyy-MM-dd'),
      cardType,
      videoUrl,
      mapUrl
    };

    setTodos(prev => [...prev, newTodo]);
    setInputText('');
    setIsSheetOpen(false);

    // Fetch metadata asynchronously without blocking the UI
    if (cardType === 'video' && videoUrl) {
      fetchVideoMeta(videoUrl).then(meta => {
        setTodos(prev => prev.map(t => t.id === newTodoId ? { ...t, ...meta } : t));
      });
    } else if (cardType === 'map' && mapUrl) {
      fetchMapMeta(mapUrl).then(meta => {
        setTodos(prev => prev.map(t => t.id === newTodoId ? { ...t, ...meta } : t));
      });
    }
  };

  const toggleTodo = (id) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const [draggedTodoId, setDraggedTodoId] = useState(null);
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [dragOverBlock, setDragOverBlock] = useState(null);

  // Sync swipe-open CSS class with openSwipeId state
  const prevOpenSwipeId = React.useRef(null);
  useEffect(() => {
    // Remove class from previously open wrapper
    if (prevOpenSwipeId.current !== null) {
      const prev = document.getElementById(`swipe-wrapper-${prevOpenSwipeId.current}`);
      if (prev) prev.classList.remove('swipe-open');
    }
    // Add class to newly open wrapper
    if (openSwipeId !== null) {
      const next = document.getElementById(`swipe-wrapper-${openSwipeId}`);
      if (next) next.classList.add('swipe-open');
    }
    prevOpenSwipeId.current = openSwipeId;
  }, [openSwipeId]);

  // Close any open swipe when tapping outside the swiped card
  useEffect(() => {
    if (openSwipeId === null) return;
    const handleOutsideTap = (e) => {
      const wrapper = document.getElementById(`swipe-wrapper-${openSwipeId}`);
      if (wrapper && !wrapper.contains(e.target)) {
        const el = document.getElementById(`swipe-card-${openSwipeId}`);
        const actionsEl = document.querySelector(`#swipe-wrapper-${openSwipeId} .swipe-actions`);
        if (el) {
          el.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = 'translateX(0)';
          setTimeout(() => { if (el) el.style.transition = ''; }, 280);
        }
        if (actionsEl) {
          actionsEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
          actionsEl.style.opacity = '0';
          actionsEl.style.transform = 'translateX(20px)';
          setTimeout(() => { if (actionsEl) actionsEl.style.transition = ''; }, 220);
        }
        setOpenSwipeId(null);
      }
    };
    document.addEventListener('touchstart', handleOutsideTap, { passive: true });
    document.addEventListener('mousedown', handleOutsideTap);
    return () => {
      document.removeEventListener('touchstart', handleOutsideTap);
      document.removeEventListener('mousedown', handleOutsideTap);
    };
  }, [openSwipeId]);

  const dragOverBlockRef = React.useRef(null); // readable in onTouchEnd closure
  const scrollBlocker = React.useRef(null);     // non-passive touchmove blocker

  const swipeTouchStartX = React.useRef(null);
  const swipeTouchStartY = React.useRef(null);
  const swipeCurrentOffset = React.useRef(0);
  const isDragMode = React.useRef(false);
  const dragOriginY = React.useRef(0);
  const autoScrollRef = React.useRef(null);
  const dragScrollOffset = React.useRef(0);

  // Helper: find nearest time block by vertical center proximity
  const getNearestBlock = (touchY) => {
    const blocks = document.querySelectorAll('[data-block-id]');
    let nearestId = null;
    let nearestDist = Infinity;
    blocks.forEach(block => {
      const rect = block.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const dist = Math.abs(touchY - centerY);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = block.dataset.blockId;
      }
    });
    return nearestId;
  };

  const SWIPE_MAX = 136; // px — width of both action buttons
  const SNAP_THRESHOLD = 50;

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    setOpenSwipeId(null);
  };



  const openEdit = (todo) => {
    setEditingTodo(todo);
    setEditText(todo.text);
    setOpenSwipeId(null);
  };

  const handleEditSave = () => {
    if (!editText.trim()) return;
    setTodos(prev => prev.map(t =>
      t.id === editingTodo.id ? { ...t, text: editText.trim() } : t
    ));
    setEditingTodo(null);
    setEditText('');
  };

  const getSwipeHandlers = (todoId) => ({
    onTouchStart: (e) => {
      const touch = e.touches[0];
      swipeTouchStartX.current = touch.clientX;
      swipeTouchStartY.current = touch.clientY;
      isDragMode.current = false; // wait for direction detection in onTouchMove
      swipeCurrentOffset.current = 0;

      if (openSwipeId !== null && openSwipeId !== todoId) setOpenSwipeId(null);
    },
    onTouchMove: (e) => {
      const touch = e.touches[0];
      if (swipeTouchStartX.current === null) return;

      const deltaX = touch.clientX - swipeTouchStartX.current;
      const deltaY = touch.clientY - swipeTouchStartY.current;

      // If already in drag mode, handle vertical dragging
      if (isDragMode.current) {
        e.preventDefault();
        
        // --- 1. Edge Auto-Scroll Logic ---
        const SCROLL_ZONE = 100; // pixels from top/bottom to start scrolling
        const MAX_SPEED = 15;
        const timelineEl = document.querySelector('.timeline-area');
        
        if (timelineEl) {
          const rect = timelineEl.getBoundingClientRect();
          const touchY = touch.clientY;
          let speed = 0;
          
          if (touchY < rect.top + SCROLL_ZONE) {
            // Near top
            const intensity = 1 - (touchY - rect.top) / SCROLL_ZONE;
            speed = -MAX_SPEED * Math.max(0, intensity);
          } else if (touchY > rect.bottom - SCROLL_ZONE) {
            // Near bottom
            const intensity = 1 - (rect.bottom - touchY) / SCROLL_ZONE;
            speed = MAX_SPEED * Math.max(0, intensity);
          }

          if (speed !== 0) {
            if (!autoScrollRef.current) {
              autoScrollRef.current = setInterval(() => {
                timelineEl.scrollTop += speed;
                dragScrollOffset.current += speed;
                // Update card position immediately during scroll tick
                const el = document.getElementById(`swipe-card-${todoId}`);
                if (el) {
                  const rawDy = touch.clientY - dragOriginY.current + dragScrollOffset.current;
                  const dy = Math.max(-2000, Math.min(2000, rawDy));
                  el.style.transform = `scale(1.04) translateY(${dy}px)`;
                }
                
                // Re-calculate drag over block since content scrolled
                const nearest = getNearestBlock(touch.clientY);
                if (nearest !== dragOverBlockRef.current) {
                  dragOverBlockRef.current = nearest;
                  setDragOverBlock(nearest);
                }
              }, 16);
            }
          } else {
            if (autoScrollRef.current) {
              clearInterval(autoScrollRef.current);
              autoScrollRef.current = null;
            }
          }
        }
        
        // --- 2. Card Drag Translate ---
        // Combine finger movement with artificial scroll offset
        const rawDy = touch.clientY - dragOriginY.current + dragScrollOffset.current;
        const dy = Math.max(-2000, Math.min(2000, rawDy)); 
        const el = document.getElementById(`swipe-card-${todoId}`);
        if (el) el.style.transform = `scale(1.04) translateY(${dy}px)`;

        const nearest = getNearestBlock(touch.clientY);
        if (nearest !== dragOverBlockRef.current) {
          dragOverBlockRef.current = nearest;
        }
        return;
      }

      // Direction detection threshold
      const DIRECTION_THRESHOLD = 8;
      if (Math.abs(deltaX) < DIRECTION_THRESHOLD && Math.abs(deltaY) < DIRECTION_THRESHOLD) return;

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        // Vertical movement → activate drag immediately (no long press)
        isDragMode.current = true;
        dragOriginY.current = swipeTouchStartY.current;
        dragScrollOffset.current = 0;

        const el = document.getElementById(`swipe-card-${todoId}`);
        const wrapper = document.getElementById(`swipe-wrapper-${todoId}`);
        if (el) {
          el.style.transition = 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s, opacity 0.15s';
          el.style.transform = 'scale(1.04) translateY(-3px)';
          el.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.12)';
          el.style.opacity = '0.95';
          el.style.zIndex = '100';
          setTimeout(() => { if (el) el.style.transition = ''; }, 200);
        }
        // Lock page scroll
        const blocker = (ev) => ev.preventDefault();
        scrollBlocker.current = blocker;
        window.addEventListener('touchmove', blocker, { passive: false });

        if (wrapper) {
          wrapper.classList.add('is-dragging');
          const parentBlock = wrapper.closest('.time-block');
          if (parentBlock) parentBlock.classList.add('is-dragging-parent');
        }
        document.body.classList.add('is-dragging-global');

        const nearest = getNearestBlock(touch.clientY);
        dragOverBlockRef.current = nearest;
        setDragOverBlock(nearest);
      } else {
        // Horizontal movement → swipe to reveal actions with fade (left only)
        if (deltaX > 0) return;
        const rawOffset = Math.abs(deltaX);
        let offset;
        if (rawOffset <= SWIPE_MAX) {
          offset = rawOffset;
        } else {
          const overflow = rawOffset - SWIPE_MAX;
          offset = SWIPE_MAX + overflow * 0.15;
        }
        swipeCurrentOffset.current = offset;
        const el = document.getElementById(`swipe-card-${todoId}`);
        const actionsEl = document.querySelector(`#swipe-wrapper-${todoId} .swipe-actions`);
        if (el) el.style.transform = `translateX(-${offset}px)`;
        if (actionsEl) {
          const progress = Math.min(offset / SWIPE_MAX, 1);
          actionsEl.style.opacity = progress;
          // Slide in from 20px to 0px as you swipe, sitting perfectly behind the card
          const slideX = 20 * (1 - progress);
          actionsEl.style.transform = `translateX(${slideX}px)`;
        }
      }
    },
    onTouchEnd: (e) => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
        autoScrollRef.current = null;
      }
      if (isDragMode.current) {
        isDragMode.current = false;
        const el = document.getElementById(`swipe-card-${todoId}`);
        const wrapper = document.getElementById(`swipe-wrapper-${todoId}`);

        // Use ref for stale-closure-safe latest nearest block
        const targetBlock = dragOverBlockRef.current;
        if (targetBlock) {
          setTodos(prev => prev.map(t => t.id === todoId ? { ...t, timeOfDay: targetBlock } : t));
        }

        if (el) {
          el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s, opacity 0.2s';
          el.style.transform = '';
          el.style.boxShadow = '';
          el.style.opacity = '';
          el.style.zIndex = '';
          setTimeout(() => { if (el) el.style.transition = ''; }, 350);
        }
        if (wrapper) {
          wrapper.classList.remove('is-dragging');
          const parentBlock = wrapper.closest('.time-block');
          if (parentBlock) parentBlock.classList.remove('is-dragging-parent');
        }
        document.body.classList.remove('is-dragging-global');
        // Release scroll lock
        if (scrollBlocker.current) {
          window.removeEventListener('touchmove', scrollBlocker.current);
          scrollBlocker.current = null;
        }
        dragOverBlockRef.current = null;
        return;
      }

      // Regular swipe snap
      const offset = swipeCurrentOffset.current;
      const el = document.getElementById(`swipe-card-${todoId}`);
      const actionsEl = document.querySelector(`#swipe-wrapper-${todoId} .swipe-actions`);
      if (offset >= SNAP_THRESHOLD) {
        if (el) {
          el.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = `translateX(-${SWIPE_MAX}px)`;
          setTimeout(() => { if (el) el.style.transition = ''; }, 320);
        }
        if (actionsEl) {
          actionsEl.style.transition = 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
          actionsEl.style.opacity = '1';
          actionsEl.style.transform = 'translateX(0)';
          actionsEl.style.pointerEvents = 'auto'; // enable clicks immediately
          setTimeout(() => { if (actionsEl) { actionsEl.style.transition = ''; } }, 300);
        }
        setOpenSwipeId(todoId);
      } else {
        if (el) {
          el.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = 'translateX(0)';
          setTimeout(() => { if (el) el.style.transition = ''; }, 280);
        }
        if (actionsEl) {
          actionsEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
          actionsEl.style.opacity = '0';
          actionsEl.style.transform = 'translateX(20px)';
          actionsEl.style.pointerEvents = 'none';
          setTimeout(() => { if (actionsEl) { actionsEl.style.transition = ''; } }, 220);
        }
        setOpenSwipeId(null);
      }
      swipeTouchStartX.current = null;
      swipeCurrentOffset.current = 0;
    },
  });

  const closeSwipe = (todoId) => {
    const el = document.getElementById(`swipe-card-${todoId}`);
    if (el) {
      el.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'translateX(0)';
      setTimeout(() => { if (el) el.style.transition = ''; }, 280);
    }
    setOpenSwipeId(null);
  };

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
  const chipOrder = ['Morning', 'Afternoon', 'Evening', 'Night', 'Midnight'];
  const calendarDays = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(subDays(selectedDate, 3), i);
    const d1 = new Date(date); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(logicalToday); d2.setHours(0, 0, 0, 0);
    const dayIndex = date.getDay();
    const localizedDayName = translations[language].dayNames[dayIndex];

    return {
      name: localizedDayName,
      date: format(date, 'd'),
      fullDate: date,
      active: isSameDay(date, selectedDate),
      isPast: d1 < d2,
      isFuture: d1 > d2,
      isToday: isSameDay(date, new Date())
    };
  });

  const selectedDateTodos = todos.filter(t => t.dateString === format(selectedDate, 'yyyy-MM-dd'));

  const allChips = [
    { id: 'Now', key: 'now' },
    { id: 'Morning', key: 'morning' },
    { id: 'Afternoon', key: 'afternoon' },
    { id: 'Evening', key: 'evening' },
    { id: 'Night', key: 'night' },
    { id: 'Midnight', key: 'midnight' }
  ];
  const chips = isSameDay(selectedDate, logicalToday)
    ? allChips.filter((chip) => (
      chip.id === 'Now' || chipOrder.indexOf(chip.id) >= chipOrder.indexOf(getCurrentTimeBlock())
    ))
    : allChips;
  const chipRows = Array.from(
    { length: Math.ceil(chips.length / 3) },
    (_, idx) => chips.slice(idx * 3, idx * 3 + 3)
  );

  useEffect(() => {
    if (!chips.some((chip) => chip.id === activeChip)) {
      setActiveChip(chips[0]?.id || 'Now');
    }
  }, [chips, activeChip]);


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

    const dayIndex = selectedDate.getDay();
    const localizedDayName = t.dayNames[dayIndex];
    return <strong>{localizedDayName}, {format(selectedDate, 'MMM d')}</strong>;
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

      <div className={`app-container ${appearance === 'dark' ? 'dark-theme' : ''}`}>
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

          <div className="header-center" style={{ justifyContent: isSameDay(selectedDate, getLogicalToday()) ? 'flex-start' : 'center' }}>
            <div className="header-title-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: !isSameDay(selectedDate, getLogicalToday()) ? 'pointer' : 'default' }} onClick={() => { if (!isSameDay(selectedDate, getLogicalToday())) { setSelectedDate(getLogicalToday()); setTimeout(() => scrollToCurrentTime(), 300); } }}>
              {!isSameDay(selectedDate, getLogicalToday()) && (
                <img src={appearance === 'dark' ? '/whiteuturn.png' : '/uturn.png'} alt="Back to Today" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
              )}
              <div className="header-title" style={{ transition: 'all 0.3s', fontSize: isSameDay(selectedDate, getLogicalToday()) ? '16px' : '20px', fontStyle: 'italic', fontFamily: '"LTC Bodoni 175", serif', fontWeight: 400, wordWrap: 'break-word', margin: 0 }}>
                {getRelativeWeekText()}
              </div>
            </div>
            {isSameDay(selectedDate, getLogicalToday()) && (
              <div className="header-sub-row">
                <div className="header-stats">
                  <div className="stat-pill"><span>{format(currentTime, 'hh').charAt(0)}</span></div>
                  <div className="stat-pill"><span>{format(currentTime, 'hh').charAt(1)}</span></div>
                  <div className="stat-colon">:</div>
                  <div className="stat-pill"><span>{format(currentTime, 'mm').charAt(0)}</span></div>
                  <div className="stat-pill"><span>{format(currentTime, 'mm').charAt(1)}</span></div>
                </div>
              </div>
            )}
          </div>

          <button className="add-btn" onClick={() => setIsSheetOpen(true)}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="add-btn-icon" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.5 0V11.5M0 5.5H11.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span>{translations[language].add}</span>
          </button>
        </header>

        {/* Calendar Strip — native horizontal scroll with snap */}
        <div
          ref={stripRef}
          className="calendar-strip"
        >
          {calendarDays.map((day, idx) => (
            <div
              className="day-col"
              key={idx}
              ref={el => { dayRefs.current[format(day.fullDate, 'yyyy-MM-dd')] = el; }}
              onClick={() => setSelectedDate(day.fullDate)}
              style={{ cursor: 'pointer' }}
            >
              <span className={`day-name ${day.active ? 'active' : ''} ${day.isPast && !day.active ? 'past' : ''}`}>{day.name}</span>
              <span className={`day-date ${day.active ? 'active' : ''} ${day.isPast && !day.active ? 'past' : ''}`}>
                {day.date}
              </span>
              {day.isToday && !day.active && <span className="today-dot" />}
            </div>
          ))}
        </div>

        {/* Main Timeline — keyed for fade-in on date change */}
        <main ref={timelineRef} key={contentKey} className="timeline-area timeline-fade">

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
                  <div className="time-pill" data-block-id={block.id} style={{
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
                <div
                  className="tasks-col"
                  data-block-id={block.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnBlock(e, block.id)}
                >
                  {blockTodos.map(todo => {
                    const cType = todo.cardType || 'plain';
                    const cfg = cardTypeConfig[cType] || cardTypeConfig.plain;
                    const isVideo = cType === 'video';
                    const isMap = cType === 'map';
                    const isMeeting = cType === 'meeting';

                    let displayTitle = todo.text;
                    let displaySub = translations[language].actionItem;
                    let redirectUrl = null;

                    if (isVideo && todo.videoTitle) {
                      displayTitle = todo.videoTitle;
                      displaySub = todo.videoPlatform || 'Saved Video';
                      redirectUrl = todo.videoUrl;
                    } else if (isMap && todo.mapTitle) {
                      displayTitle = todo.mapTitle;
                      displaySub = todo.mapSubtitle || 'Location';
                      redirectUrl = todo.mapUrl;
                    } else if (isMeeting) {
                      // Extract just the time (e.g. "14:00", "9:00 AM") from the raw text
                      const timeMatch = todo.text.match(/\b(\d{1,2}:\d{2}(?:\s*[APap][Mm])?|\d{1,2}\s*[APap][Mm])\b/);
                      displaySub = timeMatch ? timeMatch[1].trim() : 'Video Call';
                      redirectUrl = todo.redirectUrl || null;
                      // Clean display title: strip URLs, date lines, metadata labels
                      displayTitle = todo.text
                        .split(/\n|　/)  // split on newlines or full-width space
                        .map(l => l.trim())
                        .filter(l =>
                          l.length > 0 &&
                          !/https?:\/\//i.test(l) &&               // remove URL lines
                          !/^開催日時|^開催方法|^date:|^time:|^method:/i.test(l) // remove label lines
                        )
                        .join(' ')
                        .replace(/https?:\/\/\S+/gi, '')           // remove any inline URLs
                        .replace(/\d{4}\/\d{2}\/\d{2}\s*\d{1,2}:\d{2}～?/g, '') // strip full datetime
                        .replace(/\s{2,}/g, ' ')
                        .trim() || todo.text;
                    } else if (isVideo && todo.videoUrl) {
                      redirectUrl = todo.videoUrl;
                    } else if (isMap && todo.mapUrl) {
                      redirectUrl = todo.mapUrl;
                    }

                    return (
                      <div key={todo.id} id={`swipe-wrapper-${todo.id}`} className="swipe-wrapper">
                        {/* Action buttons revealed behind the card */}
                        <div className="swipe-actions">
                          <button className="swipe-btn edit" onClick={() => openEdit(todo)}>
                            <img src="/edit.png" alt="Edit" className="swipe-icon" />
                          </button>
                          <button className="swipe-btn delete" onClick={() => deleteTodo(todo.id)}>
                            <img src="/delete.png" alt="Delete" className="swipe-icon" />
                          </button>
                        </div>

                        {/* The card itself */}
                        <div
                          id={`swipe-card-${todo.id}`}
                          className={`task-card ${todo.completed ? 'completed' : ''} ${draggedTodoId === todo.id ? 'dragging' : ''}`}
                          onClick={() => {
                            if (openSwipeId === todo.id) { closeSwipe(todo.id); return; }
                            if (redirectUrl) {
                              window.open(redirectUrl, '_blank', 'noopener,noreferrer');
                            } else {
                              toggleTodo(todo.id);
                            }
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, todo.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropOnTodo(e, todo)}
                          {...getSwipeHandlers(todo.id)}
                        >
                          <div
                            className="task-icon-placeholder"
                            style={{
                              backgroundColor: appearance === 'dark' ? cfg.darkBg : cfg.bg,
                              border: appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none'
                            }}
                          >
                            <img src={cfg.icon} alt={cType} className="task-card-icon" style={{ position: 'relative', zIndex: 10 }} />
                          </div>
                          <div className="task-content">
                            <span className="task-title">{displayTitle}</span>
                            <span className="task-desc">{displaySub}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </main>

        {/* Bottom Sheet Modal */}
        {isSheetOpen && (
          <div className="backdrop" onClick={() => setIsSheetOpen(false)}>
            <div
              className="bottom-sheet"
              onClick={(e) => e.stopPropagation()}
              style={sheetBaseHeight ? { height: `${sheetBaseHeight}px`, maxHeight: `${sheetBaseHeight}px` } : undefined}
            >
              <button className="sheet-close" onClick={() => setIsSheetOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M5.01417 5.01423C5.14308 4.88548 5.31782 4.81316 5.50001 4.81316C5.68219 4.81316 5.85693 4.88548 5.98584 5.01423L11 10.0284L16.0142 5.01423C16.0771 4.94668 16.153 4.8925 16.2373 4.85493C16.3217 4.81735 16.4127 4.79715 16.505 4.79552C16.5973 4.79389 16.689 4.81087 16.7746 4.84545C16.8602 4.88002 16.938 4.93149 17.0033 4.99677C17.0686 5.06206 17.12 5.13982 17.1546 5.22543C17.1892 5.31103 17.2062 5.40273 17.2045 5.49504C17.2029 5.58735 17.1827 5.67839 17.1451 5.76272C17.1076 5.84705 17.0534 5.92295 16.9858 5.98589L11.9717 11.0001L16.9858 16.0142C17.0534 16.0772 17.1076 16.1531 17.1451 16.2374C17.1827 16.3217 17.2029 16.4128 17.2045 16.5051C17.2062 16.5974 17.1892 16.6891 17.1546 16.7747C17.12 16.8603 17.0686 16.9381 17.0033 17.0033C16.938 17.0686 16.8602 17.1201 16.7746 17.1547C16.689 17.1892 16.5973 17.2062 16.505 17.2046C16.4127 17.203 16.3217 17.1828 16.2373 17.1452C16.153 17.1076 16.0771 17.0534 16.0142 16.9859L11 11.9717L5.98584 16.9859C5.85551 17.1073 5.68314 17.1734 5.50503 17.1703C5.32692 17.1672 5.15698 17.095 5.03102 16.969C4.90506 16.8431 4.8329 16.6731 4.82976 16.495C4.82662 16.3169 4.89273 16.1446 5.01417 16.0142L10.0283 11.0001L5.01417 5.98589C4.88543 5.85699 4.81311 5.68225 4.81311 5.50006C4.81311 5.31787 4.88543 5.14313 5.01417 5.01423Z" fill="black" />
                </svg>
              </button>
              <div className="sheet-content">
                <div
                  className={`sheet-main-stack ${keyboardLiftOffset > 0 ? 'input-active' : ''}`}
                  style={sheetContentLift > 0 ? { transform: `translateY(-${sheetContentLift}px)` } : undefined}
                >
                  {!isCalendarOpen && (
                    <div className="sheet-hero-icon">
                      <SheetPebbleIcon />
                    </div>
                  )}
                  <div className="sheet-title-row" onClick={() => {
                    setCalPickerDate(new Date(selectedDate));
                    setIsCalendarOpen(o => !o);
                  }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <h1 className="sheet-title" style={{ margin: 0, lineHeight: 1 }}><strong>{getRelativeWeekText()}</strong></h1>
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="16" viewBox="0 0 9 14" fill="none" className="sheet-title-icon" style={{ transform: isCalendarOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }}>
                      <path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="black" />
                    </svg>
                  </div>

                  {/* Inline calendar picker */}
                  <div className={`sheet-calendar-picker ${isCalendarOpen ? 'open' : ''}`}>
                    {(() => {
                      const today = getLogicalToday();
                      const minDate = today;
                      const maxDate = addDays(today, 30);
                      const isAtMinMonth = calPickerDate.getFullYear() === minDate.getFullYear() && calPickerDate.getMonth() === minDate.getMonth();
                      const isAtMaxMonth = calPickerDate.getFullYear() === maxDate.getFullYear() && calPickerDate.getMonth() === maxDate.getMonth();
                      return (
                        <div className="cal-picker-header">
                          <button className="cal-nav-btn" disabled={isAtMinMonth} onClick={e => { e.stopPropagation(); setCalPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; }); }}>
                            <svg width="7" height="12" viewBox="0 0 9 14" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M0.219809 7.45072C0.0790625 7.33113 0 7.16902 0 7C0 6.83098 0.0790625 6.66887 0.219809 6.54928L7.73599 0.171181C7.87847 0.0585185 8.06692 -0.00281603 8.26164 9.93682e-05C8.45636 0.00301477 8.64215 0.0699525 8.77986 0.18681C8.91757 0.303668 8.99645 0.461322 8.99988 0.626558C9.00332 0.791795 8.93104 0.951712 8.79827 1.07262L1.81324 7L8.79827 12.9274C8.93104 13.0483 9.00332 13.2082 8.99988 13.3734C8.99645 13.5387 8.91757 13.6963 8.77986 13.8132C8.64215 13.93 8.45636 13.997 8.26164 13.9999C8.06692 14.0028 7.87847 13.9415 7.73599 13.8288L0.219809 7.45072Z" fill="#111" /></svg>
                          </button>
                          <span className="cal-picker-month-label">{format(calPickerDate, 'MMM yyyy')}</span>
                          <button className="cal-nav-btn" disabled={isAtMaxMonth} onClick={e => { e.stopPropagation(); setCalPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; }); }}>
                            <svg width="7" height="12" viewBox="0 0 9 14" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="#111" /></svg>
                          </button>
                        </div>
                      );
                    })()}
                    <div className="cal-picker-grid">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <div key={i} className="cal-picker-dow">{d}</div>
                      ))}
                      {Array.from({ length: new Date(calPickerDate.getFullYear(), calPickerDate.getMonth(), 1).getDay() }).map((_, i) => (
                        <div key={`e${i}`} />
                      ))}
                      {(() => {
                        const today = getLogicalToday();
                        const minDate = today;
                        const maxDate = addDays(today, 30);
                        const year = calPickerDate.getFullYear();
                        const month = calPickerDate.getMonth();
                        const startOffset = new Date(year, month, 1).getDay();
                        const daysInMonth = new Date(year, month + 1, 0).getDate();
                        const trailingCells = 42 - startOffset - daysInMonth;
                        return Array.from({ length: daysInMonth }).map((_, i) => {
                          const day = i + 1;
                          const cellDate = new Date(year, month, day);
                          const isSelected = isSameDay(cellDate, selectedDate);
                          const isToday = isSameDay(cellDate, new Date());
                          const isInRange = cellDate >= minDate && cellDate <= maxDate;
                          return (
                            <button
                              key={day}
                              className={`cal-picker-day ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''} ${!isInRange ? 'out-of-range' : ''}`}
                              disabled={!isInRange}
                              onClick={e => { if (!isInRange) return; e.stopPropagation(); setSelectedDate(cellDate); setIsCalendarOpen(false); }}
                            >
                              {day}
                            </button>
                          );
                        }).concat(Array.from({ length: trailingCells > 0 ? trailingCells : 0 }).map((_, i) => <div key={`t${i}`} />));
                      })()}
                    </div>
                  </div>

                  {!isCalendarOpen && (
                    <>
                      <div className="section-label">
                        {appearance === 'dark' ? (
                          <img src="/timewhite.png" alt="Time" style={{ width: '14px', height: '14px' }} />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M9 4.5V9H12.375M15.75 9C15.75 9.88642 15.5754 10.7642 15.2362 11.5831C14.897 12.4021 14.3998 13.1462 13.773 13.773C13.1462 14.3998 12.4021 14.897 11.5831 15.2362C10.7642 15.5754 9.88642 15.75 9 15.75C8.11358 15.75 7.23583 15.5754 6.41689 15.2362C5.59794 14.897 4.85382 14.3998 4.22703 13.773C3.60023 13.1462 3.10303 12.4021 2.76381 11.5831C2.42459 10.7642 2.25 9.88642 2.25 9C2.25 7.20979 2.96116 5.4929 4.22703 4.22703C5.4929 2.96116 7.20979 2.25 9 2.25C10.7902 2.25 12.5071 2.96116 13.773 4.22703C15.0388 5.4929 15.75 7.20979 15.75 9Z" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {translations[language].timeOfDay}
                      </div>

                      <div className="chips-container">
                        {chipRows.map((row, rowIdx) => (
                          <div key={rowIdx} className="chips-row">
                            {row.map((chip) => (
                              <button
                                key={chip.id}
                                className={`chip ${activeChip === chip.id ? 'active' : ''}`}
                                onClick={() => setActiveChip(chip.id)}
                              >
                                {translations[language][chip.key]}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div
                className="sheet-input-area"
              >
                <div
                  className="composer-shell"
                  style={composerLift > 0 ? { transform: `translateY(-${composerLift}px)` } : undefined}
                >
                  <button
                    className={`mic-circle-btn ${isRecording ? 'recording' : ''}`}
                    onClick={startVoiceInput}
                    title={isRecording ? 'Stop recording' : 'Voice input'}
                  >
                    {isRecording ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                        <rect x="9" y="2" width="6" height="13" rx="3" />
                        <path d="M5 10a7 7 0 0 0 14 0" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="9" y1="22" x2="15" y2="22" />
                      </svg>
                    )}
                  </button>
                  <div className="input-wrapper">
                    <textarea
                      ref={taskInputRef}
                      className="task-input"
                      placeholder={translations[language].placeholder}
                      value={inputText}
                      rows={1}
                      onFocus={() => setIsTaskInputFocused(true)}
                      onBlur={() => setIsTaskInputFocused(false)}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddTodo();
                        }
                      }}
                    />
                    <button className="submit-btn" onClick={handleAddTodo}>
                      <ArrowUp size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {isProfileOpen && (
          <div className={`backdrop modal-backdrop ${isClosingProfile ? 'fade-out' : ''}`} onClick={(e) => {
            if (e.target.classList.contains('backdrop')) closeProfile();
          }}>
            <div 
              className={`profile-modal ${isClosingProfile ? 'panel-exit' : 'panel-enter'}`}
              onTouchStart={handleProfileTouchStart}
              onTouchMove={handleProfileTouchMove}
              onTouchEnd={handleProfileTouchEnd}
            >
              <button className="profile-close-btn" onClick={closeProfile}>
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
                  closeProfile();
                  if (supabase) {
                    await supabase.auth.signOut();
                  }
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
          <div className={`backdrop modal-backdrop ${isClosingSettings ? 'fade-out' : ''}`} onClick={(e) => {
            if (e.target.classList.contains('backdrop')) closeSettings();
          }}>
            <div 
              className={`settings-modal ${isClosingSettings ? 'panel-exit' : 'panel-enter'}`}
              onTouchStart={handleSettingsTouchStart}
              onTouchMove={handleSettingsTouchMove}
              onTouchEnd={handleSettingsTouchEnd}
            >
              <button className="settings-back-btn" onClick={closeSettings}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18L9 12L15 6" />
                </svg>
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
                      <span>{language === 'EN' ? 'EN' : language === 'ZH' ? '中文' : language === 'MS' ? 'MS' : language === 'JA' ? '日本語' : 'ไทย'}</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A0A4AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isLanguageDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                    {isLanguageDropdownOpen && (
                      <div className="language-dropdown-menu">
                        {['EN', 'ZH', 'MS', 'JA', 'TH'].map(lang => (
                          <div key={lang} className={`language-option ${language === lang ? 'selected' : ''}`} onClick={() => { setLanguage(lang); setIsLanguageDropdownOpen(false); }}>
                            <span>{lang === 'EN' ? 'EN' : lang === 'ZH' ? '中文' : lang === 'MS' ? 'MS' : lang === 'JA' ? '日本語' : 'ไทย'}</span>
                            {language === lang && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
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
                            <span>{mode === 'light' ? translations[language].light : translations[language].dark}</span>
                            {appearance === mode && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
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
        {/* Edit Todo Modal */}
        {editingTodo && (
          <div className="backdrop modal-backdrop" onClick={() => { setEditingTodo(null); setEditText(''); }}>
            <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
              <div className="edit-modal-header">
                <h2 className="edit-modal-title">Edit</h2>
                <button className="edit-modal-close" onClick={() => { setEditingTodo(null); setEditText(''); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="edit-modal-body">
                <textarea
                  className="edit-modal-textarea"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleEditSave();
                    }
                  }}
                  autoFocus
                  placeholder="Edit task..."
                />
                <button className="edit-modal-save-btn" onClick={handleEditSave}>
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
