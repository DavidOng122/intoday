import { useCallback, useRef } from 'react';

const SWIPE_CLOSE_THRESHOLD = 120;
const SWIPE_CLOSE_SETTLE_MS = 200;
const SWIPE_CLOSE_OFFSCREEN_PADDING = 120;
const SWIPE_CLOSE_TRANSITION = 'transform 0.25s ease-out';
const SWIPE_RESET_TRANSITION = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
const SWIPE_FREE_DRAG_DISTANCE = 18;
const SWIPE_DRAG_RESISTANCE = 0.92;
const centeredSwipeTransform = (offsetY = 0) => `translateX(-50%) translateY(${offsetY}px)`;

const getSwipeVisualOffset = (offsetY) => {
  if (offsetY <= 0) return 0;
  if (offsetY <= SWIPE_FREE_DRAG_DISTANCE) return offsetY;
  return SWIPE_FREE_DRAG_DISTANCE + ((offsetY - SWIPE_FREE_DRAG_DISTANCE) * SWIPE_DRAG_RESISTANCE);
};

const resolveSwipeScrollElement = (container, eventTarget, getScrollElement) => {
  if (!getScrollElement) return null;
  if (typeof getScrollElement === 'function') {
    return getScrollElement(container, eventTarget);
  }
  if (typeof getScrollElement === 'string') {
    const origin = eventTarget instanceof Element ? eventTarget.closest(getScrollElement) : null;
    return origin || container.querySelector(getScrollElement);
  }
  return getScrollElement;
};

export default function useSwipeDownToClose({
  enabled = true,
  onClose,
  baseTransform = centeredSwipeTransform,
  getScrollElement,
  ignoreSwipeFrom,
  getSwipeEndAction,
  onSwipeStart,
  onSwipeMove,
  threshold = SWIPE_CLOSE_THRESHOLD,
}) {
  const touchStartY = useRef(null);
  const currentOffsetY = useRef(0);
  const isSwiping = useRef(false);

  const resetSwipeState = useCallback(() => {
    touchStartY.current = null;
    currentOffsetY.current = 0;
    isSwiping.current = false;
  }, []);

  const shouldIgnoreSwipeTarget = useCallback((eventTarget) => {
    if (!ignoreSwipeFrom || !(eventTarget instanceof Element)) return false;
    if (typeof ignoreSwipeFrom === 'function') {
      return !!ignoreSwipeFrom(eventTarget);
    }
    if (typeof ignoreSwipeFrom === 'string') {
      return !!eventTarget.closest(ignoreSwipeFrom);
    }
    return false;
  }, [ignoreSwipeFrom]);

  const canSwipeFromTarget = useCallback((container, eventTarget) => {
    if (shouldIgnoreSwipeTarget(eventTarget)) return false;
    const scrollEl = resolveSwipeScrollElement(container, eventTarget, getScrollElement);
    return !(scrollEl && scrollEl.scrollTop > 0);
  }, [getScrollElement, shouldIgnoreSwipeTarget]);

  const restorePosition = useCallback((container) => {
    container.style.transition = SWIPE_RESET_TRANSITION;
    container.style.transform = baseTransform(0);
  }, [baseTransform]);

  const finishSwipe = useCallback((container) => {
    if (touchStartY.current === null || !isSwiping.current) return;

    const offsetY = currentOffsetY.current;
    const defaultAction = offsetY > threshold ? 'close' : 'reset';
    const swipeEndAction = getSwipeEndAction?.({
      container,
      offsetY,
      threshold,
    }) ?? defaultAction;

    if (swipeEndAction === 'close') {
      const offscreenY = Math.max(
        window.innerHeight,
        container.getBoundingClientRect().height + SWIPE_CLOSE_OFFSCREEN_PADDING,
      );
      container.style.transition = SWIPE_CLOSE_TRANSITION;
      container.style.transform = baseTransform(offscreenY);
      window.setTimeout(() => {
        onClose?.(true);
      }, SWIPE_CLOSE_SETTLE_MS);
    } else {
      restorePosition(container);
    }

    resetSwipeState();
  }, [baseTransform, getSwipeEndAction, onClose, resetSwipeState, restorePosition, threshold]);

  const handleTouchStart = useCallback((event) => {
    if (!enabled) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    const container = event.currentTarget;
    if (!canSwipeFromTarget(container, event.target)) {
      resetSwipeState();
      return;
    }

    container.style.animation = 'none';
    container.style.willChange = 'transform';
    container.style.transform = baseTransform(0);
    touchStartY.current = touch.clientY;
    currentOffsetY.current = 0;
    isSwiping.current = true;
    onSwipeStart?.({
      container,
      event,
    });
  }, [baseTransform, canSwipeFromTarget, enabled, onSwipeStart, resetSwipeState]);

  const handleTouchMove = useCallback((event) => {
    if (!enabled || touchStartY.current === null || !isSwiping.current) return;

    const container = event.currentTarget;
    if (!canSwipeFromTarget(container, event.target)) {
      restorePosition(container);
      resetSwipeState();
      return;
    }

    const touch = event.touches?.[0];
    if (!touch) return;

    const offsetY = touch.clientY - touchStartY.current;
    if (offsetY <= 0) return;

    currentOffsetY.current = offsetY;
    container.style.transition = 'none';
    container.style.transform = baseTransform(getSwipeVisualOffset(offsetY));
    onSwipeMove?.({
      container,
      event,
      offsetY,
    });

    if (event.cancelable) {
      event.preventDefault();
    }
  }, [baseTransform, canSwipeFromTarget, enabled, onSwipeMove, resetSwipeState, restorePosition]);

  const handleTouchEnd = useCallback((event) => {
    if (!enabled) return;
    finishSwipe(event.currentTarget);
  }, [enabled, finishSwipe]);

  const handleTouchCancel = useCallback((event) => {
    if (!enabled) return;
    finishSwipe(event.currentTarget);
  }, [enabled, finishSwipe]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };
}
