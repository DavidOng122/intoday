import { useCallback, useEffect, useRef, useState } from 'react';

export const useQuickAdd = ({ onCreateItem, onImportFiles }) => {
  const [open, setOpen] = useState(false);
  const [composerKind, setComposerKind] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const rootRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerFrameRef = useRef(null);

  const cancelPendingComposer = useCallback(() => {
    if (composerFrameRef.current === null) return;
    window.cancelAnimationFrame(composerFrameRef.current);
    composerFrameRef.current = null;
  }, []);

  const close = useCallback(() => {
    cancelPendingComposer();
    setOpen(false);
    setComposerKind(null);
  }, [cancelPendingComposer]);

  useEffect(() => cancelPendingComposer, [cancelPendingComposer]);

  const openComposer = useCallback((kind) => {
    cancelPendingComposer();
    setOpen(false);
    // Let Radix finish closing the DropdownMenu before mounting another
    // focus-managed layer. Opening both in the same select event can make the
    // menu's dismiss/focus cleanup immediately close the new Popover.
    composerFrameRef.current = window.requestAnimationFrame(() => {
      composerFrameRef.current = null;
      setComposerKind(kind);
    });
  }, [cancelPendingComposer]);

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
