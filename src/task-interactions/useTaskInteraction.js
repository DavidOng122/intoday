import { useCallback, useMemo } from 'react';
import { createTaskEditActions } from './taskEditActions';
import {
  getTaskPrimaryActionType,
  getTaskSecondaryEditEntry,
  PRIMARY_ACTION_TYPES,
} from './taskInteractionRules';
import { resolveTaskUrl } from './taskUrlResolver';

const defaultOpenTaskUrl = (url) => {
  if (!url) return false;

  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(openedWindow) || typeof openedWindow === 'undefined';
};

export const useTaskInteraction = ({
  platform,
  openTaskEditor,
  openTaskUrl = defaultOpenTaskUrl,
}) => {
  const editActions = useMemo(
    () => createTaskEditActions({ openTaskEditor }),
    [openTaskEditor],
  );

  const getResolvedUrl = useCallback((task) => resolveTaskUrl(task), []);

  const getPrimaryActionType = useCallback((task) => {
    const resolvedUrl = resolveTaskUrl(task);

    return getTaskPrimaryActionType({
      task,
      hasResolvedUrl: Boolean(resolvedUrl),
    });
  }, []);

  const onEditAction = useCallback((task) => editActions.openTaskEditor(task), [editActions]);

  const onPrimaryAction = useCallback((task) => {
    const resolvedUrl = resolveTaskUrl(task);
    const primaryActionType = getTaskPrimaryActionType({
      task,
      hasResolvedUrl: Boolean(resolvedUrl),
    });

    if (primaryActionType === PRIMARY_ACTION_TYPES.OPEN && resolvedUrl) {
      const didOpenUrl = openTaskUrl(resolvedUrl, task);
      if (didOpenUrl) {
        return PRIMARY_ACTION_TYPES.OPEN;
      }
    }

    return editActions.openTaskEditor(task);
  }, [editActions, openTaskUrl]);

  const getSecondaryEditEntry = useCallback(
    () => getTaskSecondaryEditEntry(platform),
    [platform],
  );

  return {
    getPrimaryActionType,
    getResolvedUrl,
    getSecondaryEditEntry,
    onPrimaryAction,
    onEditAction,
  };
};
