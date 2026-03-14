import { useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import IntoDayLogo from './components/IntoDayLogo';
import './DesktopLogin.css';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="desktop-login__google-icon" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

function DesktopLogin() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) return;

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
      console.error('Login error:', error);
      setErrorMessage(error?.message || 'Unable to start Google sign-in.');
      setLoading(false);
    }
  };

  return (
    <div className="desktop-login">
      <header className="desktop-login__header">
        <IntoDayLogo
          className="desktop-login__brand"
          iconClassName="desktop-login__brand-icon"
          labelClassName="desktop-login__brand-label"
        />
      </header>

      <main className="desktop-login__main">
        <section className="desktop-login__panel" aria-label="Login introduction">
          <div className="desktop-login__hero-mark" aria-hidden="true">
            <img
              src="/stonereal-1.svg"
              alt="IntoDay illustration"
              className="desktop-login__hero-image"
            />
          </div>

          <h1 className="desktop-login__title">Pick up your day</h1>

          <p className="desktop-login__description">
            Sign in to keep today&apos;s things in one place.
          </p>

          <div className="desktop-login__actions">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || !isSupabaseConfigured}
              className="desktop-login__google-button"
            >
              {loading ? (
                <span className="desktop-login__spinner" aria-hidden="true" />
              ) : (
                <GoogleIcon />
              )}
              <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
            </button>

            {errorMessage && (
              <p className="desktop-login__status desktop-login__status--error">{errorMessage}</p>
            )}

            {!isSupabaseConfigured && (
              <p className="desktop-login__status desktop-login__status--warning">
                Supabase is not configured yet. Check your environment variables.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default DesktopLogin;
