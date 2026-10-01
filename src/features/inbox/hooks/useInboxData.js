import { useMemo } from 'react';
import {
  getInboxCount,
  getInboxItems,
  getInboxTargetPacks,
  getLibraryItems,
} from '../model/inboxLogic.js';

export const useInboxData = (activeWorkspaceTasks) => {
  const inboxItems = useMemo(
    () => getInboxItems(activeWorkspaceTasks),
    [activeWorkspaceTasks],
  );
  const inboxCount = useMemo(
    () => getInboxCount(activeWorkspaceTasks),
    [activeWorkspaceTasks],
  );
  const inboxTargetPacks = useMemo(
    () => getInboxTargetPacks(activeWorkspaceTasks),
    [activeWorkspaceTasks],
  );
  const libraryItems = useMemo(
    () => getLibraryItems(activeWorkspaceTasks),
    [activeWorkspaceTasks],
  );

  return {
    inboxItems,
    inboxCount,
    inboxTargetPacks,
    libraryItems,
  };
};
