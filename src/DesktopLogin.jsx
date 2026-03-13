import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';

const Logo = ({ size = 'lg' }) => {
  const isLg = size === 'lg';
  return (
    <div className="flex items-center gap-2 lg:gap-3 cursor-default select-none">
      <div className={`relative ${isLg ? 'w-[32px] h-[18px] lg:w-[40px] lg:h-[22px]' : 'w-[32px] h-[18px] lg:w-[40px] lg:h-[22px]'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#FCE3C5] via-[#F3E7D9] to-[#E5E9F0] rounded-full -rotate-[12deg]"></div>
        <div className="absolute -top-[2px] -right-[2px] w-[10px] h-[10px] lg:w-[12px] lg:h-[12px] bg-[#111111] rounded-full"></div>
      </div>
      <span className="font-bold text-xl lg:text-2xl tracking-tight text-[#09090B] ml-1">IntoDay</span>
    </div>
  );
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const DesktopLogin = () => {
  const [loading, setLoading] = useState(false);
  const [clicked, setClicked] = useState(false);

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setClicked(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen bg-[#FDFDFD] text-[#09090B] flex flex-col relative overflow-hidden antialiased select-none" style={{ fontFamily: "'Inter', sans-serif" }}>
      <main className="flex-1 w-full flex flex-col items-start justify-center px-24 lg:px-48 max-w-7xl mx-auto">
        <header className="absolute top-16 lg:top-20 left-24 lg:left-48">
          <Logo />
        </header>

        <div className="flex flex-col items-start mt-12">
          <div className="relative w-[110px] h-[64px] lg:w-[140px] lg:h-[84px] mb-8 lg:mb-10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#FCE3C5] via-[#F3E7D9] to-[#E5E9F0] rounded-full -rotate-[12deg] shadow-[0_4px_20px_rgba(0,0,0,0.03)] opacity-90"></div>
            <div className="absolute top-[8px] right-[4px] lg:top-[12px] lg:right-[8px] w-[28px] h-[28px] lg:w-[38px] lg:h-[38px] bg-[#111111] rounded-full"></div>
          </div>

          <h1 className="text-[3.5rem] md:text-[4.5rem] lg:text-[5.5rem] font-bold leading-[1.0] tracking-[-0.04em] text-[#09090B] flex flex-col">
            <span>Organize</span>
            <span>your day</span>
          </h1>

          <div className="flex items-center mt-6 lg:mt-8 mb-24 lg:mb-32">
            <div className="w-24 lg:w-40 h-[1.5px] bg-[#E4E4E7] mr-6 lg:mr-10"></div>
            <span className="text-[2rem] md:text-[2.75rem] lg:text-[3.5rem] font-medium text-[#A1A1AA] tracking-[-0.025em] opacity-60">with ease</span>
          </div>

          <div className="w-full max-w-[340px] lg:max-w-[380px] mt-8">
            <button
              onClick={handleGoogleLogin}
              disabled={loading || !isSupabaseConfigured}
              className="flex items-center justify-center gap-3 bg-[#F4F4F5] hover:bg-[#E4E4E7] transition-all duration-300 rounded-full px-8 py-4 lg:py-5 w-full disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#3F3F46] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <div className="group-hover:scale-110 transition-transform duration-200">
                  <GoogleIcon />
                </div>
              )}
              <span className="text-[#3F3F46] font-medium text-sm lg:text-base ml-1">
                {loading ? 'Signing in...' : 'Continue with Google'}
              </span>
            </button>

            {clicked && !loading && (
              <p className="mt-4 text-xs text-[#A1A1AA] text-center w-full animate-in fade-in slide-in-from-top-1 duration-500">
                You've successfully signed in. Welcome to IntoDay!
              </p>
            )}

            {!isSupabaseConfigured && (
              <p className="mt-4 text-xs text-red-400 text-center w-full">
                Supabase not configured. Please check your environment variables.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DesktopLogin;