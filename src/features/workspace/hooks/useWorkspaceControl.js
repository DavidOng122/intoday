import { useCallback, useEffect, useRef, useState } from 'react';

export const useWorkspaceControl = ({
  activeWorkspace,
  defaultWorkspaceId,
  setActiveWorkspace,
}) => {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [isWorkspaceNameEditing, setIsWorkspaceNameEditing] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('');
  const workspaceNameInputRef = useRef(null);
  const workspaceControlRef = useRef(null);

  useEffect(() => {
    if (!isWorkspaceNameEditing) return undefined;
    const frameId = window.requestAnimationFrame(() => {
      workspaceNameInputRef.current?.focus();
      workspaceNameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isWorkspaceNameEditing]);

  const closeWorkspaceMenu = useCallback(() => {
    setWorkspaceMenuOpen(false);
  }, []);

  const toggleWorkspaceMenu = useCallback(() => {
    setWorkspaceMenuOpen((current) => !current);
  }, []);

  const changeWorkspaceNameDraft = useCallback((event) => {
    setWorkspaceNameDraft(event.target.value);
  }, []);

  const startWorkspaceRename = useCallback(() => {
    setWorkspaceNameDraft(activeWorkspace?.name || 'Untitled');
    setIsWorkspaceNameEditing(true);
  }, [activeWorkspace?.name]);

  const commitWorkspaceRename = useCallback(() => {
    const nextName = workspaceNameDraft.trim() || 'Untitled';
    setActiveWorkspace((current) => ({ ...current, id: defaultWorkspaceId, name: nextName }));
    setIsWorkspaceNameEditing(false);
  }, [defaultWorkspaceId, setActiveWorkspace, workspaceNameDraft]);

  const cancelWorkspaceRename = useCallback(() => {
    setWorkspaceNameDraft(activeWorkspace?.name || 'Untitled');
    setIsWorkspaceNameEditing(false);
  }, [activeWorkspace?.name]);

  const handleWorkspaceNameKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitWorkspaceRename();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelWorkspaceRename();
    }
  }, [cancelWorkspaceRename, commitWorkspaceRename]);

  const handleWorkspaceNameDoubleClick = useCallback((event) => {
    event.preventDefault();
    closeWorkspaceMenu();
    startWorkspaceRename();
  }, [closeWorkspaceMenu, startWorkspaceRename]);

  return {
    workspaceMenuOpen,
    isWorkspaceNameEditing,
    workspaceNameDraft,
    workspaceNameInputRef,
    workspaceControlRef,
    closeWorkspaceMenu,
    toggleWorkspaceMenu,
    changeWorkspaceNameDraft,
    startWorkspaceRename,
    commitWorkspaceRename,
    cancelWorkspaceRename,
    handleWorkspaceNameKeyDown,
    handleWorkspaceNameDoubleClick,
  };
};
