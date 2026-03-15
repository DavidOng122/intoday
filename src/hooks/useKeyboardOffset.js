import { useEffect, useState } from 'react';

export default function useKeyboardOffset({
  enabled = false,
  baseHeight = 0,
  baseViewportHeight = 0,
  isAndroid = false,
  contentLiftStartOffset = 190,
}) {
  const [sheetKeyboardOffset, setSheetKeyboardOffset] = useState(0);

  useEffect(() => {
    if (!enabled || !baseViewportHeight) {
      setSheetKeyboardOffset(0);
      return undefined;
    }

    const updateKeyboardOffset = () => {
      const viewport = window.visualViewport;
      const visualViewportOffset = viewport
        ? Math.max(0, Math.round(baseViewportHeight - viewport.height - viewport.offsetTop))
        : 0;
      const virtualKeyboardOffset = navigator.virtualKeyboard?.boundingRect?.height
        ? Math.round(navigator.virtualKeyboard.boundingRect.height)
        : 0;

      setSheetKeyboardOffset(Math.max(visualViewportOffset, virtualKeyboardOffset));
    };

    updateKeyboardOffset();

    const viewport = window.visualViewport;
    const virtualKeyboard = navigator.virtualKeyboard;
    if (virtualKeyboard) {
      virtualKeyboard.overlaysContent = true;
    }

    viewport?.addEventListener('resize', updateKeyboardOffset);
    viewport?.addEventListener('scroll', updateKeyboardOffset);
    virtualKeyboard?.addEventListener('geometrychange', updateKeyboardOffset);

    return () => {
      viewport?.removeEventListener('resize', updateKeyboardOffset);
      viewport?.removeEventListener('scroll', updateKeyboardOffset);
      virtualKeyboard?.removeEventListener('geometrychange', updateKeyboardOffset);
    };
  }, [baseViewportHeight, enabled]);

  const keyboardLiftOffset = sheetKeyboardOffset > (isAndroid ? 0 : 120) ? sheetKeyboardOffset : 0;
  const composerLift = keyboardLiftOffset > 0
    ? Math.min(keyboardLiftOffset, Math.max(0, baseHeight - 170))
    : 0;
  const effectiveContentLiftStartOffset = Math.max(0, contentLiftStartOffset);
  const sheetContentLift = composerLift > effectiveContentLiftStartOffset
    ? composerLift - effectiveContentLiftStartOffset
    : 0;

  return {
    sheetKeyboardOffset,
    keyboardLiftOffset,
    composerLift,
    sheetContentLift,
  };
}
