import { useCallback, useEffect, useMemo, useState } from 'react';
import { getInitialLanguage, LANGUAGE_STORAGE_KEY } from '../../../lib/language';
import { trackUserEvent } from '../../../shared/lib/analytics';
import { translations } from '../../../shared/i18n/translations';
import { supabase } from '../../../supabase';
import { getUserProfile } from '../../../userProfile';

export const useDesktopSession = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpenState] = useState(false);
  const [language, setLanguage] = useState(getInitialLanguage);

  const setProfileOpen = useCallback((value) => {
    const open = Boolean(value);
    window.sessionStorage.setItem('shared_profile_open', String(open));
    setProfileOpenState(open);
  }, []);

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
    handleSignOut,
    language,
    loading,
    profileOpen,
    setLanguage,
    setProfileOpen,
    t,
    user,
    userProfile,
  };
};
