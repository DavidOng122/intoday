import React, { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import DesktopApp from './pages/DesktopApp';
import DesktopLoginPage from './pages/DesktopLoginPage';
import { Analytics } from '@vercel/analytics/react';
import {
  identifyPostHogUser,
  initializePostHogWhenIdle,
  resetPostHogUser,
} from './shared/lib/posthogClient';

const DesktopAuthLoading = () => (
  <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDFDFD', fontFamily: "'Inter', sans-serif" }}>
    <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #e53e3e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    <style>{'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'}</style>
  </div>
);

function App() {
  const [session, setSession] = useState(null);
  const [sessionReadOnly, setSessionReadOnly] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const authCheckRef = useRef(0);

  useEffect(() => initializePostHogWhenIdle(), []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoadingAuth((pending) => {
        if (pending) console.warn('Auth session fetch timed out');
        return false;
      });
    }, 5000);

    if (!isSupabaseConfigured || !supabase) {
      setLoadingAuth(false);
      window.clearTimeout(timeout);
      return undefined;
    }

    let isActive = true;

    const hasTrustedLocalSession = (candidate) => (
      Boolean(
        candidate?.user?.id
        && typeof candidate.access_token === 'string'
        && candidate.access_token.length > 0
        && Number(candidate.expires_at) * 1000 > Date.now(),
      )
    );

    const verifySession = async (candidate) => {
      const checkId = ++authCheckRef.current;
      if (!candidate?.user?.id) {
        if (!isActive || checkId !== authCheckRef.current) return;
        setSession(null);
        setSessionReadOnly(false);
        setLoadingAuth(false);
        return;
      }

      if (window.navigator.onLine === false) {
        if (!isActive || checkId !== authCheckRef.current) return;
        if (hasTrustedLocalSession(candidate)) {
          setSession(candidate);
          setSessionReadOnly(true);
        } else {
          setSession(null);
          setSessionReadOnly(false);
        }
        setLoadingAuth(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getUser(candidate.access_token);
        if (!isActive || checkId !== authCheckRef.current) return;
        if (error || !data?.user?.id || data.user.id !== candidate.user.id) {
          if (error?.status === 401 || error?.status === 403) {
            setSession(null);
            setSessionReadOnly(false);
            void supabase.auth.signOut({ scope: 'local' });
          } else if (hasTrustedLocalSession(candidate)) {
            setSession(candidate);
            setSessionReadOnly(true);
          } else {
            setSession(null);
            setSessionReadOnly(false);
          }
        } else {
          setSession({ ...candidate, user: data.user });
          setSessionReadOnly(false);
          void identifyPostHogUser(data.user);
        }
      } catch (error) {
        if (!isActive || checkId !== authCheckRef.current) return;
        console.error('Unable to verify the saved authentication session:', error);
        if (hasTrustedLocalSession(candidate)) {
          setSession(candidate);
          setSessionReadOnly(true);
        } else {
          setSession(null);
          setSessionReadOnly(false);
        }
      } finally {
        if (isActive && checkId === authCheckRef.current) {
          setLoadingAuth(false);
          window.clearTimeout(timeout);
        }
      }
    };

    supabase.auth.getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (error) throw error;
        return verifySession(currentSession);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error('Error fetching session:', error);
        setSession(null);
        setSessionReadOnly(false);
        setLoadingAuth(false);
        window.clearTimeout(timeout);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isActive) return;
      if (event === 'SIGNED_OUT' || !nextSession) {
        authCheckRef.current += 1;
        setSession(null);
        setSessionReadOnly(false);
        setLoadingAuth(false);
        if (event === 'SIGNED_OUT') void resetPostHogUser();
        return;
      }
      window.setTimeout(() => {
        if (isActive) void verifySession(nextSession);
      }, 0);
    });

    const handleOnline = () => {
      void supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
        if (error) throw error;
        return verifySession(currentSession);
      }).catch((error) => {
        console.error('Unable to revalidate the authentication session:', error);
        setSessionReadOnly(true);
      });
    };
    const handleOffline = () => {
      void supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
        if (error) throw error;
        return verifySession(currentSession);
      }).catch((error) => {
        if (!isActive) return;
        console.error('Unable to read the saved authentication session while offline:', error);
        setSession(null);
        setSessionReadOnly(false);
      });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.expires_at) return undefined;
    const remaining = Number(session.expires_at) * 1000 - Date.now();
    if (remaining <= 0) {
      setSession(null);
      setSessionReadOnly(false);
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setSession(null);
      setSessionReadOnly(false);
    }, remaining);
    return () => window.clearTimeout(timeoutId);
  }, [session]);

  useEffect(() => {
    const handleVerificationFailure = (event) => {
      const status = event.detail?.status;
      if (status === 401 || status === 403) {
        setSession(null);
        setSessionReadOnly(false);
        void supabase?.auth?.signOut({ scope: 'local' });
        return;
      }
      setSessionReadOnly(true);
    };
    window.addEventListener('intoday:session-verification-required', handleVerificationFailure);
    return () => window.removeEventListener('intoday:session-verification-required', handleVerificationFailure);
  }, []);

  if (loadingAuth) {
    return (
      <>
        <Analytics />
        <DesktopAuthLoading />
      </>
    );
  }

  return (
    <>
      <Analytics />
      {session ? <DesktopApp key={session.user.id} session={session} readOnly={sessionReadOnly} /> : <DesktopLoginPage />}
    </>
  );
}

export default App;
