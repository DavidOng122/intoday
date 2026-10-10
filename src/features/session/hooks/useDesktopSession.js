import { useCallback, useEffect, useMemo, useState } from 'react';
import { getInitialLanguage, LANGUAGE_STORAGE_KEY } from '../../../lib/language';
import { trackUserEvent } from '../../../shared/lib/analytics';
import { translations } from '../../../shared/i18n/translations';
import { supabase } from '../../../supabase';
import { getUserProfile } from '../../../userProfile';

export const useDesktopSession = ({ user }) => {
  const [profileOpen, setProfileOpenState] = useState(false);
  const [language, setLanguage] = useState(getInitialLanguage);

  const setProfileOpen = useCallback((value) => {
    const open = Boolean(value);
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
    if (user?.id) {
      trackUserEvent(user.id, 'app_opened', { platform: 'desktop' });
    }
  }, [user?.id]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  return {
    handleSignOut,
    language,
    profileOpen,
    setLanguage,
    setProfileOpen,
    t,
    userProfile,
  };
};
