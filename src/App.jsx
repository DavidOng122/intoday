/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
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
  const [loadingAuth, setLoadingAuth] = useState(true);

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

    supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!isActive) return;
        setSession(currentSession);
        setLoadingAuth(false);
        window.clearTimeout(timeout);
      })
      .catch((error) => {
        if (!isActive) return;
        console.error('Error fetching session:', error);
        setLoadingAuth(false);
        window.clearTimeout(timeout);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) return;
      setSession(nextSession);
      setLoadingAuth(false);

      if (nextSession?.user) {
        void identifyPostHogUser(nextSession.user);
      } else if (_event === 'SIGNED_OUT') {
        void resetPostHogUser();
      }
    });

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
      subscription?.unsubscribe();
    };
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
      {session ? <DesktopApp session={session} /> : <DesktopLoginPage />}
    </>
  );
}

export default App;
