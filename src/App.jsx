import React, { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import usePlatform from './hooks/usePlatform';
import DesktopApp from './pages/DesktopApp';
import DesktopLoginPage from './pages/DesktopLoginPage';
import MobileApp from './pages/MobileApp';
import MobileLoginPage from './pages/MobileLoginPage';

const MobileAuthLoading = () => (
  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2F2F0' }}>
    <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTop: '3px solid #000', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
  </div>
);

const DesktopAuthLoading = () => (
  <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDFDFD', fontFamily: "'Inter', sans-serif" }}>
    <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #e53e3e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    <style>{'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'}</style>
  </div>
);

function App() {
  const platformInfo = usePlatform();
  const { isDesktop, platform, isNativePlatform } = platformInfo;
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

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
    });

    return () => {
      isActive = false;
      window.clearTimeout(timeout);
      subscription?.unsubscribe();
    };
  }, []);

  if (loadingAuth) {
    return isDesktop ? <DesktopAuthLoading /> : <MobileAuthLoading />;
  }

  if (isDesktop) {
    return session ? <DesktopApp session={session} /> : <DesktopLoginPage />;
  }

  if (!session) {
    return (
      <div className={`app-container platform-${platform} ${isNativePlatform ? 'native-shell' : 'web-shell'}`}>
        <MobileLoginPage platform={platform} />
      </div>
    );
  }

  return <MobileApp session={session} platformInfo={platformInfo} />;
}

export default App;
