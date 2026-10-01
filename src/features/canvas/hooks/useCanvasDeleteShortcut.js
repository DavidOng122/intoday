import { useEffect } from 'react';

const isEditableElement = (target) => (
  target instanceof HTMLElement
  // A marquee selection does not move keyboard focus to the Canvas. It can
  // therefore remain on a header button (for example, Inbox) after the user
  // closes it. Buttons and selects do not accept text, so they must not block
  // the Canvas Delete shortcut. Only text-editing surfaces and dialogs own it.
  && Boolean(target.closest('input, textarea, [contenteditable="true"], [role="dialog"]'))
);

export const useCanvasDeleteShortcut = ({
  activeGroupView,
  selectedTaskIdsRef,
  onRequestDeletion,
}) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableElement(event.target)) return;
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || activeGroupView) return;
      if (selectedTaskIdsRef.current.size === 0) return;

      event.preventDefault();
      onRequestDeletion([...selectedTaskIdsRef.current]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGroupView, onRequestDeletion, selectedTaskIdsRef]);
};
