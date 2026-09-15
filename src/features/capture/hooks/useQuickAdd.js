import { useCallback, useEffect, useRef, useState } from 'react';

export const useQuickAdd = ({ onCreateItem, onImportFiles }) => {
  const [open, setOpen] = useState(false);
  const [composerKind, setComposerKind] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const rootRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setComposerKind(null);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [close]);

  const openComposer = useCallback((kind) => {
    setOpen(false);
    setComposerKind(kind);
  }, []);

  const importFiles = useCallback(async (files) => {
    if (!files?.length || isImporting) return;
    setIsImporting(true);
    try {
      // Files selected from the Inbox Add menu must enter Inbox first, just
      // like a text or link capture. They are only placed on Canvas later.
      await onImportFiles?.(files, { destination: 'inbox' });
    } finally {
      setIsImporting(false);
      close();
    }
  }, [close, isImporting, onImportFiles]);

  const handleFileInputChange = useCallback(async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await importFiles(files);
  }, [importFiles]);

  const submitComposer = useCallback(async (value) => {
    await onCreateItem?.(value);
    close();
  }, [close, onCreateItem]);

  return {
    rootRef,
    imageInputRef,
    fileInputRef,
    open,
    setOpen,
    composerKind,
    isImporting,
    openComposer,
    close,
    submitComposer,
    handleFileInputChange,
  };
};
