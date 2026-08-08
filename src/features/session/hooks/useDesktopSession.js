import { useCallback, useEffect, useMemo, useState } from 'react';
import { getInitialLanguage, LANGUAGE_STORAGE_KEY } from '../../../lib/language';
import { trackUserEvent } from '../../../shared/lib/analytics';
import { translations } from '../../../shared/i18n/translations';
import { supabase } from '../../../supabase';
import { getUserProfile } from '../../../userProfile';

const APPEARANCE_STORAGE_KEY = 'desktop_profile_appearance';

const normalizeAppearancePreference = (value) => (
  ['system', 'light', 'dark'].includes(value) ? value : 'light'
);

const getSystemAppearance = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getInitialAppearancePreference = () => {
  if (typeof window === 'undefined') return 'light';
  return normalizeAppearancePreference(window.localStorage.getItem(APPEARANCE_STORAGE_KEY));
};

export const useDesktopSession = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpenState] = useState(false);
  const [language, setLanguage] = useState(getInitialLanguage);
  const [appearancePreference, setAppearancePreference] = useState(getInitialAppearancePreference);
  const [systemAppearance, setSystemAppearance] = useState(getSystemAppearance);

  const setProfileOpen = useCallback((value) => {
    const open = Boolean(value);
    window.sessionStorage.setItem('shared_profile_open', String(open));
    setProfileOpenState(open);
  }, []);

  const appearance = appearancePreference === 'system' ? systemAppearance : appearancePreference;
  const t = useMemo(() => translations[language] || translations.EN, [language]);
  const userProfile = useMemo(() => getUserProfile(user), [user]);

  const handleSignOut = useCallback(async () => {
    try {
      await supabase?.auth?.signOut();
    } finally {
      setProfileOpen(false);
    }
  }, [setProfileOpen]);

  useEffect(() => {
    window.sessionStorage.setItem('shared_profile_open', 'false');
  }, []);

  useEffect(() => {
    if (user?.id) {
      trackUserEvent(user.id, 'app_opened', { platform: 'desktop' });
    }
  }, [user?.id]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearancePreference);
  }, [appearancePreference]);

  useEffect(() => {
    if (appearancePreference !== 'system' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateAppearance = () => setSystemAppearance(media.matches ? 'dark' : 'light');
    updateAppearance();
    media.addEventListener?.('change', updateAppearance);
    return () => media.removeEventListener?.('change', updateAppearance);
  }, [appearancePreference]);

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === APPEARANCE_STORAGE_KEY && event.newValue) {
        setAppearancePreference(normalizeAppearancePreference(event.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setLoading(false), 5000);
    if (!supabase) {
      setLoading(false);
      window.clearTimeout(timeoutId);
      return undefined;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      window.clearTimeout(timeoutId);
    }).catch(() => {
      setLoading(false);
      window.clearTimeout(timeoutId);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, []);

  return {
    appearance,
    appearancePreference,
    handleSignOut,
    language,
    loading,
    profileOpen,
    setAppearancePreference,
    setLanguage,
    setProfileOpen,
    t,
    user,
    userProfile,
  };
};
