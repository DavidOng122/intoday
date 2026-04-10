import React, { useState, useEffect } from 'react';
import '../styles/InstallPrompt.css';

const translations = {
  en: {
    close: 'Close',
    ios_before: 'In Safari, tap the ',
    ios_after: ' share button at the bottom center, then select "Add to Home Screen" to install IntoDay.',
    android_title: 'Install IntoDay',
    android_subtitle: 'Add to Home Screen for quick access anytime',
    android_btn: 'Install'
  },
  zh: {
    close: '关闭',
    ios_before: '在 Safari 中点击底部中央的 ',
    ios_after: ' 分享按钮，选择「添加到主屏幕」即可安装 IntoDay。',
    android_title: '安装 IntoDay',
    android_subtitle: '添加到主屏幕，随时快捷访问',
    android_btn: '安装'
  },
  ms: {
    close: 'Tutup',
    ios_before: 'Di Safari, ketik ikon ',
    ios_after: ' di bahagian bawah tengah, dan pilih "Tambah ke Skrin Utama" untuk memasang IntoDay.',
    android_title: 'Pasang IntoDay',
    android_subtitle: 'Tambah ke skrin utama untuk akses cepat pada bila-bila masa',
    android_btn: 'Pasang'
  },
  th: {
    close: 'ปิด',
    ios_before: 'ใน Safari แตะปุ่ม ',
    ios_after: ' ที่ด้านล่างตรงกลาง และเลือก "เพิ่มไปยังหน้าจอโฮม" เพื่อติดตั้ง IntoDay',
    android_title: 'ติดตั้ง IntoDay',
    android_subtitle: 'เพิ่มไปยังหน้าจอโฮมเพื่อเข้าถึงได้อย่างรวดเร็วทุกเวลา',
    android_btn: 'ติดตั้ง'
  }
};

/**
 * InstallPrompt – intercepts the browser's `beforeinstallprompt` event and
 * provides a custom install button.  On iOS Safari it shows a text hint instead.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false); // Session only

  // Persistent dismiss state
  const [dismissState, setDismissState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('installPromptState');
      return saved ? JSON.parse(saved) : { manualCount: 0, lastTime: 0, type: 'auto' };
    }
    return { manualCount: 0, lastTime: 0, type: 'auto' };
  });

  // Get detected language or fallback to 'en'
  const userLang = (typeof navigator !== 'undefined' && navigator.language || 'en').toLowerCase().split('-')[0];
  const t = translations[userLang] || translations['en'];

  useEffect(() => {
    // --- iOS detection ---
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    const standalone =
      window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    setIsIos(iosDevice);
    setIsStandalone(standalone);

    // --- Android / Chrome: beforeinstallprompt ---
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleDismiss = (type = 'manual') => {
    setDismissed(true);
    const newState = {
      manualCount: dismissState.manualCount + (type === 'manual' ? 1 : 0),
      lastTime: Date.now(),
      type: type
    };
    setDismissState(newState);
    localStorage.setItem('installPromptState', JSON.stringify(newState));
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[InstallPrompt] User choice:', outcome);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  const isMob = isIos || (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent));

  const shouldShow = () => {
    if (isStandalone) return false;
    if (!dismissState.lastTime) return true;

    let days = 0;
    if (dismissState.type === 'manual') {
      if (isMob) {
        days = dismissState.manualCount >= 2 ? 14 : 7;
      } else {
        days = dismissState.manualCount >= 2 ? 30 : 14;
      }
    } else { // auto
      days = 1; // 1 day for both
    }

    const elapsed = Date.now() - dismissState.lastTime;
    return elapsed > days * 24 * 60 * 60 * 1000;
  };

  useEffect(() => {
    const canShow = (isIos && !isStandalone) || showInstallBtn;
    if (canShow && !dismissed && shouldShow()) {
      const timer = setTimeout(() => {
        handleDismiss('auto');
      }, isMob ? 4000 : 7000);
      return () => clearTimeout(timer);
    }
  }, [isIos, isStandalone, showInstallBtn, dismissed, dismissState]);

  // Nothing to show conditions
  if (dismissed || isStandalone || !shouldShow()) return null;

  // --- iOS fallback hint ---
  if (isIos && !isStandalone) {
    return (
      <div className="install-prompt install-prompt--ios">
        <button className="install-prompt__close" onClick={() => handleDismiss('manual')} aria-label={t.close}>
          ×
        </button>
        <div className="install-prompt__ios-content">
          <img src="/logoreal.png" alt="IntoDay" className="install-prompt__icon" />
          <p className="install-prompt__ios-text">
            {t.ios_before}
            <span className="install-prompt__share-icon">
              {/* iOS share icon inline SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </span>
            {t.ios_after}
          </p>
        </div>
      </div>
    );
  }

  // --- Android / Chrome install button ---
  if (!showInstallBtn) return null;

  return (
    <div className="install-prompt install-prompt--android">
      <button className="install-prompt__close" onClick={() => handleDismiss('manual')} aria-label={t.close}>
        ×
      </button>
      <div className="install-prompt__content">
        <img src="/logoreal.png" alt="IntoDay" className="install-prompt__icon" />
        <div className="install-prompt__text">
          <strong>{t.android_title}</strong>
          <span>{t.android_subtitle}</span>
        </div>
        <button className="install-prompt__btn" onClick={handleInstallClick}>
          {t.android_btn}
        </button>
      </div>
    </div>
  );
}
