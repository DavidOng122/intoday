import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translations } from '../lib/translations';
import { getUserProfile } from '../userProfile';

const LANGUAGE_OPTIONS = [
  { value: 'EN', label: 'EN' },
  { value: 'ZH', label: '中文' },
  { value: 'MS', label: 'MS' },
  { value: 'JA', label: '日本語' },
  { value: 'TH', label: 'ไทย' },
];

const APPEARANCE_OPTIONS = ['light', 'dark'];

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 17.5C11.6625 17.4999 13.2779 16.9477 14.5925 15.93C15.9072 14.9124 16.8466 13.4869 17.2633 11.8775M10 17.5C8.33751 17.4999 6.72212 16.9477 5.40748 15.93C4.09284 14.9124 3.1534 13.4869 2.73667 11.8775M10 17.5C12.0708 17.5 13.75 14.1417 13.75 10C13.75 5.85833 12.0708 2.5 10 2.5M10 17.5C7.92917 17.5 6.25 14.1417 6.25 10C6.25 5.85833 7.92917 2.5 10 2.5M17.2633 11.8775C17.4175 11.2775 17.5 10.6483 17.5 10C17.5021 8.71009 17.1699 7.44166 16.5358 6.31833M17.2633 11.8775C15.041 13.1095 12.541 13.754 10 13.75C7.365 13.75 4.88917 13.0708 2.73667 11.8775M2.73667 11.8775C2.57896 11.2641 2.49944 10.6333 2.5 10C2.5 8.6625 2.85 7.40583 3.46417 6.31833M10 2.5C11.3302 2.49945 12.6366 2.8528 13.7852 3.5238C14.9337 4.19481 15.8831 5.15931 16.5358 6.31833M10 2.5C8.6698 2.49945 7.3634 2.8528 6.21484 3.5238C5.06628 4.19481 4.11692 5.15931 3.46417 6.31833M16.5358 6.31833C14.7214 7.88994 12.4004 8.75345 10 8.75C7.50167 8.75 5.21667 7.83333 3.46417 6.31833" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
    <path d="M12 2V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 20V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4.93 4.93L6.34 6.34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M17.66 17.66L19.07 19.07" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M2 12H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 12H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M4.93 19.07L6.34 17.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M17.66 6.34L19.07 4.93" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const HelpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52152 14.2151 8.06472C14.6713 8.60793 14.9211 9.29414 14.92 10.002C14.92 12.002 11.92 13.002 11.92 13.002" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 17H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SignOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M10 17L15 12L10 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 3H18C19.1046 3 20 3.89543 20 5V19C20 20.1046 19.1046 21 18 21H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const formatLanguageLabel = (language) => (
  LANGUAGE_OPTIONS.find((option) => option.value === language)?.label || 'EN'
);

const SettingsRow = ({
  icon,
  label,
  value,
  expanded,
  onClick,
  children,
}) => (
  <div className={`desktop-profile-setting ${expanded ? 'is-expanded' : ''}`}>
    <button type="button" className="desktop-profile-setting-trigger" onClick={onClick}>
      <span className="desktop-profile-setting-main">
        <span className="desktop-profile-setting-icon">{icon}</span>
        <span className="desktop-profile-setting-label">{label}</span>
      </span>
      <span className="desktop-profile-setting-end">
        <span className="desktop-profile-setting-value">{value}</span>
        <span className="desktop-profile-setting-chevron">
          <ChevronRightIcon />
        </span>
      </span>
    </button>
    {expanded ? <div className="desktop-profile-setting-panel">{children}</div> : null}
  </div>
);

function DesktopProfilePage({
  open,
  onClose,
  user,
  language,
  setLanguage,
  appearance,
  setAppearance,
  onSignOut,
}) {
  const [expandedSection, setExpandedSection] = useState(null);
  const contentRef = useRef(null);
  const profile = useMemo(() => getUserProfile(user), [user]);
  const t = translations[language] || translations.EN;
  const handleClose = useCallback(() => {
    setExpandedSection(null);
    onClose();
  }, [onClose]);
  const handlePageClick = useCallback((event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest('.desktop-profile-content, .desktop-profile-page-close')) {
      return;
    }

    const contentRect = contentRef.current?.getBoundingClientRect();
    if (!contentRect) {
      return;
    }

    const offsetX = contentRect.width * 0.5;
    const offsetY = contentRect.height * 0.3;
    const isBeyondContentBuffer = (
      event.clientX < contentRect.left - offsetX
      || event.clientX > contentRect.right + offsetX
      || event.clientY < contentRect.top - offsetY
      || event.clientY > contentRect.bottom + offsetY
    );

    if (isBeyondContentBuffer) {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className={`desktop-profile-page desktop-profile-page-${appearance}`} role="dialog" aria-modal="true" aria-labelledby="desktop-profile-title" onClick={handlePageClick}>
      <div className="desktop-profile-page-orb desktop-profile-page-orb-left" aria-hidden="true" />
      <div className="desktop-profile-page-orb desktop-profile-page-orb-right" aria-hidden="true" />

      <button type="button" className="desktop-profile-page-close" onClick={handleClose} aria-label={t.close}>
        <CloseIcon />
      </button>

      <div className="desktop-profile-stage">
        <div className="desktop-profile-content" ref={contentRef}>
          <div className="desktop-profile-header-block">
            <div className="desktop-profile-avatar-frame">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.fullName} className="desktop-profile-avatar-image" />
              ) : (
                <span className="desktop-profile-avatar-fallback">{profile.initial}</span>
              )}
            </div>
            <h2 className="desktop-profile-title" id="desktop-profile-title">
              {(profile.fullName || 'USER').toUpperCase()}
            </h2>
            <p className="desktop-profile-subtitle">{profile.email || ''}</p>
          </div>

          <div className="desktop-profile-card">
            <SettingsRow
              icon={<GlobeIcon />}
              label={t.language}
              value={formatLanguageLabel(language)}
              expanded={expandedSection === 'language'}
              onClick={() => setExpandedSection((current) => (current === 'language' ? null : 'language'))}
            >
              <div className="desktop-profile-choice-grid">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`desktop-profile-choice ${language === option.value ? 'is-active' : ''}`}
                    onClick={() => {
                      setLanguage(option.value);
                      setExpandedSection(null);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow
              icon={<SunIcon />}
              label={t.appearance}
              value={appearance === 'dark' ? t.dark : t.light}
              expanded={expandedSection === 'appearance'}
              onClick={() => setExpandedSection((current) => (current === 'appearance' ? null : 'appearance'))}
            >
              <div className="desktop-profile-choice-grid desktop-profile-choice-grid-compact">
                {APPEARANCE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`desktop-profile-choice ${appearance === option ? 'is-active' : ''}`}
                    onClick={() => {
                      setAppearance(option);
                      setExpandedSection(null);
                    }}
                  >
                    {option === 'dark' ? t.dark : t.light}
                  </button>
                ))}
              </div>
            </SettingsRow>
          </div>

          <div className="desktop-profile-card desktop-profile-card-single">
            <div className="desktop-profile-static-row">
              <span className="desktop-profile-setting-main">
                <span className="desktop-profile-setting-icon">
                  <HelpIcon />
                </span>
                <span className="desktop-profile-setting-label">{t.helpFeedback}</span>
              </span>
            </div>
          </div>

          <button type="button" className="desktop-profile-signout" onClick={() => {
            setExpandedSection(null);
            onSignOut();
          }}>
            <SignOutIcon />
            <span>{t.signOut}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default DesktopProfilePage;
