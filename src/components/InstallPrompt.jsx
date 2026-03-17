import React, { useState, useEffect } from 'react';
import '../styles/InstallPrompt.css';

/**
 * InstallPrompt – intercepts the browser's `beforeinstallprompt` event and
 * provides a custom install button.  On iOS Safari it shows a text hint instead.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

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

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[InstallPrompt] User choice:', outcome);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Nothing to show
  if (dismissed || isStandalone) return null;

  // --- iOS fallback hint ---
  if (isIos && !isStandalone) {
    return (
      <div className="install-prompt install-prompt--ios">
        <button className="install-prompt__close" onClick={handleDismiss} aria-label="关闭">
          ×
        </button>
        <div className="install-prompt__ios-content">
          <img src="/logoreal.png" alt="IntoDay" className="install-prompt__icon" />
          <p className="install-prompt__ios-text">
            在 Safari 中点击底部中央的
            <span className="install-prompt__share-icon">
              {/* iOS share icon inline SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </span>
            分享按钮，选择「添加到主屏幕」即可安装 IntoDay。
          </p>
        </div>
      </div>
    );
  }

  // --- Android / Chrome install button ---
  if (!showInstallBtn) return null;

  return (
    <div className="install-prompt install-prompt--android">
      <button className="install-prompt__close" onClick={handleDismiss} aria-label="关闭">
        ×
      </button>
      <div className="install-prompt__content">
        <img src="/logoreal.png" alt="IntoDay" className="install-prompt__icon" />
        <div className="install-prompt__text">
          <strong>安装 IntoDay</strong>
          <span>添加到主屏幕，随时快捷访问</span>
        </div>
        <button className="install-prompt__btn" onClick={handleInstallClick}>
          安装
        </button>
      </div>
    </div>
  );
}
