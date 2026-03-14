import React, { useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigError } from '../lib/supabase';
import '../styles/desktop.css';

const BrandMark = () => (
  <div className="desktop-login-brand-mark" aria-hidden="true">
    <span className="desktop-login-brand-mark-shell" />
    <span className="desktop-login-brand-mark-core" />
  </div>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="desktop-login-google-icon" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const StatusMessage = ({ tone = 'neutral', children }) => (
  <div className={`desktop-login-message desktop-login-message-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    {children}
  </div>
);

const DesktopLoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  );

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured || !supabase) return;

    setLoading(true);
    setErrorMessage('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Desktop login error:', error);
      setErrorMessage(error?.message || 'Google sign-in could not be started. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="desktop-login-page">
      <div className="desktop-login-orb desktop-login-orb-amber" aria-hidden="true" />
      <div className="desktop-login-orb desktop-login-orb-blue" aria-hidden="true" />
      <div className="desktop-login-grid">
        <section className="desktop-login-hero">
          <div className="desktop-login-brand-row">
            <BrandMark />
            <div className="desktop-login-brand-copy">
              <span className="desktop-login-brand-name">IntoDay</span>
              <span className="desktop-login-brand-tag">Desktop planner</span>
            </div>
          </div>

          <div className="desktop-login-copy">
            <span className="desktop-login-kicker">Focus on the next thing, not the whole list.</span>
            <h1>Organize your day with a desktop login page that feels like the app.</h1>
            <p>
              Keep tasks, routines, and shared notes in one calm workspace. Sign in once and pick up
              your schedule across web and mobile.
            </p>
          </div>

          <div className="desktop-login-storyboard">
            <article className="desktop-login-preview-card desktop-login-preview-main">
              <div className="desktop-login-preview-head">
                <span className="desktop-login-preview-label">Today</span>
                <span className="desktop-login-preview-date">{todayLabel}</span>
              </div>
              <div className="desktop-login-preview-timeline">
                <div className="desktop-login-timeline-row">
                  <span className="desktop-login-timeline-time">08:00</span>
                  <span className="desktop-login-timeline-chip morning">Deep work</span>
                </div>
                <div className="desktop-login-timeline-row">
                  <span className="desktop-login-timeline-time">13:30</span>
                  <span className="desktop-login-timeline-chip afternoon">Class review</span>
                </div>
                <div className="desktop-login-timeline-row active">
                  <span className="desktop-login-timeline-time">18:00</span>
                  <span className="desktop-login-timeline-chip evening">Dinner plan</span>
                </div>
              </div>
            </article>

            <article className="desktop-login-preview-card desktop-login-preview-note">
              <span className="desktop-login-preview-label">Why desktop</span>
              <p>Wide layout, quick capture, and one-tap Google sign in for a smoother daily flow.</p>
            </article>
          </div>
        </section>

        <aside className="desktop-login-panel">
          <div className="desktop-login-card">
            <div className="desktop-login-card-top">
              <BrandMark />
              <span className="desktop-login-card-badge">Welcome back</span>
            </div>

            <div className="desktop-login-card-copy">
              <h2>Sign in to IntoDay</h2>
              <p>Use your Google account to sync your planner, settings, and saved tasks.</p>
            </div>

            <button
              type="button"
              className="desktop-login-google-button"
              onClick={handleGoogleLogin}
              disabled={loading || !isSupabaseConfigured}
            >
              <span className="desktop-login-google-badge">
                {loading ? <span className="desktop-login-spinner" aria-hidden="true" /> : <GoogleIcon />}
              </span>
              <span>{loading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
            </button>

            <div className="desktop-login-benefits">
              <div className="desktop-login-benefit">
                <span className="desktop-login-benefit-dot" />
                Secure OAuth sign-in
              </div>
              <div className="desktop-login-benefit">
                <span className="desktop-login-benefit-dot" />
                Same account across desktop and mobile
              </div>
              <div className="desktop-login-benefit">
                <span className="desktop-login-benefit-dot" />
                Fast access to your daily timeline
              </div>
            </div>

            {!isSupabaseConfigured && (
              <StatusMessage tone="error">{supabaseConfigError}</StatusMessage>
            )}

            {errorMessage && isSupabaseConfigured && (
              <StatusMessage tone="error">{errorMessage}</StatusMessage>
            )}

            {!errorMessage && isSupabaseConfigured && (
              <StatusMessage>Google will open in a new step, then return you to IntoDay.</StatusMessage>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DesktopLoginPage;
