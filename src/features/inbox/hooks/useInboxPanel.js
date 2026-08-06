import { useState, useCallback } from 'react';

export const useInboxPanel = () => {
  const [inboxOpen, setInboxOpen] = useState(false);

  const openInbox = useCallback(() => {
    setInboxOpen(true);
  }, []);

  const closeInbox = useCallback(() => {
    setInboxOpen(false);
  }, []);

  return {
    inboxOpen,
    openInbox,
    closeInbox,
  };
};
