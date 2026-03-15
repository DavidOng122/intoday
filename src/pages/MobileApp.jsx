import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ArrowUp, Maximize2, Minimize2, PenLine, Trash2 } from 'lucide-react';
import { subDays, addDays, format, isSameDay } from 'date-fns';
import { SendIntent } from 'send-intent';
import useKeyboardOffset from '../hooks/useKeyboardOffset';
import useSwipeDownToClose from '../hooks/useSwipeDownToClose';
import { useSyncedTodos } from '../todoSync';
import { supabase } from '../supabase';
import { DAY_BOUNDARY_HOUR, getCurrentTimeBlock, getLogicalToday } from '../lib/dateHelpers';
import { fetchMapMeta, fetchVideoMeta, getDerivedTaskFields, normalizeCardType } from '../lib/taskParsers';
import { getTaskCardPresentation } from '../taskCardUtils';
import { timeBlocks } from '../lib/timeBlocks';
import { translations } from '../lib/translations';
const SheetPebbleIcon = () => (
  <svg width="42" height="38" viewBox="0 0 42 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="21" cy="27.125" rx="21" ry="10.5" fill="url(#sheet_pebble_0)" />
    <ellipse cx="27.125" cy="19.25" rx="13.125" ry="7" fill="url(#sheet_pebble_1)" />
    <ellipse cx="21.875" cy="8.3125" rx="14.875" ry="8.3125" fill="url(#sheet_pebble_2)" />
    <defs>
      <linearGradient id="sheet_pebble_0" x1="21" y1="16.625" x2="21" y2="44.625" gradientUnits="userSpaceOnUse">
        <stop stopColor="#625F57" />
        <stop offset="1" stopColor="#C8C1B2" />
      </linearGradient>
      <linearGradient id="sheet_pebble_1" x1="27.125" y1="12.25" x2="27.125" y2="38.0625" gradientUnits="userSpaceOnUse">
        <stop stopColor="#707070" />
        <stop offset="1" />
      </linearGradient>
      <linearGradient id="sheet_pebble_2" x1="21.875" y1="0" x2="21.875" y2="24.9375" gradientUnits="userSpaceOnUse">
        <stop offset="0.182692" stopColor="#E6D2A8" />
        <stop offset="1" stopColor="#80755D" />
      </linearGradient>
    </defs>
  </svg>
);

const COMPOSER_MAX_LINES = 5;
const SHARED_SELECTED_DATE_KEY = 'shared_selected_date';
const DESKTOP_SECTION_TO_MOBILE_BLOCK = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};
const DAY_SWIPE_CONFIG = {
  INTENT_THRESHOLD_PX: 12,
  HORIZONTAL_LOCK_RATIO: 1.2,
  CHANGE_DAY_THRESHOLD_PX: 60,
  VELOCITY_THRESHOLD_PX_PER_MS: 0.45,
  DRAG_RESISTANCE: 0.35,
  MAX_DRAG_OFFSET_PX: 140,
  SWIPE_ANIMATION_DURATION_MS: 250,
  TAP_ANIMATION_DURATION_MS: 220,
};
const TOUCH_DRAG_LONG_PRESS_MS = 260;
const TOUCH_DRAG_CANCEL_DISTANCE = 10;
const TOUCH_DRAG_DAY_EDGE_HOLD_MS = 260;
const TOUCH_DRAG_DAY_FLIP_COOLDOWN_MS = 420;
const SWIPE_ACTION_MAX = 132;
const SWIPE_ACTION_OPEN = 108;
const SWIPE_ACTION_THRESHOLD = 44;
const DESKTOP_SLOT_COUNT = 4;
const SHEET_KEYBOARD_DISMISS_SWIPE_THRESHOLD = 72;
const SHEET_KEYBOARD_CLOSE_SWIPE_THRESHOLD = 240;
const INITIAL_EDIT_MODAL_VIEWPORT = {
  baseHeight: 0,
  visibleHeight: 0,
  offsetTop: 0,
  keyboardInset: 0,
};
const modalSwipeTransform = (offsetY = 0) => `translateY(${offsetY}px)`;
const findTouchByIdentifier = (touchList, identifier) => {
  if (!touchList || identifier === null || identifier === undefined) return null;

  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList[index];
    if (touch.identifier === identifier) {
      return touch;
    }
  }

  return null;
};
const parseSharedSelectedDate = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const isValidDesktopSlot = (value) => Number.isInteger(value) && value >= 0 && value < DESKTOP_SLOT_COUNT;
const normalizeTodoRecord = (todo) => {
  const derivedFields = getDerivedTaskFields(todo.text || '');

  return {
    ...derivedFields,
    ...todo,
    text: todo.text || '',
    completed: todo.completed ?? false,
    dateString: todo.dateString || format(new Date(), 'yyyy-MM-dd'),
    timeOfDay: todo.timeOfDay || DESKTOP_SECTION_TO_MOBILE_BLOCK[todo.section] || 'Morning',
    cardType: normalizeCardType(todo.cardType || derivedFields.cardType),
    desktopSlot: isValidDesktopSlot(todo.desktopSlot) ? todo.desktopSlot : null,
  };
};
const getBlockTodosInDisplayOrder = (todos, dateString, timeOfDay) => todos
  .map((todo, index) => ({ todo, index }))
  .filter(({ todo }) => todo.dateString === dateString && todo.timeOfDay === timeOfDay)
  .sort((a, b) => {
    const aSlot = isValidDesktopSlot(a.todo.desktopSlot) ? a.todo.desktopSlot : Number.POSITIVE_INFINITY;
    const bSlot = isValidDesktopSlot(b.todo.desktopSlot) ? b.todo.desktopSlot : Number.POSITIVE_INFINITY;
    return aSlot - bSlot || a.index - b.index;
  })
  .map(({ todo }) => todo);
const getFirstAvailableDesktopSlot = (todos, dateString, timeOfDay) => {
  const occupied = new Set(
    todos
      .filter((todo) => todo.dateString === dateString && todo.timeOfDay === timeOfDay && isValidDesktopSlot(todo.desktopSlot))
      .map((todo) => todo.desktopSlot),
  );

  for (let slot = 0; slot < DESKTOP_SLOT_COUNT; slot += 1) {
    if (!occupied.has(slot)) return slot;
  }
  return null;
};
const reflowDesktopSlotsForBlock = (todos, dateString, timeOfDay, orderedIds = null) => {
  const nextTodos = todos.map((todo) => ({ ...todo }));
  const currentOrderedBlockTodos = getBlockTodosInDisplayOrder(nextTodos, dateString, timeOfDay);
  const orderedBlockTodos = orderedIds
    ? [
      ...orderedIds
        .map((id) => nextTodos.find((todo) => todo.id === id && todo.dateString === dateString && todo.timeOfDay === timeOfDay))
        .filter(Boolean),
      ...currentOrderedBlockTodos.filter((todo) => !orderedIds.includes(todo.id)),
    ]
    : currentOrderedBlockTodos;

  orderedBlockTodos.forEach((todo, index) => {
    todo.desktopSlot = index < DESKTOP_SLOT_COUNT ? index : null;
  });

  let blockCursor = 0;
  const reorderedTodos = nextTodos.map((todo) => {
    if (todo.dateString === dateString && todo.timeOfDay === timeOfDay) {
      const nextTodo = orderedBlockTodos[blockCursor];
      blockCursor += 1;
      return nextTodo || todo;
    }
    return todo;
  });

  return reorderedTodos.map(normalizeTodoRecord);
};

function MobileApp({ session, platformInfo }) {
  const { platform, isNativePlatform, isIOS, isAndroid } = platformInfo;

  const getLogicalBlockBounds = useCallback((block, logicalDate) => {
    const baseDate = new Date(logicalDate);
    baseDate.setHours(0, 0, 0, 0);

    const [startHour, startMinute] = block.start.split(':').map(Number);
    const [endHour, endMinute] = block.end.split(':').map(Number);

    const blockStart = new Date(baseDate);
    blockStart.setHours(startHour, startMinute, 0, 0);
    if (startHour < DAY_BOUNDARY_HOUR) {
      blockStart.setDate(blockStart.getDate() + 1);
    }

    const blockEnd = new Date(baseDate);
    blockEnd.setHours(endHour, endMinute, 0, 0);
    if (blockEnd <= blockStart) {
      blockEnd.setDate(blockEnd.getDate() + 1);
    }

    return { blockStart, blockEnd };
  }, []);

  // Handle incoming share intent from other apps (YouTube, Instagram, etc.)
  useEffect(() => {
    const handleShareIntent = async () => {
      try {
        const result = await SendIntent.checkSendIntentReceived();
        if (result && (result.url || result.title || result.description)) {
          // Prefer URL, fallback to title or description
          const sharedText = result.url || result.title || result.description || '';
          if (sharedText) {
            setInputText(sharedText);
            setActiveChip(getCurrentTimeBlock());
            setIsSheetOpen(true);
          }
        }
      } catch (_) {
        // Not running in Capacitor (e.g. browser dev mode) — skip silently
      }
    };
    handleShareIntent();
  }, []);

  const [activeChip, setActiveChip] = useState('Morning');
  const [inputText, setInputText] = useState('');
  const [language, setLanguage] = useState('EN');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [appearance, setAppearance] = useState('light');
  const [isAppearanceDropdownOpen, setIsAppearanceDropdownOpen] = useState(false);
  const taskInputRef = useRef(null);
  const expandedTaskInputRef = useRef(null);
  const sheetLowerStackRef = useRef(null);
  const sheetPanelRef = useRef(null);
  const chipsContainerRef = useRef(null);
  const compactComposerRef = useRef(null);
  const [isTaskInputFocused, setIsTaskInputFocused] = useState(false);
  const [canExpandComposer, setCanExpandComposer] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [sheetBaseHeight, setSheetBaseHeight] = useState(null);
  const [sheetBaseViewportHeight, setSheetBaseViewportHeight] = useState(0);
  const [sheetContentLiftStartOffset, setSheetContentLiftStartOffset] = useState(190);
  const sheetContentLiftBaselineLockedRef = useRef(false);
  const sheetKeyboardDismissedDuringSwipeRef = useRef(false);
  const sheetSwipeStartedWithKeyboardOpenRef = useRef(false);

  useEffect(() => {
    const textarea = taskInputRef.current;
    if (!textarea || isComposerExpanded) return;
    const styles = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(styles.lineHeight) || 22;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    const borderTop = parseFloat(styles.borderTopWidth) || 0;
    const borderBottom = parseFloat(styles.borderBottomWidth) || 0;
    const maxHeight = Math.round(
      lineHeight * COMPOSER_MAX_LINES + paddingTop + paddingBottom + borderTop + borderBottom
    );

    textarea.style.height = '0px';
    const nextHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(nextHeight, maxHeight)}px`;
    textarea.style.overflowY = nextHeight > maxHeight ? 'auto' : 'hidden';
    setCanExpandComposer(nextHeight > maxHeight + 1);
  }, [inputText, isComposerExpanded]);

  const [selectedDate, setSelectedDate] = useState(() => {
    const savedDate = parseSharedSelectedDate(localStorage.getItem(SHARED_SELECTED_DATE_KEY));
    return savedDate || getLogicalToday();
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const selectedDateRef = useRef(selectedDate);

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClosingProfile, setIsClosingProfile] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calPickerDate, setCalPickerDate] = useState(() => getLogicalToday());
  const profileScrollRef = React.useRef(null);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    if (!isSheetOpen) {
      setIsTaskInputFocused(false);
      setCanExpandComposer(false);
      setIsComposerExpanded(false);
      setSheetBaseHeight(null);
      setSheetBaseViewportHeight(0);
      setSheetContentLiftStartOffset(190);
      sheetContentLiftBaselineLockedRef.current = false;
      return;
    }

    const baseViewportHeight = window.innerHeight;
    setSheetBaseViewportHeight(baseViewportHeight);
    setSheetBaseHeight(Math.min(760, Math.max(0, baseViewportHeight - 24)));
  }, [isSheetOpen]);

  useEffect(() => {
    if (!isSheetOpen) return;
    sheetContentLiftBaselineLockedRef.current = false;
  }, [isSheetOpen, isCalendarOpen, isComposerExpanded]);

  useEffect(() => {
    if (!isSheetOpen) return undefined;

    let frameA = 0;
    let frameB = 0;

    const focusTaskInput = () => {
      const textarea = taskInputRef.current;
      if (!textarea) return;

      try {
        textarea.focus({ preventScroll: true });
      } catch (_) {
        textarea.focus();
      }

      const caretPosition = textarea.value.length;
      try {
        textarea.setSelectionRange(caretPosition, caretPosition);
      } catch (_) {
        // Some mobile browsers do not allow selection updates on every focus.
      }
    };

    // Wait until the sheet is mounted and starts animating before focusing.
    frameA = window.requestAnimationFrame(() => {
      frameB = window.requestAnimationFrame(focusTaskInput);
    });

    return () => {
      window.cancelAnimationFrame(frameA);
      window.cancelAnimationFrame(frameB);
    };
  }, [isSheetOpen]);

  useEffect(() => {
    if (!isComposerExpanded) return undefined;

    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      const textarea = expandedTaskInputRef.current;
      if (!textarea) return;

      try {
        textarea.focus({ preventScroll: true });
      } catch (_) {
        textarea.focus();
      }

      const caretPosition = textarea.value.length;
      try {
        textarea.setSelectionRange(caretPosition, caretPosition);
      } catch (_) {
        // Some mobile browsers do not allow selection updates on every focus.
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [isComposerExpanded]);

  useEffect(() => {
    localStorage.setItem(SHARED_SELECTED_DATE_KEY, format(selectedDate, 'yyyy-MM-dd'));
  }, [selectedDate]);

  const { sheetKeyboardOffset, composerLift, sheetContentLift } = useKeyboardOffset({
    enabled: isSheetOpen,
    baseHeight: sheetBaseHeight,
    baseViewportHeight: sheetBaseViewportHeight,
    isAndroid,
    contentLiftStartOffset: sheetContentLiftStartOffset,
  });

  const measureSheetContentLiftStartOffset = useCallback(() => {
    const composerElement = compactComposerRef.current;
    const anchorElement = (!isCalendarOpen && chipsContainerRef.current)
      ? chipsContainerRef.current
      : sheetLowerStackRef.current;

    if (!composerElement || !anchorElement) return;

    const composerRect = composerElement.getBoundingClientRect();
    const anchorRect = anchorElement.getBoundingClientRect();
    const nextOffset = Math.max(0, Math.round(composerRect.top - anchorRect.bottom));

    sheetContentLiftBaselineLockedRef.current = true;
    setSheetContentLiftStartOffset((current) => (
      Math.abs(current - nextOffset) > 1 ? nextOffset : current
    ));
  }, [isCalendarOpen]);

  useLayoutEffect(() => {
    if (
      !isSheetOpen
      || isComposerExpanded
      || sheetKeyboardOffset > 0
      || sheetContentLiftBaselineLockedRef.current
    ) {
      return undefined;
    }

    let frame = window.requestAnimationFrame(measureSheetContentLiftStartOffset);

    const handleLayoutChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureSheetContentLiftStartOffset);
    };

    window.addEventListener('resize', handleLayoutChange);
    window.visualViewport?.addEventListener('resize', handleLayoutChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleLayoutChange);
      window.visualViewport?.removeEventListener('resize', handleLayoutChange);
    };
  }, [
    isSheetOpen,
    isComposerExpanded,
    isCalendarOpen,
    canExpandComposer,
    inputText,
    sheetKeyboardOffset,
    measureSheetContentLiftStartOffset,
  ]);
  const closeSheet = useCallback(() => {
    setIsCalendarOpen(false);
    setIsComposerExpanded(false);
    setIsSheetOpen(false);
  }, []);

  const dismissSheetKeyboard = useCallback(() => {
    setIsTaskInputFocused(false);

    const activeElement = document.activeElement;
    const composerInputs = [taskInputRef.current, expandedTaskInputRef.current].filter(Boolean);

    if (activeElement instanceof HTMLElement && activeElement.closest('.sheet-input-area')) {
      try {
        activeElement.blur();
      } catch (_) {
        // Ignore blur failures from mobile browsers that tightly control focus.
      }
    }

    composerInputs.forEach((input) => {
      if (input && input !== activeElement) {
        try {
          input.blur();
        } catch (_) {
          // Ignore blur failures from mobile browsers that tightly control focus.
        }
      }
    });

    try {
      navigator.virtualKeyboard?.hide?.();
    } catch (_) {
      // Some browsers expose the API without permitting imperative hides.
    }
  }, []);

  const handleSheetSwipeStart = useCallback(() => {
    sheetKeyboardDismissedDuringSwipeRef.current = false;
    sheetSwipeStartedWithKeyboardOpenRef.current = sheetKeyboardOffset > 0 || isTaskInputFocused;
  }, [isTaskInputFocused, sheetKeyboardOffset]);

  const handleSheetSwipeMove = useCallback(({ offsetY }) => {
    if (
      !sheetSwipeStartedWithKeyboardOpenRef.current
      || sheetKeyboardDismissedDuringSwipeRef.current
      || offsetY <= SHEET_KEYBOARD_DISMISS_SWIPE_THRESHOLD
    ) {
      return;
    }

    sheetKeyboardDismissedDuringSwipeRef.current = true;
    dismissSheetKeyboard();
  }, [dismissSheetKeyboard]);

  const handleSheetSwipeEndAction = useCallback(({ offsetY }) => {
    const startedWithKeyboardOpen = sheetSwipeStartedWithKeyboardOpenRef.current;

    if (!startedWithKeyboardOpen) {
      return undefined;
    }

    if (offsetY > SHEET_KEYBOARD_CLOSE_SWIPE_THRESHOLD) {
      if (!sheetKeyboardDismissedDuringSwipeRef.current) {
        dismissSheetKeyboard();
      }
      return 'close';
    }

    if (offsetY > SHEET_KEYBOARD_DISMISS_SWIPE_THRESHOLD && !sheetKeyboardDismissedDuringSwipeRef.current) {
      dismissSheetKeyboard();
    }

    return 'reset';
  }, [dismissSheetKeyboard]);

  const openQuickAdd = useCallback(() => {
    setIsSheetOpen(true);
  }, []);

  const resetProfilePanel = () => {
    setIsLanguageDropdownOpen(false);
    setIsAppearanceDropdownOpen(false);
    if (profileScrollRef.current) {
      profileScrollRef.current.scrollTop = 0;
    }
  };

  const openProfilePanel = () => {
    resetProfilePanel();
    setIsClosingProfile(false);
    setIsProfileOpen(true);
  };

  const closeProfile = (isSwipe = false) => {
    if (isSwipe) {
      setIsProfileOpen(false);
      setIsClosingProfile(false);
      resetProfilePanel();
      return;
    }
    setIsClosingProfile(true);
    setTimeout(() => {
      setIsProfileOpen(false);
      setIsClosingProfile(false);
      resetProfilePanel();
    }, 250);
  };

  // ── Android Back Button (PWA) ──────────────────────────────────────────────
  // When any overlay is open we push a dummy history entry so the Android
  // hardware back-button fires `popstate` instead of closing the whole app.
  const [editingTodo, setEditingTodo] = useState(null);
  const [editText, setEditText] = useState('');
  const editModalBodyRef = useRef(null);
  const editTextareaRef = useRef(null);
  const editViewportBaseHeightRef = useRef(0);
  const [editModalViewport, setEditModalViewport] = useState(INITIAL_EDIT_MODAL_VIEWPORT);
  const [isEditTextareaFocused, setIsEditTextareaFocused] = useState(false);
  const closeEditModal = useCallback(() => {
    setEditingTodo(null);
    setEditText('');
    setIsEditTextareaFocused(false);
  }, []);


  const sheetSwipeHandlers = useSwipeDownToClose({
    enabled: isSheetOpen,
    onClose: closeSheet,
    getScrollElement: '.sheet-content',
    ignoreSwipeFrom: '.sheet-input-area',
    onSwipeStart: handleSheetSwipeStart,
    onSwipeMove: handleSheetSwipeMove,
    getSwipeEndAction: handleSheetSwipeEndAction,
  });

  useEffect(() => {
    if (!isSheetOpen || !isIOS) return undefined;

    const sheetElement = sheetPanelRef.current;
    if (!sheetElement) return undefined;
    const htmlElement = document.documentElement;
    const bodyElement = document.body;
    const rootElement = document.getElementById('root');
    const scrollY = window.scrollY;
    const previousHtmlOverscrollBehavior = htmlElement.style.overscrollBehavior;
    const previousHtmlOverflow = htmlElement.style.overflow;
    const previousBodyOverscrollBehavior = bodyElement.style.overscrollBehavior;
    const previousBodyOverflow = bodyElement.style.overflow;
    const previousBodyPosition = bodyElement.style.position;
    const previousBodyTop = bodyElement.style.top;
    const previousBodyLeft = bodyElement.style.left;
    const previousBodyRight = bodyElement.style.right;
    const previousBodyWidth = bodyElement.style.width;
    const previousBodyTouchAction = bodyElement.style.touchAction;
    const previousRootOverflow = rootElement?.style.overflow ?? '';
    const previousRootTouchAction = rootElement?.style.touchAction ?? '';

    htmlElement.style.overscrollBehavior = 'none';
    htmlElement.style.overflow = 'hidden';
    bodyElement.style.overscrollBehavior = 'none';
    bodyElement.style.overflow = 'hidden';
    bodyElement.style.position = 'fixed';
    bodyElement.style.top = `-${scrollY}px`;
    bodyElement.style.left = '0';
    bodyElement.style.right = '0';
    bodyElement.style.width = '100%';
    bodyElement.style.touchAction = 'none';

    if (rootElement) {
      rootElement.style.overflow = 'hidden';
      rootElement.style.touchAction = 'none';
    }

    let touchStartY = 0;

    const resolveScrollableElement = (eventTarget) => {
      if (!(eventTarget instanceof Element)) return null;
      return eventTarget.closest('.sheet-content, .task-input, .expanded-task-input');
    };

    const handleTouchStart = (event) => {
      const touch = event.touches?.[0];
      touchStartY = touch ? touch.clientY : 0;
    };

    const handleTouchMove = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;

      if (!(event.target instanceof Node) || !sheetElement.contains(event.target)) {
        event.preventDefault();
        return;
      }

      const scrollableElement = resolveScrollableElement(event.target);
      if (!scrollableElement) {
        event.preventDefault();
        return;
      }

      const deltaY = touch.clientY - touchStartY;
      const canScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;

      if (!canScroll) {
        event.preventDefault();
        return;
      }

      const scrollTop = scrollableElement.scrollTop;
      const maxScrollTop = scrollableElement.scrollHeight - scrollableElement.clientHeight;
      const isPullingPastTop = scrollTop <= 0 && deltaY > 0;
      const isPushingPastBottom = scrollTop >= maxScrollTop && deltaY < 0;

      if (isPullingPastTop || isPushingPastBottom) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      document.removeEventListener('touchmove', handleTouchMove, { capture: true });
      window.removeEventListener('touchmove', handleTouchMove, { capture: true });
      htmlElement.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      htmlElement.style.overflow = previousHtmlOverflow;
      bodyElement.style.overscrollBehavior = previousBodyOverscrollBehavior;
      bodyElement.style.overflow = previousBodyOverflow;
      bodyElement.style.position = previousBodyPosition;
      bodyElement.style.top = previousBodyTop;
      bodyElement.style.left = previousBodyLeft;
      bodyElement.style.right = previousBodyRight;
      bodyElement.style.width = previousBodyWidth;
      bodyElement.style.touchAction = previousBodyTouchAction;
      if (rootElement) {
        rootElement.style.overflow = previousRootOverflow;
        rootElement.style.touchAction = previousRootTouchAction;
      }
      window.scrollTo(0, scrollY);
    };
  }, [isIOS, isSheetOpen]);
  const profileSwipeHandlers = useSwipeDownToClose({
    enabled: isProfileOpen && isIOS,
    onClose: () => closeProfile(true),
    baseTransform: modalSwipeTransform,
    getScrollElement: '.profile-scroll',
  });
  const editSwipeHandlers = useSwipeDownToClose({
    enabled: !!editingTodo,
    onClose: closeEditModal,
    baseTransform: modalSwipeTransform,
    ignoreSwipeFrom: '.edit-modal-textarea',
    getScrollElement: (container, eventTarget) => {
      if (!(eventTarget instanceof Element)) {
        return container.querySelector('.edit-modal-body');
      }

      return eventTarget.closest('.edit-modal-textarea')
        || eventTarget.closest('.edit-modal-body')
        || container.querySelector('.edit-modal-body');
    },
  });


  const anyOverlayOpen =
    isSheetOpen || isProfileOpen ||
    isCalendarOpen || !!editingTodo;

  useEffect(() => {
    if (anyOverlayOpen) {
      // Push a state so the back gesture has somewhere to go back TO.
      window.history.pushState({ modal: true }, '');
    }
  }, [anyOverlayOpen]);

  useEffect(() => {
    const handlePopState = () => {
      // Close overlays from top (most-modal) to bottom
      if (editingTodo) { closeEditModal(); return; }
      if (isProfileOpen) { closeProfile(true); return; }
      if (isCalendarOpen) { setIsCalendarOpen(false); return; }
      if (isSheetOpen) { closeSheet(); return; }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [closeEditModal, closeProfile, closeSheet, editingTodo, isProfileOpen, isCalendarOpen, isSheetOpen]);
  // ─────────────────────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    if (!editingTodo) {
      editViewportBaseHeightRef.current = 0;
      setEditModalViewport(INITIAL_EDIT_MODAL_VIEWPORT);
      return undefined;
    }

    const viewport = window.visualViewport;
    const virtualKeyboard = navigator.virtualKeyboard;
    const initialViewportHeight = Math.max(
      window.innerHeight,
      viewport ? Math.round(viewport.height + viewport.offsetTop) : 0,
    );

    editViewportBaseHeightRef.current = initialViewportHeight;

    const updateEditViewport = () => {
      const nextViewport = window.visualViewport;
      const offsetTop = nextViewport ? Math.round(nextViewport.offsetTop) : 0;
      const visibleHeight = nextViewport ? Math.round(nextViewport.height) : window.innerHeight;
      const virtualKeyboardInset = virtualKeyboard?.boundingRect?.height
        ? Math.round(virtualKeyboard.boundingRect.height)
        : 0;

      if (!virtualKeyboardInset && visibleHeight + offsetTop > editViewportBaseHeightRef.current) {
        editViewportBaseHeightRef.current = visibleHeight + offsetTop;
      }

      const baseHeight = editViewportBaseHeightRef.current || (visibleHeight + offsetTop);
      const visualViewportInset = nextViewport
        ? Math.max(0, Math.round(baseHeight - visibleHeight - offsetTop))
        : 0;
      const keyboardInset = Math.max(visualViewportInset, virtualKeyboardInset);

      setEditModalViewport((current) => {
        if (
          current.baseHeight === baseHeight
          && current.visibleHeight === visibleHeight
          && current.offsetTop === offsetTop
          && current.keyboardInset === keyboardInset
        ) {
          return current;
        }

        return {
          baseHeight,
          visibleHeight,
          offsetTop,
          keyboardInset,
        };
      });
    };

    updateEditViewport();
    if (virtualKeyboard) {
      virtualKeyboard.overlaysContent = true;
    }

    viewport?.addEventListener('resize', updateEditViewport);
    viewport?.addEventListener('scroll', updateEditViewport);
    virtualKeyboard?.addEventListener('geometrychange', updateEditViewport);
    window.addEventListener('orientationchange', updateEditViewport);

    return () => {
      viewport?.removeEventListener('resize', updateEditViewport);
      viewport?.removeEventListener('scroll', updateEditViewport);
      virtualKeyboard?.removeEventListener('geometrychange', updateEditViewport);
      window.removeEventListener('orientationchange', updateEditViewport);
    };
  }, [editingTodo]);

  const scrollEditTextareaIntoView = useCallback((behavior = 'smooth') => {
    const textarea = editTextareaRef.current;
    const scrollContainer = editModalBodyRef.current;
    if (!textarea || !scrollContainer) return;

    textarea.scrollIntoView({
      behavior,
      block: 'nearest',
      inline: 'nearest',
    });

    const textareaRect = textarea.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const upperPadding = 12;
    const lowerPadding = 18;

    if (textareaRect.top < containerRect.top + upperPadding) {
      scrollContainer.scrollTop += textareaRect.top - containerRect.top - upperPadding;
    } else if (textareaRect.bottom > containerRect.bottom - lowerPadding) {
      scrollContainer.scrollTop += textareaRect.bottom - containerRect.bottom + lowerPadding;
    }
  }, []);

  useEffect(() => {
    if (!editingTodo || !isEditTextareaFocused) return undefined;

    const frame = window.requestAnimationFrame(() => {
      scrollEditTextareaIntoView(editModalViewport.keyboardInset > 0 ? 'auto' : 'smooth');
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    editModalViewport.keyboardInset,
    editModalViewport.offsetTop,
    editModalViewport.visibleHeight,
    editingTodo,
    isEditTextareaFocused,
    scrollEditTextareaIntoView,
  ]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [isCoarsePointer, setIsCoarsePointer] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });
  const [daySwipeOffset, setDaySwipeOffset] = useState(0);
  const [dayTransition, setDayTransition] = useState(null);
  const [directDayFlipDirection, setDirectDayFlipDirection] = useState(null);
  const stripRef = React.useRef(null);
  const timelineShellRef = React.useRef(null);
  const dayRefs = React.useRef({});
  const timelineRef = React.useRef(null);
  const overlayLabelRef = React.useRef(null);
  const secondaryOverlayLabelRefs = React.useRef({});
  const overlayUpdateFrameRef = React.useRef(null);
  const timelineLabelsVisibleRef = React.useRef(false);
  const timelineLabelsHideTimeoutRef = React.useRef(null);
  const timelineTouchActiveRef = React.useRef(false);
  const currentOverlayBlockIdRef = React.useRef(null);
  const [overlayBlockId, setOverlayBlockId] = useState(null);
  const [secondaryOverlayBlockIds, setSecondaryOverlayBlockIds] = useState([]);
  const dayScrollPositionsRef = React.useRef({});
  const hasAutoScrolledToTodayRef = React.useRef(false);
  // Scroll behavior is explicit so initial Today entry and date-selection
  // transitions can each do the right thing.
  const pendingTimelineScrollActionRef = React.useRef({
    type: 'initial-today',
    scrollTop: null,
    behavior: 'auto',
  });
  const transitionTimeoutRef = React.useRef(null);
  const directDayFlipTimeoutRef = React.useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updatePointerMode = () => setIsCoarsePointer(mediaQuery.matches);
    updatePointerMode();
    mediaQuery.addEventListener?.('change', updatePointerMode);
    return () => mediaQuery.removeEventListener?.('change', updatePointerMode);
  }, []);

  useEffect(() => () => {
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    if (overlayUpdateFrameRef.current) {
      window.cancelAnimationFrame(overlayUpdateFrameRef.current);
    }
    if (timelineLabelsHideTimeoutRef.current) {
      window.clearTimeout(timelineLabelsHideTimeoutRef.current);
    }
  }, []);

  const hideTimelineLabels = useCallback(() => {
    timelineLabelsVisibleRef.current = false;
    currentOverlayBlockIdRef.current = null;
    setSecondaryOverlayBlockIds([]);
    if (overlayLabelRef.current) {
      overlayLabelRef.current.style.opacity = '0';
      overlayLabelRef.current.style.transform = 'translate3d(-50%, -9999px, 0)';
      overlayLabelRef.current.style.zIndex = '30';
    }
    Object.values(secondaryOverlayLabelRefs.current).forEach((labelEl) => {
      labelEl.style.opacity = '0';
      labelEl.style.transform = 'translate3d(-50%, -9999px, 0)';
    });
  }, []);

  const refreshVisibleTimeBlockLabels = useCallback(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) {
      return;
    }

    if (!timelineLabelsVisibleRef.current) {
      hideTimelineLabels();
      return;
    }

    const scrollTop = timelineEl.scrollTop;
    const viewportHeight = timelineEl.clientHeight;
    const overlayOffset = 12;
    const switchBuffer = 2;
    const blockDescriptors = [];
    let nextOverlayBlockId = null;

    timelineEl.querySelectorAll('.time-block[data-overlay-source="true"]').forEach((blockEl) => {
      const blockId = blockEl.dataset.timeBlockId;
      if (!blockId) return;

      const blockTop = blockEl.offsetTop;
      const blockBottom = blockTop + blockEl.offsetHeight;
      if (blockBottom <= scrollTop || blockTop >= scrollTop + viewportHeight) return;

      blockDescriptors.push({ id: blockId, top: blockTop, bottom: blockBottom });
    });

    blockDescriptors.sort((a, b) => a.top - b.top);

    if (blockDescriptors.length > 0) {
      nextOverlayBlockId = blockDescriptors[0].id;

      for (const descriptor of blockDescriptors) {
        if (descriptor.top - scrollTop <= overlayOffset + switchBuffer) {
          nextOverlayBlockId = descriptor.id;
        } else {
          break;
        }
      }
    }

    const nextSecondaryOverlayBlockIds = blockDescriptors
      .filter((descriptor) => descriptor.id !== nextOverlayBlockId)
      .map((descriptor) => descriptor.id);

    if (currentOverlayBlockIdRef.current !== nextOverlayBlockId) {
      currentOverlayBlockIdRef.current = nextOverlayBlockId;
      setOverlayBlockId(nextOverlayBlockId);
    }

    setSecondaryOverlayBlockIds((current) => {
      if (
        current.length === nextSecondaryOverlayBlockIds.length
        && current.every((id, index) => id === nextSecondaryOverlayBlockIds[index])
      ) {
        return current;
      }

      return nextSecondaryOverlayBlockIds;
    });

    if (overlayLabelRef.current) {
      overlayLabelRef.current.style.opacity = nextOverlayBlockId ? '0.96' : '0';
      overlayLabelRef.current.style.transform = nextOverlayBlockId
        ? `translate3d(-50%, ${overlayOffset}px, 0)`
        : 'translate3d(-50%, -9999px, 0)';
      overlayLabelRef.current.style.zIndex = '30';
    }

    const secondaryDescriptors = blockDescriptors.filter((descriptor) => descriptor.id !== nextOverlayBlockId);

    secondaryDescriptors.forEach((descriptor, index) => {
      if (descriptor.id === nextOverlayBlockId) return;

      const labelEl = secondaryOverlayLabelRefs.current[descriptor.id];
      if (!labelEl) return;

      const y = descriptor.top - scrollTop + overlayOffset;
      labelEl.style.opacity = '0.9';
      labelEl.style.transform = `translate3d(-50%, ${y}px, 0)`;
      labelEl.style.zIndex = `${20 - index}`;
    });

    Object.entries(secondaryOverlayLabelRefs.current).forEach(([blockId, labelEl]) => {
      if (blockId === nextOverlayBlockId || !nextSecondaryOverlayBlockIds.includes(blockId)) {
        labelEl.style.opacity = '0';
        labelEl.style.transform = 'translate3d(-50%, -9999px, 0)';
      }
    });
  }, [hideTimelineLabels]);

  const scheduleOverlayRefresh = useCallback(() => {
    if (overlayUpdateFrameRef.current) {
      window.cancelAnimationFrame(overlayUpdateFrameRef.current);
    }

    overlayUpdateFrameRef.current = window.requestAnimationFrame(() => {
      overlayUpdateFrameRef.current = null;
      refreshVisibleTimeBlockLabels();
    });
  }, [refreshVisibleTimeBlockLabels]);

  const scheduleHideTimelineLabels = useCallback((delay = 900) => {
    if (timelineLabelsHideTimeoutRef.current) {
      window.clearTimeout(timelineLabelsHideTimeoutRef.current);
    }

    timelineLabelsHideTimeoutRef.current = window.setTimeout(() => {
      if (timelineTouchActiveRef.current) return;
      hideTimelineLabels();
    }, delay);
  }, [hideTimelineLabels]);

  const activateTimelineLabels = useCallback(() => {
    timelineLabelsVisibleRef.current = true;
    if (timelineLabelsHideTimeoutRef.current) {
      window.clearTimeout(timelineLabelsHideTimeoutRef.current);
      timelineLabelsHideTimeoutRef.current = null;
    }
    scheduleOverlayRefresh();
  }, [scheduleOverlayRefresh]);

  const scrollToCurrentTime = useCallback((behavior = 'smooth') => {
    if (!isSameDay(selectedDate, getLogicalToday())) return;
    const currentBlockId = getCurrentTimeBlock();
    const el = document.querySelector(`[data-block-id="${currentBlockId}"]`);
    if (el && timelineRef.current) {
      el.scrollIntoView({ behavior, block: 'start' });
    }
  }, [currentTime, selectedDate]);

  const persistCurrentDayScroll = useCallback(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;
    dayScrollPositionsRef.current[format(selectedDate, 'yyyy-MM-dd')] = timelineEl.scrollTop;
    if (timelineLabelsVisibleRef.current) {
      scheduleOverlayRefresh();
      scheduleHideTimelineLabels(900);
    }
  }, [scheduleHideTimelineLabels, scheduleOverlayRefresh, selectedDate]);

  const scrollTimelineToCurrentTime = useCallback((behavior = 'smooth') => {
    if (!isSameDay(selectedDate, getLogicalToday())) return;

    scrollToCurrentTime(behavior);

    window.setTimeout(() => {
      const timelineEl = timelineRef.current;
      if (!timelineEl) return;
      dayScrollPositionsRef.current[format(selectedDate, 'yyyy-MM-dd')] = timelineEl.scrollTop;
    }, behavior === 'auto' ? 0 : 260);
  }, [scrollToCurrentTime, selectedDate]);

  // Auto-scroll the selected day into center of the strip
  useEffect(() => {
    const key = format(selectedDate, 'yyyy-MM-dd');
    const el = dayRefs.current[key];
    if (el && stripRef.current) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedDate]);

  useLayoutEffect(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;

    const currentDateKey = format(selectedDate, 'yyyy-MM-dd');
    const pendingAction = pendingTimelineScrollActionRef.current;

    if (pendingAction?.type === 'preserve-offset' && typeof pendingAction.scrollTop === 'number') {
      timelineEl.scrollTop = pendingAction.scrollTop;
      dayScrollPositionsRef.current[currentDateKey] = pendingAction.scrollTop;
    } else if (pendingAction?.type === 'current-time') {
      if (isSameDay(selectedDate, getLogicalToday())) {
        scrollTimelineToCurrentTime(pendingAction.behavior ?? 'smooth');
      }
    } else if (pendingAction?.type === 'initial-today') {
      if (isSameDay(selectedDate, getLogicalToday()) && !hasAutoScrolledToTodayRef.current) {
        hasAutoScrolledToTodayRef.current = true;
        scrollTimelineToCurrentTime('auto');
      }
    } else {
      const savedScrollTop = dayScrollPositionsRef.current[currentDateKey];
      if (typeof savedScrollTop === 'number') {
        timelineEl.scrollTop = savedScrollTop;
      }
    }

    pendingTimelineScrollActionRef.current = null;
  }, [scrollTimelineToCurrentTime, selectedDate]);

  useLayoutEffect(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl || !dayTransition || typeof dayTransition.preservedScrollTop !== 'number') return;
    timelineEl.scrollTop = dayTransition.preservedScrollTop;
  }, [dayTransition]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const finishDayTransition = useCallback((nextDate) => {
    setSelectedDate(nextDate);
    setDaySwipeOffset(0);
    setDayTransition(null);
    transitionTimeoutRef.current = null;
  }, []);

  const transitionToDate = useCallback((nextDate, options = {}) => {
    if ((!options.bypassOverlayGuard && anyOverlayOpen) || dayTransition || isSameDay(nextDate, selectedDate)) return;

    const currentScrollTop = timelineRef.current?.scrollTop ?? 0;
    const currentScrollHeight = timelineRef.current?.scrollHeight ?? 0;
    const currentViewportHeight = timelineRef.current?.clientHeight ?? 0;
    const stageHeight = Math.max(currentScrollHeight, currentViewportHeight);
    persistCurrentDayScroll();
    // Horizontal day changes preserve the visible vertical window unless the
    // caller explicitly requests a jump to the current-time area.
    pendingTimelineScrollActionRef.current = options.scrollBehavior === 'current-time'
      ? { type: 'current-time', behavior: options.scrollAnimationBehavior ?? 'smooth' }
      : { type: 'preserve-offset', scrollTop: currentScrollTop };

    const direction = nextDate > selectedDate ? 'next' : 'previous';
    if (transitionTimeoutRef.current) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    const viewportWidth = timelineRef.current?.clientWidth || window.innerWidth || 360;
    const exitOffset = direction === 'next' ? -viewportWidth : viewportWidth;
    const enterOffset = direction === 'next' ? viewportWidth : -viewportWidth;
    const durationMs = options.durationMs ?? DAY_SWIPE_CONFIG.SWIPE_ANIMATION_DURATION_MS;

    setDayTransition({
      direction,
      nextDate,
      currentOffset: daySwipeOffset,
      nextOffset: enterOffset,
      durationMs,
      preservedScrollTop: currentScrollTop,
      stageHeight,
    });

    requestAnimationFrame(() => {
      setDayTransition({
        direction,
        nextDate,
        currentOffset: exitOffset,
        nextOffset: 0,
        durationMs,
        preservedScrollTop: currentScrollTop,
        stageHeight,
      });
    });

    transitionTimeoutRef.current = window.setTimeout(() => {
      finishDayTransition(nextDate);
    }, durationMs);
  }, [anyOverlayOpen, daySwipeOffset, dayTransition, finishDayTransition, persistCurrentDayScroll, selectedDate]);

  const [todos, setTodos] = useSyncedTodos({
    userId: session?.user?.id || null,
    normalizeTodo: normalizeTodoRecord,
  });
  const suppressCardClickRef = useRef(null);
  const suppressAllCardClicksUntilRef = useRef(0);
  const suppressClickTimeoutRef = useRef(null);
  const openSwipeTodoIdRef = useRef(null);

  const handleAddTodo = () => {
    if (!inputText.trim()) return;
    const resolvedBlock = activeChip === 'Now' ? getCurrentTimeBlock() : activeChip;
    const rawText = inputText.trim();
    const typeFields = getDerivedTaskFields(rawText);
    const { cardType, videoUrl, mapUrl } = typeFields;

    const newTodoId = Date.now();

    const newTodo = {
      id: newTodoId,
      text: rawText,
      timeOfDay: resolvedBlock,
      completed: false,
      dateString: format(selectedDate, 'yyyy-MM-dd'),
      ...typeFields,
      desktopSlot: null,
    };

    setTodos(prev => {
      const desktopSlot = getFirstAvailableDesktopSlot(prev, newTodo.dateString, newTodo.timeOfDay);
      return [...prev, normalizeTodoRecord({ ...newTodo, desktopSlot })];
    });
    setInputText('');
    closeSheet();

    // Fetch metadata asynchronously without blocking the UI
    if (cardType === 'video' && videoUrl) {
      fetchVideoMeta(videoUrl).then(meta => {
        setTodos(prev => prev.map(t => t.id === newTodoId ? { ...t, ...meta } : t));
      });
    } else if (cardType === 'place' && mapUrl) {
      fetchMapMeta(mapUrl).then(meta => {
        setTodos(prev => prev.map(t => t.id === newTodoId ? { ...t, ...meta } : t));
      });
    }
  };

  const [draggedTodoId, setDraggedTodoId] = useState(null);
  const [dragOverBlock, setDragOverBlock] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);

  const dragOverBlockRef = React.useRef(null); // readable in onTouchEnd closure
  const dragOverTodoIdRef = React.useRef(null);
  const dragInsertAfterRef = React.useRef(false);
  const dragPreviewRef = React.useRef(null);

  const swipeTouchStartX = React.useRef(null);
  const swipeTouchStartY = React.useRef(null);
  const swipeStartOffset = React.useRef(0);
  const swipeCurrentOffset = React.useRef(0);
  const isDragMode = React.useRef(false);
  const touchDragPressTimerRef = React.useRef(null);
  const touchDragReadyRef = React.useRef(false);
  const dragOriginY = React.useRef(0);
  const dragOriginX = React.useRef(0);
  const dragTouchX = React.useRef(0);
  const dragTouchY = React.useRef(0);
  const activeTouchIdentifierRef = React.useRef(null);
  const activeDragTodoIdRef = React.useRef(null);
  const lockedTimelineScrollTop = React.useRef(0);
  const autoScrollVelocity = React.useRef(0);
  const autoScrollFrameRef = React.useRef(null);
  const autoScrollLastTsRef = React.useRef(null);
  const autoScrollRemainderRef = React.useRef(0);
  const dragTouchMoveHandlerRef = React.useRef(null);
  const dragTouchEndHandlerRef = React.useRef(null);
  const dragDayFlipTimerRef = React.useRef(null);
  const dragDayFlipDirectionRef = React.useRef(0);
  const dragDayFlipCooldownUntilRef = React.useRef(0);
  const dragGhostRef = React.useRef(null);
  const dragPlaceholderHeightRef = React.useRef(88);
  const swipeWrapperRectsRef = React.useRef(new Map());

  const clearDragDayFlipTimer = useCallback(() => {
    if (dragDayFlipTimerRef.current !== null) {
      window.clearTimeout(dragDayFlipTimerRef.current);
      dragDayFlipTimerRef.current = null;
    }
    dragDayFlipDirectionRef.current = 0;
  }, []);

  const triggerDirectDayFlipFeedback = useCallback((direction) => {
    if (!direction) return;
    if (directDayFlipTimeoutRef.current !== null) {
      window.clearTimeout(directDayFlipTimeoutRef.current);
    }
    setDirectDayFlipDirection(direction);
    directDayFlipTimeoutRef.current = window.setTimeout(() => {
      directDayFlipTimeoutRef.current = null;
      setDirectDayFlipDirection(null);
    }, 320);
  }, []);

  const removeDragGhost = useCallback(() => {
    if (dragGhostRef.current) {
      dragGhostRef.current.remove();
      dragGhostRef.current = null;
    }
  }, []);

  const ensureDragGhost = useCallback((todoId) => {
    if (dragGhostRef.current) return dragGhostRef.current;

    const sourceEl = document.getElementById(`swipe-card-${todoId}`);
    if (!sourceEl) return null;

    const rect = sourceEl.getBoundingClientRect();
    const ghost = sourceEl.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.removeAttribute('data-todo-id');
    ghost.classList.remove('dragging');
    ghost.classList.add('task-drag-ghost');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.transform = 'translate3d(0, 0, 0) scale(1.04)';
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;
    return ghost;
  }, []);

  const applyDragSourceCardState = useCallback((todoId) => {
    const sourceEl = document.getElementById(`swipe-card-${todoId}`);
    if (!sourceEl) return;

    sourceEl.style.transition = 'opacity 0.12s ease, transform 0.12s ease';
    sourceEl.style.opacity = '0.12';
    sourceEl.style.transform = 'scale(0.985)';
    sourceEl.style.boxShadow = 'none';
    sourceEl.style.zIndex = '';
    sourceEl.style.willChange = 'opacity, transform';
  }, []);
  const syncDragPreview = useCallback((nextPreview) => {
    const normalizedPreview = nextPreview?.blockId
      ? {
        blockId: nextPreview.blockId,
        targetTodoId: nextPreview.targetTodoId ?? null,
        insertAfter: Boolean(nextPreview.insertAfter),
      }
      : null;
    const currentPreview = dragPreviewRef.current;
    const hasChanged = (
      currentPreview?.blockId !== normalizedPreview?.blockId
      || currentPreview?.targetTodoId !== normalizedPreview?.targetTodoId
      || currentPreview?.insertAfter !== normalizedPreview?.insertAfter
    );

    if (!hasChanged) return;

    dragPreviewRef.current = normalizedPreview;
    setDragPreview(normalizedPreview);
  }, []);

  useEffect(() => () => {
    if (touchDragPressTimerRef.current !== null) {
      window.clearTimeout(touchDragPressTimerRef.current);
      touchDragPressTimerRef.current = null;
    }
    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
    }
    if (dragTouchMoveHandlerRef.current) {
      window.removeEventListener('touchmove', dragTouchMoveHandlerRef.current);
      dragTouchMoveHandlerRef.current = null;
    }
    if (dragTouchEndHandlerRef.current) {
      window.removeEventListener('touchend', dragTouchEndHandlerRef.current);
      window.removeEventListener('touchcancel', dragTouchEndHandlerRef.current);
      dragTouchEndHandlerRef.current = null;
    }
    if (dragDayFlipTimerRef.current !== null) {
      window.clearTimeout(dragDayFlipTimerRef.current);
      dragDayFlipTimerRef.current = null;
    }
    if (directDayFlipTimeoutRef.current !== null) {
      window.clearTimeout(directDayFlipTimeoutRef.current);
      directDayFlipTimeoutRef.current = null;
    }
    removeDragGhost();
  }, [removeDragGhost]);

  useLayoutEffect(() => {
    const wrappers = Array.from(document.querySelectorAll('[data-swipe-wrapper-id]'));
    const nextRects = new Map(
      wrappers.map((wrapper) => [wrapper.getAttribute('data-swipe-wrapper-id'), wrapper.getBoundingClientRect()]),
    );
    const prevRects = swipeWrapperRectsRef.current;

    wrappers.forEach((wrapper) => {
      const id = wrapper.getAttribute('data-swipe-wrapper-id');
      const prevRect = prevRects.get(id);
      const nextRect = nextRects.get(id);
      if (!id || !prevRect || !nextRect) return;

      const deltaY = prevRect.top - nextRect.top;
      if (Math.abs(deltaY) < 0.5) return;

      wrapper.style.transition = 'none';
      wrapper.style.transform = `translate3d(0, ${deltaY}px, 0)`;
      wrapper.getBoundingClientRect();
      wrapper.style.transition = 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)';
      wrapper.style.transform = 'translate3d(0, 0, 0)';
    });

    swipeWrapperRectsRef.current = nextRects;
  }, [dragPreview, draggedTodoId, selectedDate, todos]);

  const suppressNextCardClick = useCallback((todoId) => {
    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
    }

    suppressAllCardClicksUntilRef.current = Date.now() + 350;
    suppressCardClickRef.current = todoId;
    suppressClickTimeoutRef.current = window.setTimeout(() => {
      if (suppressCardClickRef.current === todoId) {
        suppressCardClickRef.current = null;
      }
      suppressClickTimeoutRef.current = null;
    }, 250);
  }, []);

  const lockTimelineScroll = useCallback(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;
    lockedTimelineScrollTop.current = timelineEl.scrollTop;
    timelineEl.classList.add('drag-scroll-locked');
  }, []);

  const unlockTimelineScroll = useCallback(() => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;
    timelineEl.classList.remove('drag-scroll-locked');
  }, []);

  // Helper: find nearest time block by vertical center proximity
  const getNearestBlock = (touchY) => {
    const blocks = document.querySelectorAll('[data-block-id]');
    let nearestId = null;
    let nearestDist = Infinity;
    blocks.forEach(block => {
      const rect = block.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const dist = Math.abs(touchY - centerY);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = block.dataset.blockId;
      }
    });
    return nearestId;
  };
  const getTouchDragTarget = useCallback((todoId, touchY) => {
    const blockId = getNearestBlock(touchY);
    if (!blockId) {
      return { blockId: null, targetTodoId: null, insertAfter: false };
    }

    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
    const todoCards = blockEl ? Array.from(blockEl.querySelectorAll('[data-todo-id]')) : [];
    let nearestTodoId = null;
    let nearestScore = Number.POSITIVE_INFINITY;
    let insertAfter = false;

    todoCards.forEach((card) => {
      const candidateId = Number(card.getAttribute('data-todo-id'));
      if (candidateId === todoId) return;

      const rect = card.getBoundingClientRect();
      const clampedY = Math.max(rect.top, Math.min(touchY, rect.bottom));
      const edgeDistance = Math.abs(touchY - clampedY);
      const centerDistance = Math.abs(touchY - (rect.top + (rect.height / 2)));
      const score = (edgeDistance * 1000) + centerDistance;

      if (score < nearestScore) {
        nearestScore = score;
        nearestTodoId = candidateId;
        insertAfter = touchY > rect.top + (rect.height / 2);
      }
    });

    return { blockId, targetTodoId: nearestTodoId, insertAfter };
  }, []);

  const syncDraggedCardPosition = useCallback((todoId, touchY, touchX = dragTouchX.current) => {
    const timelineEl = timelineRef.current;
    const scrollDelta = timelineEl ? timelineEl.scrollTop - lockedTimelineScrollTop.current : 0;
    const rawDx = touchX - dragOriginX.current;
    const dx = Math.max(-160, Math.min(160, rawDx));
    const rawDy = touchY - dragOriginY.current + scrollDelta;
    const dy = Math.max(-2000, Math.min(2000, rawDy));
    const ghostEl = ensureDragGhost(todoId);
    if (ghostEl) {
      ghostEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.04)`;
    } else {
      const sourceEl = document.getElementById(`swipe-card-${todoId}`);
      if (sourceEl) {
        sourceEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.04)`;
      }
    }
    applyDragSourceCardState(todoId);

    const dragTarget = getTouchDragTarget(todoId, touchY);
    if (dragTarget.blockId !== dragOverBlockRef.current) {
      dragOverBlockRef.current = dragTarget.blockId;
      setDragOverBlock(dragTarget.blockId);
    }
    dragOverTodoIdRef.current = dragTarget.targetTodoId;
    dragInsertAfterRef.current = dragTarget.insertAfter;
    syncDragPreview(dragTarget);
  }, [applyDragSourceCardState, ensureDragGhost, getTouchDragTarget, syncDragPreview]);

  const moveDraggedTodoToDate = useCallback((todoId, nextDate) => {
    if (!todoId || !nextDate) return;

    const currentDate = selectedDateRef.current;
    if (isSameDay(currentDate, nextDate)) return;

    const currentDateKey = format(currentDate, 'yyyy-MM-dd');
    const nextDateKey = format(nextDate, 'yyyy-MM-dd');
    const preservedScrollTop = timelineRef.current?.scrollTop ?? 0;

    dayScrollPositionsRef.current[currentDateKey] = preservedScrollTop;
    pendingTimelineScrollActionRef.current = {
      type: 'preserve-offset',
      scrollTop: preservedScrollTop,
    };

    setTodos((prev) => {
      const draggedTodo = prev.find((todo) => todo.id === todoId);
      if (!draggedTodo || draggedTodo.dateString === nextDateKey) return prev;

      const sourceDateKey = draggedTodo.dateString;
      const sourceBlock = draggedTodo.timeOfDay;
      let nextTodos = prev.map((todo) => (
        todo.id === todoId
          ? normalizeTodoRecord({ ...todo, dateString: nextDateKey })
          : todo
      ));

      nextTodos = reflowDesktopSlotsForBlock(nextTodos, sourceDateKey, sourceBlock);
      nextTodos = reflowDesktopSlotsForBlock(nextTodos, nextDateKey, sourceBlock);
      return nextTodos;
    });

    dragOverBlockRef.current = null;
    dragOverTodoIdRef.current = null;
    dragInsertAfterRef.current = false;
    setDragOverBlock(null);
    triggerDirectDayFlipFeedback(nextDate > currentDate ? 'next' : 'previous');
    selectedDateRef.current = nextDate;
    setSelectedDate(nextDate);
  }, [setTodos, triggerDirectDayFlipFeedback]);

  const updateDragDayAutoFlip = useCallback((touchX, todoId) => {
    const shellEl = timelineShellRef.current || timelineRef.current;
    if (!shellEl || !todoId) return;

    const rect = shellEl.getBoundingClientRect();
    const edgeZone = Math.min(72, Math.max(44, rect.width * 0.16));
    let direction = 0;

    if (touchX <= rect.left + edgeZone) {
      direction = -1;
    } else if (touchX >= rect.right - edgeZone) {
      direction = 1;
    }

    if (direction === 0) {
      clearDragDayFlipTimer();
      return;
    }

    if (Date.now() < dragDayFlipCooldownUntilRef.current) {
      return;
    }

    if (dragDayFlipDirectionRef.current === direction && dragDayFlipTimerRef.current !== null) {
      return;
    }

    clearDragDayFlipTimer();
    dragDayFlipDirectionRef.current = direction;
    dragDayFlipTimerRef.current = window.setTimeout(() => {
      dragDayFlipTimerRef.current = null;
      dragDayFlipDirectionRef.current = 0;

      if (!isDragMode.current || activeDragTodoIdRef.current !== todoId) return;

      const baseDate = selectedDateRef.current;
      const nextDate = direction > 0 ? addDays(baseDate, 1) : subDays(baseDate, 1);

      dragDayFlipCooldownUntilRef.current = Date.now() + TOUCH_DRAG_DAY_FLIP_COOLDOWN_MS;
      moveDraggedTodoToDate(todoId, nextDate);
    }, TOUCH_DRAG_DAY_EDGE_HOLD_MS);
  }, [clearDragDayFlipTimer, moveDraggedTodoToDate]);

  const stopAutoScroll = useCallback(() => {
    autoScrollVelocity.current = 0;
    autoScrollLastTsRef.current = null;
    autoScrollRemainderRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const applyAutoScrollDelta = useCallback((rawDelta, todoId) => {
    const timelineEl = timelineRef.current;
    if (!timelineEl || !todoId || rawDelta === 0) return false;

    const maxScrollTop = Math.max(0, timelineEl.scrollHeight - timelineEl.clientHeight);
    const prevScrollTop = timelineEl.scrollTop;
    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, prevScrollTop + rawDelta));
    const appliedDelta = nextScrollTop - prevScrollTop;

    if (appliedDelta === 0) {
      return false;
    }

    timelineEl.scrollTop = nextScrollTop;
    syncDraggedCardPosition(todoId, dragTouchY.current);
    return true;
  }, [syncDraggedCardPosition]);

  const runAutoScroll = useCallback((timestamp) => {
    if (!isDragMode.current) {
      stopAutoScroll();
      return;
    }

    const timelineEl = timelineRef.current;
    const todoId = activeDragTodoIdRef.current;
    if (!timelineEl || !todoId) {
      stopAutoScroll();
      return;
    }

    if (autoScrollLastTsRef.current === null) {
      autoScrollLastTsRef.current = timestamp;
    }

    const elapsed = Math.min(timestamp - autoScrollLastTsRef.current, 32);
    autoScrollLastTsRef.current = timestamp;

    if (autoScrollVelocity.current !== 0) {
      autoScrollRemainderRef.current += autoScrollVelocity.current * elapsed;
      const delta = autoScrollRemainderRef.current > 0
        ? Math.floor(autoScrollRemainderRef.current)
        : Math.ceil(autoScrollRemainderRef.current);

      if (delta !== 0) {
        autoScrollRemainderRef.current -= delta;
      }

      if (delta !== 0 && !applyAutoScrollDelta(delta, todoId)) {
        stopAutoScroll();
        return;
      }
    }

    if (autoScrollVelocity.current !== 0) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    } else {
      autoScrollFrameRef.current = null;
      autoScrollLastTsRef.current = null;
    }
  }, [stopAutoScroll]);

  const updateAutoScroll = useCallback((touchY) => {
    const timelineEl = timelineRef.current;
    if (!timelineEl) return;

    const rect = timelineEl.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const topBoundary = Math.max(rect.top, 0);
    const bottomBoundary = Math.min(rect.bottom, viewportHeight);
    const SCROLL_ZONE = Math.min(180, Math.max(120, (bottomBoundary - topBoundary) * 0.24));
    const MAX_SPEED = 2.8; // px per ms
    const maxScrollTop = Math.max(0, timelineEl.scrollHeight - timelineEl.clientHeight);

    let velocity = 0;

    if (touchY < topBoundary + SCROLL_ZONE) {
      const intensity = (topBoundary + SCROLL_ZONE - touchY) / SCROLL_ZONE;
      velocity = -MAX_SPEED * Math.min(Math.max(intensity, 0), 1);
    } else if (touchY > bottomBoundary - SCROLL_ZONE) {
      const intensity = (touchY - (bottomBoundary - SCROLL_ZONE)) / SCROLL_ZONE;
      velocity = MAX_SPEED * Math.min(Math.max(intensity, 0), 1);
    }

    if ((velocity < 0 && timelineEl.scrollTop <= 0) || (velocity > 0 && timelineEl.scrollTop >= maxScrollTop)) {
      velocity = 0;
    }

    autoScrollVelocity.current = velocity;

    if (velocity !== 0) {
      const immediateDelta = velocity * 18;
      if (!applyAutoScrollDelta(immediateDelta, activeDragTodoIdRef.current)) {
        velocity = 0;
        autoScrollVelocity.current = 0;
      }
    }

    if (velocity !== 0 && autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    } else if (velocity === 0) {
      stopAutoScroll();
    }
  }, [applyAutoScrollDelta, runAutoScroll, stopAutoScroll]);

  const clearTouchDragPressTimer = useCallback(() => {
    if (touchDragPressTimerRef.current !== null) {
      window.clearTimeout(touchDragPressTimerRef.current);
      touchDragPressTimerRef.current = null;
    }
  }, []);

  const detachTouchDragListeners = useCallback(() => {
    if (dragTouchMoveHandlerRef.current) {
      window.removeEventListener('touchmove', dragTouchMoveHandlerRef.current);
      dragTouchMoveHandlerRef.current = null;
    }

    if (dragTouchEndHandlerRef.current) {
      window.removeEventListener('touchend', dragTouchEndHandlerRef.current);
      window.removeEventListener('touchcancel', dragTouchEndHandlerRef.current);
      dragTouchEndHandlerRef.current = null;
    }
  }, []);

  const setSwipeOffset = useCallback((todoId, offset, options = {}) => {
    const { animate = false } = options;
    const nextOffset = Math.max(0, Math.min(offset, SWIPE_ACTION_OPEN));
    const progress = Math.min(nextOffset / SWIPE_ACTION_OPEN, 1);
    const card = document.getElementById(`swipe-card-${todoId}`);
    const wrapper = document.getElementById(`swipe-wrapper-${todoId}`);

    if (card) {
      card.style.transition = animate ? 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none';
      card.style.transform = `translateX(-${nextOffset}px)`;
      if (animate) {
        window.setTimeout(() => {
          if (card) card.style.transition = '';
        }, 280);
      }
    }

    if (wrapper) {
      wrapper.style.setProperty('--swipe-action-progress', progress.toString());
      wrapper.classList.toggle('actions-visible', nextOffset > 0);
    }
  }, []);

  const closeSwipeActions = useCallback((todoId = openSwipeTodoIdRef.current, options = {}) => {
    if (todoId === null || todoId === undefined) return;
    setSwipeOffset(todoId, 0, options);
    if (openSwipeTodoIdRef.current === todoId) {
      openSwipeTodoIdRef.current = null;
    }
  }, [setSwipeOffset]);

  const openSwipeActions = useCallback((todoId) => {
    if (openSwipeTodoIdRef.current && openSwipeTodoIdRef.current !== todoId) {
      closeSwipeActions(openSwipeTodoIdRef.current, { animate: true });
    }
    setSwipeOffset(todoId, SWIPE_ACTION_OPEN, { animate: true });
    openSwipeTodoIdRef.current = todoId;
  }, [closeSwipeActions, setSwipeOffset]);

  const finalizeTouchDrag = useCallback((todoId) => {
    if (!todoId) return;

    suppressNextCardClick(todoId);
    isDragMode.current = false;
    touchDragReadyRef.current = false;
    clearDragDayFlipTimer();
    dragDayFlipCooldownUntilRef.current = 0;
    stopAutoScroll();
    detachTouchDragListeners();

    const el = document.getElementById(`swipe-card-${todoId}`);
    const wrapper = document.getElementById(`swipe-wrapper-${todoId}`);
    const targetBlock = dragOverBlockRef.current;
    const targetTodoId = dragOverTodoIdRef.current;
    const insertAfter = dragInsertAfterRef.current;

    if (targetBlock) {
      setTodos((prev) => {
        const draggedTodo = prev.find((todo) => todo.id === todoId);
        if (!draggedTodo) return prev;

        const sourceBlock = draggedTodo.timeOfDay;
        const dateString = draggedTodo.dateString;
        const targetOrder = getBlockTodosInDisplayOrder(prev, dateString, targetBlock)
          .filter((todo) => todo.id !== todoId)
          .map((todo) => todo.id);
        const targetIndex = targetTodoId ? targetOrder.findIndex((id) => id === targetTodoId) : -1;
        const insertIndex = targetIndex === -1
          ? targetOrder.length
          : (insertAfter ? targetIndex + 1 : targetIndex);
        targetOrder.splice(insertIndex, 0, todoId);

        let nextTodos = prev.map((todo) => (
          todo.id === todoId ? normalizeTodoRecord({ ...todo, timeOfDay: targetBlock }) : todo
        ));
        if (sourceBlock !== targetBlock) {
          nextTodos = reflowDesktopSlotsForBlock(nextTodos, dateString, sourceBlock);
        }
        nextTodos = reflowDesktopSlotsForBlock(nextTodos, dateString, targetBlock, targetOrder);
        return nextTodos;
      });
    }

    if (el) {
      el.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s, opacity 0.2s';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.opacity = '';
      el.style.zIndex = '';
      el.style.willChange = '';
      setTimeout(() => { if (el) el.style.transition = ''; }, 350);
    }

    removeDragGhost();

    if (wrapper) {
      wrapper.classList.remove('is-dragging');
      const parentBlock = wrapper.closest('.time-block');
      if (parentBlock) parentBlock.classList.remove('is-dragging-parent');
    }

    document.body.classList.remove('is-dragging-global');
    unlockTimelineScroll();
    activeTouchIdentifierRef.current = null;
    activeDragTodoIdRef.current = null;
    setDraggedTodoId(null);
    setDragPreview(null);
    setDragOverBlock(null);
    dragOverBlockRef.current = null;
    dragOverTodoIdRef.current = null;
    dragInsertAfterRef.current = false;
    dragPreviewRef.current = null;
    swipeTouchStartX.current = null;
    swipeTouchStartY.current = null;
    swipeStartOffset.current = 0;
    swipeCurrentOffset.current = 0;
    dragTouchX.current = 0;
  }, [clearDragDayFlipTimer, detachTouchDragListeners, removeDragGhost, stopAutoScroll, suppressNextCardClick, unlockTimelineScroll]);

  const startTouchDrag = useCallback((todoId) => {
    closeSwipeActions(todoId);
    touchDragReadyRef.current = true;
    isDragMode.current = true;
    dragOriginX.current = dragTouchX.current || swipeTouchStartX.current || 0;
    dragOriginY.current = dragTouchY.current || swipeTouchStartY.current || 0;
    activeDragTodoIdRef.current = todoId;
    dragOverTodoIdRef.current = null;
    dragInsertAfterRef.current = false;
    setDraggedTodoId(todoId);
    lockTimelineScroll();

    const el = document.getElementById(`swipe-card-${todoId}`);
    ensureDragGhost(todoId);
    const wrapper = document.getElementById(`swipe-wrapper-${todoId}`);
    if (el) {
      dragPlaceholderHeightRef.current = Math.max(72, Math.round(el.getBoundingClientRect().height));
      applyDragSourceCardState(todoId);
    }

    if (wrapper) {
      wrapper.classList.add('is-dragging');
      const parentBlock = wrapper.closest('.time-block');
      if (parentBlock) parentBlock.classList.add('is-dragging-parent');
    }
    document.body.classList.add('is-dragging-global');

    const draggedTodo = todos.find((todo) => todo.id === todoId);
    if (draggedTodo) {
      const blockTodos = getBlockTodosInDisplayOrder(todos, draggedTodo.dateString, draggedTodo.timeOfDay);
      const sourceIndex = blockTodos.findIndex((todo) => todo.id === todoId);
      const nextTodo = blockTodos[sourceIndex + 1] || null;
      const previousTodo = blockTodos[sourceIndex - 1] || null;

      syncDragPreview({
        blockId: draggedTodo.timeOfDay,
        targetTodoId: nextTodo?.id || previousTodo?.id || null,
        insertAfter: !nextTodo && Boolean(previousTodo),
      });
    }

    detachTouchDragListeners();

    const handleWindowTouchMove = (event) => {
      if (!isDragMode.current || activeDragTodoIdRef.current !== todoId) return;

      const touch = findTouchByIdentifier(event.touches, activeTouchIdentifierRef.current)
        || findTouchByIdentifier(event.changedTouches, activeTouchIdentifierRef.current)
        || event.touches[0]
        || event.changedTouches[0];

      if (!touch) return;

      dragTouchX.current = touch.clientX;
      dragTouchY.current = touch.clientY;
      if (event.cancelable) {
        event.preventDefault();
      }
      updateDragDayAutoFlip(touch.clientX, todoId);
      updateAutoScroll(touch.clientY);
      syncDraggedCardPosition(todoId, touch.clientY);
    };

    const handleWindowTouchEnd = (event) => {
      if (!isDragMode.current || activeDragTodoIdRef.current !== todoId) return;

      const touchIdentifier = activeTouchIdentifierRef.current;
      const trackedTouchEnded = event.type === 'touchcancel'
        || touchIdentifier === null
        || Boolean(findTouchByIdentifier(event.changedTouches, touchIdentifier));

      if (!trackedTouchEnded) return;

      if (event.cancelable) {
        event.preventDefault();
      }
      finalizeTouchDrag(todoId);
    };

    dragTouchMoveHandlerRef.current = handleWindowTouchMove;
    dragTouchEndHandlerRef.current = handleWindowTouchEnd;
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: false });
  }, [applyDragSourceCardState, closeSwipeActions, detachTouchDragListeners, ensureDragGhost, finalizeTouchDrag, lockTimelineScroll, syncDragPreview, syncDraggedCardPosition, todos, updateAutoScroll, updateDragDayAutoFlip]);

  useLayoutEffect(() => {
    if (!isDragMode.current || !activeDragTodoIdRef.current) return undefined;

    const todoId = activeDragTodoIdRef.current;
    const frame = window.requestAnimationFrame(() => {
      if (!isDragMode.current || activeDragTodoIdRef.current !== todoId) return;
      syncDraggedCardPosition(todoId, dragTouchY.current, dragTouchX.current);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [selectedDate, syncDraggedCardPosition]);

  const deleteTodo = useCallback((id) => {
    if (openSwipeTodoIdRef.current === id) {
      openSwipeTodoIdRef.current = null;
    }
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }, [setTodos]);



  const openEdit = (todo) => {
    closeSwipeActions(todo.id, { animate: true });
    setEditingTodo(todo);
    setEditText(todo.text);
  };

  const handleEditSave = () => {
    const rawText = editText.trim();
    if (!rawText || !editingTodo) return;

    const typeFields = getDerivedTaskFields(rawText);
    setTodos(prev => prev.map(t =>
      t.id === editingTodo.id ? normalizeTodoRecord({ ...t, text: rawText, ...typeFields }) : t
    ));
    if (typeFields.cardType === 'video' && typeFields.videoUrl) {
      fetchVideoMeta(typeFields.videoUrl).then(meta => {
        setTodos(prev => prev.map(t => t.id === editingTodo.id ? normalizeTodoRecord({ ...t, ...meta }) : t));
      });
    } else if (typeFields.cardType === 'place' && typeFields.mapUrl) {
      fetchMapMeta(typeFields.mapUrl).then(meta => {
        setTodos(prev => prev.map(t => t.id === editingTodo.id ? normalizeTodoRecord({ ...t, ...meta }) : t));
      });
    }
    closeEditModal();
  };

  const getSwipeHandlers = (todoId) => ({
    onTouchStart: (e) => {
      const touch = e.touches[0];
      if (openSwipeTodoIdRef.current && openSwipeTodoIdRef.current !== todoId) {
        closeSwipeActions(openSwipeTodoIdRef.current, { animate: true });
      }
      activeTouchIdentifierRef.current = touch.identifier;
      swipeTouchStartX.current = touch.clientX;
      swipeTouchStartY.current = touch.clientY;
      dragTouchX.current = touch.clientX;
      dragTouchY.current = touch.clientY;
      swipeStartOffset.current = openSwipeTodoIdRef.current === todoId ? SWIPE_ACTION_OPEN : 0;
      touchDragReadyRef.current = false;
      isDragMode.current = false;
      swipeCurrentOffset.current = swipeStartOffset.current;
      clearTouchDragPressTimer();
      touchDragPressTimerRef.current = window.setTimeout(() => {
        touchDragPressTimerRef.current = null;
        if (swipeTouchStartY.current === null || swipeTouchStartX.current === null || isDragMode.current) return;
        startTouchDrag(todoId);
      }, TOUCH_DRAG_LONG_PRESS_MS);
    },
    onTouchMove: (e) => {
      const touch = e.touches[0];
      if (swipeTouchStartX.current === null) return;

      const deltaX = touch.clientX - swipeTouchStartX.current;
      const deltaY = touch.clientY - swipeTouchStartY.current;
      dragTouchX.current = touch.clientX;
      dragTouchY.current = touch.clientY;

      // If already in drag mode, handle vertical dragging
      if (isDragMode.current) {
        return;
      }

      // Direction detection threshold
      const DIRECTION_THRESHOLD = 8;
      if (Math.abs(deltaX) < DIRECTION_THRESHOLD && Math.abs(deltaY) < DIRECTION_THRESHOLD) return;

      const movedTooFarForLongPress = (
        Math.abs(deltaX) > TOUCH_DRAG_CANCEL_DISTANCE ||
        Math.abs(deltaY) > TOUCH_DRAG_CANCEL_DISTANCE
      );
      if (movedTooFarForLongPress && !touchDragReadyRef.current) {
        clearTouchDragPressTimer();
      }

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        return;
      } else {
        // Horizontal movement → reveal actions
        if (e.cancelable) {
          e.preventDefault();
        }
        const rawOffset = swipeStartOffset.current - deltaX;
        if (rawOffset <= 0) {
          swipeCurrentOffset.current = 0;
          setSwipeOffset(todoId, 0);
          return;
        }
        let offset;
        if (rawOffset <= SWIPE_ACTION_MAX) {
          offset = rawOffset;
        } else {
          const overflow = rawOffset - SWIPE_ACTION_MAX;
          offset = SWIPE_ACTION_MAX + overflow * 0.18;
        }
        swipeCurrentOffset.current = offset;
        setSwipeOffset(todoId, offset);
      }
    },
    onTouchEnd: () => {
      clearTouchDragPressTimer();
      if (isDragMode.current) {
        return;
      }

      const offset = swipeCurrentOffset.current;
      if (Math.abs(offset - swipeStartOffset.current) > 10) {
        suppressNextCardClick(todoId);
      }

      if (offset >= SWIPE_ACTION_THRESHOLD) {
        openSwipeActions(todoId);
      } else {
        closeSwipeActions(todoId, { animate: true });
      }
      swipeTouchStartX.current = null;
      swipeTouchStartY.current = null;
      swipeStartOffset.current = 0;
      swipeCurrentOffset.current = 0;
      touchDragReadyRef.current = false;
      activeTouchIdentifierRef.current = null;
    },
    onTouchCancel: () => {
      clearTouchDragPressTimer();
      if (isDragMode.current) return;

      if (swipeCurrentOffset.current >= SWIPE_ACTION_THRESHOLD) {
        openSwipeActions(todoId);
      } else {
        closeSwipeActions(todoId, { animate: true });
      }

      swipeTouchStartX.current = null;
      swipeTouchStartY.current = null;
      swipeStartOffset.current = 0;
      swipeCurrentOffset.current = 0;
      touchDragReadyRef.current = false;
      activeTouchIdentifierRef.current = null;
    },
  });

  const handleDragStart = (e, id) => {
    e.stopPropagation();
    setDraggedTodoId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => { setDraggedTodoId(null); };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnTodo = (e, targetTodo) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedTodoId || draggedTodoId === targetTodo.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isBottomHalf = e.clientY > rect.top + rect.height / 2;
    suppressNextCardClick(draggedTodoId);
    setTodos((prev) => {
      const draggedTodo = prev.find((todo) => todo.id === draggedTodoId);
      if (!draggedTodo) return prev;

      const sourceBlock = draggedTodo.timeOfDay;
      const targetBlock = targetTodo.timeOfDay;
      const dateString = draggedTodo.dateString;
      const targetOrder = getBlockTodosInDisplayOrder(prev, dateString, targetBlock)
        .filter((todo) => todo.id !== draggedTodoId)
        .map((todo) => todo.id);
      const targetIndex = targetOrder.findIndex((id) => id === targetTodo.id);
      const insertIndex = targetIndex === -1 ? targetOrder.length : (isBottomHalf ? targetIndex + 1 : targetIndex);
      targetOrder.splice(insertIndex, 0, draggedTodoId);

      let nextTodos = prev.map((todo) => (
        todo.id === draggedTodoId ? normalizeTodoRecord({ ...todo, timeOfDay: targetBlock }) : todo
      ));
      if (sourceBlock !== targetBlock) {
        nextTodos = reflowDesktopSlotsForBlock(nextTodos, dateString, sourceBlock);
      }
      nextTodos = reflowDesktopSlotsForBlock(nextTodos, dateString, targetBlock, targetOrder);
      return nextTodos;
    });
  };

  const handleDropOnBlock = (e, blockId) => {
    e.preventDefault();
    if (!draggedTodoId) return;
    suppressNextCardClick(draggedTodoId);
    setTodos((prev) => {
      const draggedTodo = prev.find((todo) => todo.id === draggedTodoId);
      if (!draggedTodo) return prev;
      const sourceBlock = draggedTodo.timeOfDay;
      const dateString = draggedTodo.dateString;
      const targetOrder = [
        ...getBlockTodosInDisplayOrder(prev, dateString, blockId)
          .filter((todo) => todo.id !== draggedTodoId)
          .map((todo) => todo.id),
        draggedTodoId,
      ];

      let nextTodos = prev.map((todo) => (
        todo.id === draggedTodoId ? normalizeTodoRecord({ ...todo, timeOfDay: blockId }) : todo
      ));
      if (sourceBlock !== blockId) {
        nextTodos = reflowDesktopSlotsForBlock(nextTodos, dateString, sourceBlock);
      }
      nextTodos = reflowDesktopSlotsForBlock(nextTodos, dateString, blockId, targetOrder);
      return nextTodos;
    });
  };

  const logicalToday = getLogicalToday(currentTime);
  const chipOrder = ['Morning', 'Afternoon', 'Evening', 'Night', 'Midnight'];
  const calendarDays = Array.from({ length: 7 }).map((_, i) => {
    const date = addDays(subDays(selectedDate, 3), i);
    const d1 = new Date(date); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(logicalToday); d2.setHours(0, 0, 0, 0);
    const dayIndex = date.getDay();
    const localizedDayName = translations[language].dayNames[dayIndex];

    return {
      name: localizedDayName,
      date: format(date, 'd'),
      fullDate: date,
      active: isSameDay(date, selectedDate),
      isPast: d1 < d2,
      isFuture: d1 > d2,
      isToday: isSameDay(date, new Date())
    };
  });

  const getDayTodos = useCallback((date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return todos.filter((t) => t.dateString === dateString);
  }, [todos]);

  const allChips = [
    { id: 'Now', key: 'now' },
    { id: 'Morning', key: 'morning' },
    { id: 'Afternoon', key: 'afternoon' },
    { id: 'Evening', key: 'evening' },
    { id: 'Night', key: 'night' },
    { id: 'Midnight', key: 'midnight' }
  ];
  const chips = isSameDay(selectedDate, logicalToday)
    ? allChips.filter((chip) => (
      chip.id === 'Now' || chipOrder.indexOf(chip.id) >= chipOrder.indexOf(getCurrentTimeBlock())
    ))
    : allChips;
  const chipRows = chips.length === 4
    ? [chips.slice(0, 2), chips.slice(2, 4)]
    : chips.length === 5
      ? [chips.slice(0, 3), chips.slice(3, 5)]
      : Array.from(
        { length: Math.ceil(chips.length / 3) },
        (_, idx) => chips.slice(idx * 3, idx * 3 + 3)
      );
  const activeChipMeta = allChips.find((chip) => chip.id === activeChip) || null;
  const activeChipLabel = activeChipMeta ? translations[language][activeChipMeta.key] : '';

  useEffect(() => {
    if (!chips.some((chip) => chip.id === activeChip)) {
      setActiveChip(chips[0]?.id || 'Now');
    }
  }, [chips, activeChip]);


  const getTimeBlockAxisState = (block, date = selectedDate) => {
    const axisColor = block.axisColor || '#F7F1EA';
    const selectedDay = new Date(date);
    selectedDay.setHours(0, 0, 0, 0);

    const today = getLogicalToday(currentTime);
    const todayTime = today.getTime();
    const selectedTime = selectedDay.getTime();

    if (selectedTime < todayTime) {
      return {
        timeColStyle: {
          '--time-axis-color': axisColor,
          '--time-axis-background': axisColor,
        },
        indicatorStyle: null,
      };
    }

    if (selectedTime > todayTime) {
      return {
        timeColStyle: {
          '--time-axis-color': axisColor,
          '--time-axis-background': '#FFFFFF',
        },
        indicatorStyle: null,
      };
    }

    const { blockStart, blockEnd } = getLogicalBlockBounds(block, selectedDay);

    if (currentTime <= blockStart) {
      return {
        timeColStyle: {
          '--time-axis-color': axisColor,
          '--time-axis-background': '#FFFFFF',
        },
        indicatorStyle: null,
      };
    }

    if (currentTime >= blockEnd) {
      return {
        timeColStyle: {
          '--time-axis-color': axisColor,
          '--time-axis-background': axisColor,
        },
        indicatorStyle: null,
      };
    }

    const progress = Math.max(
      0,
      Math.min(1, (currentTime.getTime() - blockStart.getTime()) / (blockEnd.getTime() - blockStart.getTime()))
    );
    const linePosition = `calc(var(--time-col-padding-top) + (var(--time-label-size) / 2) + ((100% - var(--time-col-padding-top) - var(--time-col-padding-bottom) - var(--time-label-size)) * ${progress}))`;

    return {
      timeColStyle: {
        '--time-axis-color': axisColor,
        '--time-line-position': linePosition,
        '--time-axis-background': `linear-gradient(to bottom, ${axisColor} 0px, ${axisColor} ${linePosition}, #FFFFFF ${linePosition}, #FFFFFF 100%)`,
      },
      indicatorStyle: {
        top: linePosition,
      },
    };
  };

  const isTimeBlockPast = (block) => {
    // If selected date is in the past, all blocks are past.
    const today = getLogicalToday(currentTime);
    const selDateMidnight = new Date(selectedDate);
    selDateMidnight.setHours(0, 0, 0, 0);

    if (selDateMidnight < today) return true;
    if (selDateMidnight > today) return false;

    const { blockEnd: endDateTime } = getLogicalBlockBounds(block, selectedDate);

    return currentTime > endDateTime;
  };

  const getRelativeWeekLabel = () => {
    const today = getLogicalToday();
    const d1 = new Date(selectedDate); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(today); d2.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d1 - d2) / (1000 * 3600 * 24));
    const t = translations[language];
    if (diffDays === 0) return t.today;
    if (diffDays === -1) return t.yesterday;
    if (diffDays === 1) return t.tmr;

    const dayIndex = selectedDate.getDay();
    const localizedDayName = t.dayNames[dayIndex];
    return `${localizedDayName}, ${format(selectedDate, 'MMM d')}`;
  };

  const handleComposerChange = (e) => {
    setInputText(e.target.value);
  };

  const handleComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTodo();
    }
  };

  const getRelativeWeekText = () => <strong>{getRelativeWeekLabel()}</strong>;

  const renderTimelineBlocks = useCallback((date, options = {}) => {
    const dayTodos = getDayTodos(date);
    const dateKey = format(date, 'yyyy-MM-dd');

    return timeBlocks.map((block) => {
      const blockTodos = getBlockTodosInDisplayOrder(dayTodos, dateKey, block.id);
      const visibleBlockTodos = draggedTodoId
        ? blockTodos.filter((todo) => todo.id !== draggedTodoId)
        : blockTodos;
      const renderedItems = visibleBlockTodos.map((todo) => ({ type: 'todo', todo }));
      if (draggedTodoId && dragPreview?.blockId === block.id) {
        const targetIndex = dragPreview.targetTodoId
          ? visibleBlockTodos.findIndex((todo) => todo.id === dragPreview.targetTodoId)
          : -1;
        const insertIndex = targetIndex === -1
          ? renderedItems.length
          : (dragPreview.insertAfter ? targetIndex + 1 : targetIndex);
        renderedItems.splice(insertIndex, 0, { type: 'placeholder', key: `${block.id}-drag-placeholder` });
      }
      const axisState = getTimeBlockAxisState(block, date);

      return (
        <div
          className="time-block"
          key={`${dateKey}-${block.id}`}
          data-time-block-id={block.id}
          data-date-key={dateKey}
          data-overlay-source={!options.isStatic ? 'true' : 'false'}
        >
          <div
            className="time-col"
            style={axisState.timeColStyle}
          >
            <span className="time-text">{block.start}</span>
            {axisState.indicatorStyle && (
              <img
                src="/pin.png"
                alt="now"
                className="current-time-indicator-wrapper"
                style={axisState.indicatorStyle}
              />
            )}
            <span className="time-text bottom">{block.end}</span>
          </div>
          <div
            className="tasks-col"
            data-block-id={block.id}
            onDragOver={options.isStatic ? undefined : handleDragOver}
            onDrop={options.isStatic ? undefined : (e) => handleDropOnBlock(e, block.id)}
          >
            {renderedItems.map((item) => {
              if (item.type === 'placeholder') {
                return (
                  <div
                    key={item.key}
                    className="task-insert-placeholder"
                    style={{ height: `${dragPlaceholderHeightRef.current}px` }}
                    aria-hidden="true"
                  />
                );
              }

              const { todo } = item;
              const {
                cType,
                cfg,
                displayTitle,
                displaySub,
              } = getTaskCardPresentation(todo, translations[language]);

              const canUseDesktopDrag = !options.isStatic && !isCoarsePointer;

              return (
                <div key={todo.id} id={`swipe-wrapper-${todo.id}`} data-swipe-wrapper-id={todo.id} className="swipe-wrapper">
                  <div className="swipe-actions">
                    <button
                      type="button"
                      className="swipe-action-button swipe-action-edit"
                      aria-label={translations[language].edit}
                      onClick={(e) => {
                        e.stopPropagation();
                        suppressCardClickRef.current = null;
                        openEdit(todo);
                      }}
                    >
                      <PenLine size={14.4} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      className="swipe-action-button swipe-action-delete"
                      aria-label={translations[language].delete}
                      onClick={(e) => {
                        e.stopPropagation();
                        suppressCardClickRef.current = null;
                        deleteTodo(todo.id);
                      }}
                    >
                      <Trash2 size={14.4} strokeWidth={2.2} />
                    </button>
                  </div>

                  <div
                    id={`swipe-card-${todo.id}`}
                    data-todo-id={todo.id}
                    className={`task-card ${draggedTodoId === todo.id ? 'dragging' : ''}`}
                    onClick={() => {
                      if (Date.now() < suppressAllCardClicksUntilRef.current) {
                        return;
                      }
                      if (openSwipeTodoIdRef.current === todo.id) {
                        closeSwipeActions(todo.id, { animate: true });
                        return;
                      }
                      if (suppressCardClickRef.current === todo.id) {
                        suppressCardClickRef.current = null;
                        return;
                      }
                      openEdit(todo);
                    }}
                    draggable={canUseDesktopDrag}
                    onDragStart={canUseDesktopDrag ? (e) => handleDragStart(e, todo.id) : undefined}
                    onDragEnd={canUseDesktopDrag ? handleDragEnd : undefined}
                    onDragOver={canUseDesktopDrag ? handleDragOver : undefined}
                    onDrop={canUseDesktopDrag ? (e) => handleDropOnTodo(e, todo) : undefined}
                    {...(options.isStatic ? {} : getSwipeHandlers(todo.id))}
                  >
                    <div
                      className="task-icon-placeholder"
                      style={{
                        backgroundColor: appearance === 'dark' ? cfg.darkBg : cfg.bg,
                        border: appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none'
                      }}
                    >
                      <img src={cfg.icon} alt={cType} className="task-card-icon" style={{ position: 'relative', zIndex: 10 }} />
                    </div>
                    <div className="task-content">
                      <span className="task-title">{displayTitle}</span>
                      <span className="task-desc">{displaySub}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }, [appearance, closeSwipeActions, deleteTodo, dragPreview, draggedTodoId, getDayTodos, getSwipeHandlers, handleDragEnd, handleDragOver, handleDropOnBlock, handleDropOnTodo, isCoarsePointer, language, openEdit]);

  const timelinePanels = useMemo(() => {
    if (!dayTransition) {
      return [{
        key: format(selectedDate, 'yyyy-MM-dd'),
        date: selectedDate,
        className: `timeline-panel is-active ${directDayFlipDirection ? `timeline-panel-direct-flip timeline-panel-direct-flip-${directDayFlipDirection}` : ''}`,
        style: { transform: `translate3d(${daySwipeOffset}px, 0, 0)` },
        isStatic: false,
      }];
    }

    return [
      {
        key: `current-${format(selectedDate, 'yyyy-MM-dd')}`,
        date: selectedDate,
        className: 'timeline-panel timeline-panel-current',
        style: { transform: `translate3d(${dayTransition.currentOffset}px, 0, 0)` },
        isStatic: false,
      },
      {
        key: `next-${format(dayTransition.nextDate, 'yyyy-MM-dd')}`,
        date: dayTransition.nextDate,
        className: 'timeline-panel timeline-panel-incoming',
        style: { transform: `translate3d(${dayTransition.nextOffset}px, 0, 0)` },
        isStatic: true,
      }
    ];
  }, [daySwipeOffset, dayTransition, directDayFlipDirection, selectedDate]);

  const dayFeedbackDirection = dayTransition?.direction || directDayFlipDirection;

  const overlayBlockMeta = overlayBlockId
    ? timeBlocks.find((block) => block.id === overlayBlockId) || null
    : null;
  const secondaryOverlayBlockMetas = secondaryOverlayBlockIds
    .map((blockId) => timeBlocks.find((block) => block.id === blockId) || null)
    .filter(Boolean);

  useLayoutEffect(() => {
    scheduleOverlayRefresh();
  }, [scheduleOverlayRefresh, selectedDate, dayTransition, secondaryOverlayBlockIds, todos]);

  useEffect(() => {
    const handleViewportChange = () => scheduleOverlayRefresh();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    window.visualViewport?.addEventListener('resize', handleViewportChange);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
    };
  }, [scheduleOverlayRefresh]);

  const handleTimelineTouchStart = useCallback(() => {
    timelineTouchActiveRef.current = true;
    activateTimelineLabels();
  }, [activateTimelineLabels]);

  const handleTimelineTouchMove = useCallback(() => {
    timelineTouchActiveRef.current = true;
    activateTimelineLabels();
  }, [activateTimelineLabels]);

  const handleTimelineTouchEnd = useCallback(() => {
    timelineTouchActiveRef.current = false;
    scheduleHideTimelineLabels(900);
  }, [scheduleHideTimelineLabels]);

  const isEditModalMobileLayout = isCoarsePointer;
  const fallbackEditViewportHeight = editModalViewport.baseHeight
    ? Math.max(0, editModalViewport.baseHeight - editModalViewport.keyboardInset - editModalViewport.offsetTop)
    : 0;
  const editVisibleViewportHeight = editModalViewport.visibleHeight && fallbackEditViewportHeight
    ? Math.min(editModalViewport.visibleHeight, fallbackEditViewportHeight)
    : editModalViewport.visibleHeight || fallbackEditViewportHeight;
  const editModalViewportStyle = editVisibleViewportHeight
    ? {
        '--edit-modal-visible-height': `${editVisibleViewportHeight}px`,
        '--edit-modal-offset-top': `${editModalViewport.offsetTop}px`,
      }
    : undefined;
  const editModalBackdropStyle = isEditModalMobileLayout && editVisibleViewportHeight
    ? {
        ...editModalViewportStyle,
        top: `${editModalViewport.offsetTop}px`,
        height: `${editVisibleViewportHeight}px`,
        maxHeight: `${editVisibleViewportHeight}px`,
        bottom: 'auto',
      }
    : editModalViewportStyle;
  const handleEditTextareaFocus = () => {
    setIsEditTextareaFocused(true);
    window.requestAnimationFrame(() => {
      scrollEditTextareaIntoView('smooth');
    });
  };

  return (
    <>
      <div className={`app-container platform-${platform} ${isNativePlatform ? 'native-shell' : 'web-shell'} ${appearance === 'dark' ? 'dark-theme' : ''} ${isSheetOpen ? 'sheet-open' : ''}`}>
        {/* Top Header */}
        <header className="header">
          <div className="header-side header-side-left">
            <div className="avatar" onClick={openProfilePanel} style={{ cursor: 'pointer' }}>
              <img src={session?.user?.user_metadata?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s64-c'} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            </div>
          </div>

          <div className={`header-center ${isAndroid ? 'header-center-android' : 'header-center-ios'} ${dayFeedbackDirection ? `header-day-feedback-${dayFeedbackDirection}` : ''}`} style={{ justifyContent: isSameDay(selectedDate, getLogicalToday()) ? 'flex-start' : 'center' }}>
            <div className="header-title-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => {
              if (isSameDay(selectedDate, getLogicalToday())) {
                scrollTimelineToCurrentTime('smooth');
                return;
              }
              transitionToDate(getLogicalToday(), {
                durationMs: DAY_SWIPE_CONFIG.TAP_ANIMATION_DURATION_MS,
                scrollBehavior: 'current-time',
                scrollAnimationBehavior: 'smooth',
              });
            }}>
              {!isSameDay(selectedDate, getLogicalToday()) && (
                <img src={appearance === 'dark' ? '/whiteuturn.png' : '/uturn.png'} alt="Back to Today" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
              )}
              <div key={format(selectedDate, 'yyyy-MM-dd')} className={`header-title ${dayFeedbackDirection ? `header-title-feedback-${dayFeedbackDirection}` : ''}`} style={{ transition: 'all 0.3s', fontSize: isSameDay(selectedDate, getLogicalToday()) ? '16px' : '20px', fontStyle: 'italic', fontFamily: '"LTC Bodoni 175", serif', fontWeight: 400, wordWrap: 'break-word', margin: 0 }}>
                {getRelativeWeekText()}
              </div>
            </div>
            {isSameDay(selectedDate, getLogicalToday()) && (
              <div className="header-sub-row">
                <div className="header-stats">
                  <div className="stat-pill"><span>{format(currentTime, 'hh').charAt(0)}</span></div>
                  <div className="stat-pill"><span>{format(currentTime, 'hh').charAt(1)}</span></div>
                  <div className="stat-colon">:</div>
                  <div className="stat-pill"><span>{format(currentTime, 'mm').charAt(0)}</span></div>
                  <div className="stat-pill"><span>{format(currentTime, 'mm').charAt(1)}</span></div>
                </div>
              </div>
            )}
          </div>

          <div className="header-side header-side-right">
            <div className="header-side-spacer" aria-hidden="true" />
            <button
              type="button"
              className={`add-btn header-add-btn ${isAndroid ? 'header-add-btn-android' : 'header-add-btn-ios'}`}
              onClick={openQuickAdd}
              aria-label={translations[language].addTaskAria}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="add-btn-icon" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M5.5 0V11.5M0 5.5H11.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <span>{translations[language].add}</span>
            </button>
          </div>
        </header>

        {/* Calendar Strip — native horizontal scroll with snap */}
        <div
          ref={stripRef}
          className={`calendar-strip ${dayFeedbackDirection ? `day-feedback-${dayFeedbackDirection}` : ''}`}
        >
          {calendarDays.map((day, idx) => (
            <div
              className="day-col"
              key={idx}
              ref={el => { dayRefs.current[format(day.fullDate, 'yyyy-MM-dd')] = el; }}
              onClick={() => transitionToDate(day.fullDate, { durationMs: DAY_SWIPE_CONFIG.TAP_ANIMATION_DURATION_MS })}
              style={{ cursor: 'pointer' }}
            >
              <span className={`day-name ${day.active ? 'active' : ''} ${day.isPast && !day.active ? 'past' : ''}`}>{day.name}</span>
              <span className={`day-date ${day.active ? 'active' : ''} ${day.isPast && !day.active ? 'past' : ''}`}>
                {day.date}
              </span>
              {day.isToday && !day.active && <span className="today-dot" />}
            </div>
          ))}
        </div>

        {/* Main Timeline — only the day content track slides during a day swipe */}
        <div className="timeline-shell" ref={timelineShellRef}>
          <main
            ref={timelineRef}
            className={`timeline-area ${dayTransition ? 'timeline-swiping' : ''}`}
            onScroll={persistCurrentDayScroll}
            onTouchStart={handleTimelineTouchStart}
            onTouchMove={handleTimelineTouchMove}
            onTouchEnd={handleTimelineTouchEnd}
            onTouchCancel={handleTimelineTouchEnd}
          >
            <div
              className="timeline-stage"
              style={dayTransition?.stageHeight ? { height: `${dayTransition.stageHeight}px` } : undefined}
            >
              {timelinePanels.map((panel) => (
                <div
                  key={panel.key}
                  className={`${panel.className} ${dayTransition ? 'timeline-panel-animating' : ''}`}
                  style={{
                    ...panel.style,
                    transitionDuration: dayTransition ? `${dayTransition.durationMs}ms` : undefined,
                  }}
                >
                  {renderTimelineBlocks(panel.date, { isStatic: panel.isStatic })}
                </div>
              ))}
            </div>
          </main>
          <div className="timeline-overlay-layer" aria-hidden="true">
            {overlayBlockMeta && (
              <div
                ref={overlayLabelRef}
                className="timeline-overlay-label"
                style={{
                  backgroundColor: overlayBlockMeta.color,
                  color: overlayBlockMeta.textColor,
                  WebkitTextStroke: `0.2px ${overlayBlockMeta.strokeColor}`,
                  paintOrder: 'stroke fill',
                }}
              >
                {translations[language][overlayBlockMeta.key]}
              </div>
            )}
            {secondaryOverlayBlockMetas.map((block) => (
              <div
                key={block.id}
                ref={(node) => {
                  if (node) {
                    secondaryOverlayLabelRefs.current[block.id] = node;
                  } else {
                    delete secondaryOverlayLabelRefs.current[block.id];
                  }
                }}
                className="timeline-overlay-label timeline-overlay-label-secondary"
                style={{
                  backgroundColor: block.color,
                  color: block.textColor,
                  WebkitTextStroke: `0.2px ${block.strokeColor}`,
                  paintOrder: 'stroke fill',
                }}
              >
                {translations[language][block.key]}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className={`mobile-fab ${isAndroid ? 'mobile-fab-android' : 'mobile-fab-ios'}`}
          onClick={openQuickAdd}
          aria-label={translations[language].addTaskAria}
        >
          <span aria-hidden="true">+</span>
        </button>

        {/* Bottom Sheet Modal */}
        {isSheetOpen && (
          <div
            className={`backdrop sheet-backdrop ${isAndroid ? 'sheet-backdrop-android' : 'sheet-backdrop-ios'}`}
            onClick={closeSheet}
            style={sheetBaseViewportHeight ? { height: `${sheetBaseViewportHeight}px`, maxHeight: `${sheetBaseViewportHeight}px`, bottom: 'auto' } : undefined}
          >
            <div
              className={`bottom-sheet ${isAndroid ? 'bottom-sheet-android' : 'bottom-sheet-ios'}`}
              ref={sheetPanelRef}
              onClick={(e) => e.stopPropagation()}
              style={sheetBaseHeight ? { height: `${sheetBaseHeight}px`, maxHeight: `${sheetBaseHeight}px` } : undefined}
              {...sheetSwipeHandlers}
            >
              <button className="sheet-close" onClick={closeSheet}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" d="M5.01417 5.01423C5.14308 4.88548 5.31782 4.81316 5.50001 4.81316C5.68219 4.81316 5.85693 4.88548 5.98584 5.01423L11 10.0284L16.0142 5.01423C16.0771 4.94668 16.153 4.8925 16.2373 4.85493C16.3217 4.81735 16.4127 4.79715 16.505 4.79552C16.5973 4.79389 16.689 4.81087 16.7746 4.84545C16.8602 4.88002 16.938 4.93149 17.0033 4.99677C17.0686 5.06206 17.12 5.13982 17.1546 5.22543C17.1892 5.31103 17.2062 5.40273 17.2045 5.49504C17.2029 5.58735 17.1827 5.67839 17.1451 5.76272C17.1076 5.84705 17.0534 5.92295 16.9858 5.98589L11.9717 11.0001L16.9858 16.0142C17.0534 16.0772 17.1076 16.1531 17.1451 16.2374C17.1827 16.3217 17.2029 16.4128 17.2045 16.5051C17.2062 16.5974 17.1892 16.6891 17.1546 16.7747C17.12 16.8603 17.0686 16.9381 17.0033 17.0033C16.938 17.0686 16.8602 17.1201 16.7746 17.1547C16.689 17.1892 16.5973 17.2062 16.505 17.2046C16.4127 17.203 16.3217 17.1828 16.2373 17.1452C16.153 17.1076 16.0771 17.0534 16.0142 16.9859L11 11.9717L5.98584 16.9859C5.85551 17.1073 5.68314 17.1734 5.50503 17.1703C5.32692 17.1672 5.15698 17.095 5.03102 16.969C4.90506 16.8431 4.8329 16.6731 4.82976 16.495C4.82662 16.3169 4.89273 16.1446 5.01417 16.0142L10.0283 11.0001L5.01417 5.98589C4.88543 5.85699 4.81311 5.68225 4.81311 5.50006C4.81311 5.31787 4.88543 5.14313 5.01417 5.01423Z" fill="black" />
                </svg>
              </button>
              <div className="sheet-content">
                <div
                  className={`sheet-main-stack ${isCalendarOpen ? 'calendar-open' : ''}`}
                  style={sheetContentLift > 0 ? { transform: `translateY(-${sheetContentLift}px)` } : undefined}
                >
                  <div className={`sheet-hero-icon ${isCalendarOpen ? 'calendar-open' : ''}`}>
                    <SheetPebbleIcon />
                  </div>
                  <div className={`sheet-title-row ${isCalendarOpen ? 'calendar-open' : ''}`} onClick={() => {
                    setCalPickerDate(new Date(selectedDate));
                    setIsCalendarOpen(o => !o);
                  }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <h1 className="sheet-title" style={{ margin: 0, lineHeight: 1 }}>{getRelativeWeekLabel()}</h1>
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="13" viewBox="0 0 9 14" fill="none" className="sheet-title-icon" style={{ transform: isCalendarOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                      <path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="black" />
                    </svg>
                  </div>
                  <div
                    ref={sheetLowerStackRef}
                    className={`sheet-lower-stack ${isCalendarOpen ? 'calendar-open' : ''}`}
                  >
                    {/* Inline calendar picker */}
                    <div className={`sheet-calendar-picker ${isCalendarOpen ? 'open' : ''}`}>
                      {(() => {
                        const today = getLogicalToday();
                        const minDate = today;
                        const maxDate = addDays(today, 30);
                        const isAtMinMonth = calPickerDate.getFullYear() === minDate.getFullYear() && calPickerDate.getMonth() === minDate.getMonth();
                        const isAtMaxMonth = calPickerDate.getFullYear() === maxDate.getFullYear() && calPickerDate.getMonth() === maxDate.getMonth();
                        return (
                          <div className="cal-picker-header">
                            <button className="cal-nav-btn" disabled={isAtMinMonth} onClick={e => { e.stopPropagation(); setCalPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; }); }}>
                              <svg width="7" height="12" viewBox="0 0 9 14" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M0.219809 7.45072C0.0790625 7.33113 0 7.16902 0 7C0 6.83098 0.0790625 6.66887 0.219809 6.54928L7.73599 0.171181C7.87847 0.0585185 8.06692 -0.00281603 8.26164 9.93682e-05C8.45636 0.00301477 8.64215 0.0699525 8.77986 0.18681C8.91757 0.303668 8.99645 0.461322 8.99988 0.626558C9.00332 0.791795 8.93104 0.951712 8.79827 1.07262L1.81324 7L8.79827 12.9274C8.93104 13.0483 9.00332 13.2082 8.99988 13.3734C8.99645 13.5387 8.91757 13.6963 8.77986 13.8132C8.64215 13.93 8.45636 13.997 8.26164 13.9999C8.06692 14.0028 7.87847 13.9415 7.73599 13.8288L0.219809 7.45072Z" fill="#111" /></svg>
                            </button>
                            <span className="cal-picker-month-label">{format(calPickerDate, 'MMM yyyy')}</span>
                            <button className="cal-nav-btn" disabled={isAtMaxMonth} onClick={e => { e.stopPropagation(); setCalPickerDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; }); }}>
                              <svg width="7" height="12" viewBox="0 0 9 14" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M8.78019 6.54928C8.92094 6.66887 9 6.83098 9 7C9 7.16902 8.92094 7.33113 8.78019 7.45072L1.26401 13.8288C1.12153 13.9415 0.933079 14.0028 0.738359 13.9999C0.543638 13.997 0.357853 13.93 0.220144 13.8132C0.0824342 13.6963 0.00355271 13.5387 0.000117099 13.3734C-0.00331851 13.2082 0.06896 13.0483 0.201726 12.9274L7.18676 7L0.201726 1.07262C0.06896 0.951712 -0.00331851 0.791795 0.000117099 0.626558C0.00355271 0.461322 0.0824342 0.303668 0.220144 0.18681C0.357853 0.0699525 0.543638 0.00301477 0.738359 9.93682e-05C0.933079 -0.00281603 1.12153 0.0585185 1.26401 0.171181L8.78019 6.54928Z" fill="#111" /></svg>
                            </button>
                          </div>
                        );
                      })()}
                      <div className="cal-picker-grid">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                          <div key={i} className="cal-picker-dow">{d}</div>
                        ))}
                        {Array.from({ length: new Date(calPickerDate.getFullYear(), calPickerDate.getMonth(), 1).getDay() }).map((_, i) => (
                          <div key={`e${i}`} />
                        ))}
                        {(() => {
                          const today = getLogicalToday();
                          const minDate = today;
                          const maxDate = addDays(today, 30);
                          const year = calPickerDate.getFullYear();
                          const month = calPickerDate.getMonth();
                          const startOffset = new Date(year, month, 1).getDay();
                          const daysInMonth = new Date(year, month + 1, 0).getDate();
                          const trailingCells = 42 - startOffset - daysInMonth;
                          return Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const cellDate = new Date(year, month, day);
                            const isSelected = isSameDay(cellDate, selectedDate);
                            const isToday = isSameDay(cellDate, new Date());
                            const isInRange = cellDate >= minDate && cellDate <= maxDate;
                            return (
                              <button
                                key={day}
                                className={`cal-picker-day ${isSelected ? 'selected' : ''} ${isToday && !isSelected ? 'today' : ''} ${!isInRange ? 'out-of-range' : ''}`}
                                disabled={!isInRange}
                                onClick={e => {
                                  if (!isInRange) return;
                                  e.stopPropagation();
                                  transitionToDate(cellDate, {
                                    durationMs: DAY_SWIPE_CONFIG.TAP_ANIMATION_DURATION_MS,
                                    bypassOverlayGuard: true,
                                  });
                                  setIsCalendarOpen(false);
                                }}
                              >
                                {day}
                              </button>
                            );
                          }).concat(Array.from({ length: trailingCells > 0 ? trailingCells : 0 }).map((_, i) => <div key={`t${i}`} />));
                        })()}
                      </div>
                    </div>

                    {isCalendarOpen ? (
                      <div className="sheet-time-summary" aria-live="polite">
                        <span className="sheet-time-summary-label">{translations[language].timeLabel}</span>
                        {activeChipLabel ? (
                          <span className="sheet-time-summary-pill">{activeChipLabel}</span>
                        ) : (
                          <span className="sheet-time-summary-text">{translations[language].notSelected}</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="section-label">
                          {appearance === 'dark' ? (
                            <img src="/timewhite.png" alt="Time" style={{ width: '14px', height: '14px' }} />
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path d="M9 4.5V9H12.375M15.75 9C15.75 9.88642 15.5754 10.7642 15.2362 11.5831C14.897 12.4021 14.3998 13.1462 13.773 13.773C13.1462 14.3998 12.4021 14.897 11.5831 15.2362C10.7642 15.5754 9.88642 15.75 9 15.75C8.11358 15.75 7.23583 15.5754 6.41689 15.2362C5.59794 14.897 4.85382 14.3998 4.22703 13.773C3.60023 13.1462 3.10303 12.4021 2.76381 11.5831C2.42459 10.7642 2.25 9.88642 2.25 9C2.25 7.20979 2.96116 5.4929 4.22703 4.22703C5.4929 2.96116 7.20979 2.25 9 2.25C10.7902 2.25 12.5071 2.96116 13.773 4.22703C15.0388 5.4929 15.75 7.20979 15.75 9Z" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {translations[language].timeOfDay}
                        </div>

                        <div ref={chipsContainerRef} className="chips-container">
                          {chipRows.map((row, rowIdx) => (
                            <div key={rowIdx} className={`chips-row chips-row-${row.length}`}>
                              {row.map((chip) => (
                                <button
                                  key={chip.id}
                                  className={`chip ${activeChip === chip.id ? 'active' : ''}`}
                                  onClick={() => setActiveChip(chip.id)}
                                >
                                  {translations[language][chip.key]}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="sheet-input-area"
              >
                <div
                  ref={!isComposerExpanded ? compactComposerRef : null}
                  className={`composer-frame ${isComposerExpanded ? 'expanded' : ''}`}
                  style={!isComposerExpanded && composerLift > 0 ? { transform: `translateY(-${composerLift}px)` } : undefined}
                >
                  {!isComposerExpanded ? (
                    <div className="composer-shell">
                      <div className="input-wrapper">
                        <textarea
                          ref={taskInputRef}
                          className="task-input"
                          autoFocus
                          placeholder={translations[language].placeholder}
                          value={inputText}
                          rows={1}
                          onFocus={() => setIsTaskInputFocused(true)}
                          onBlur={() => setIsTaskInputFocused(false)}
                          onChange={handleComposerChange}
                          onKeyDown={handleComposerKeyDown}
                        />
                        {canExpandComposer && (
                          <button
                            className="composer-expand-trigger compact"
                            onClick={() => setIsComposerExpanded(true)}
                            title="Expand composer"
                          >
                            <Maximize2 size={18} strokeWidth={1.9} />
                          </button>
                        )}
                        <button className="submit-btn compact" onClick={handleAddTodo}>
                          <ArrowUp size={18} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="expanded-composer-shell"
                      style={composerLift > 0 ? { paddingBottom: `calc(${16 + composerLift}px + env(safe-area-inset-bottom))` } : undefined}
                    >
                      <div className="expanded-composer-header">
                        <button
                          className="composer-expand-trigger expanded"
                          onClick={() => setIsComposerExpanded(false)}
                          title="Collapse composer"
                        >
                          <Minimize2 size={18} strokeWidth={1.9} />
                        </button>
                      </div>
                      <textarea
                        ref={expandedTaskInputRef}
                        className="expanded-task-input"
                        autoFocus
                        placeholder={translations[language].placeholder}
                        value={inputText}
                        rows={8}
                        onFocus={() => setIsTaskInputFocused(true)}
                        onBlur={() => setIsTaskInputFocused(false)}
                        onChange={handleComposerChange}
                        onKeyDown={handleComposerKeyDown}
                      />
                      <div className="expanded-composer-footer">
                        <button className="submit-btn expanded" onClick={handleAddTodo}>
                          <ArrowUp size={18} strokeWidth={2.4} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {isProfileOpen && (
          <div className={`backdrop modal-backdrop account-backdrop ${isClosingProfile ? 'fade-out' : ''}`} onClick={(e) => {
            if (e.target.classList.contains('backdrop')) closeProfile();
          }}>
            <div 
              className={`profile-modal ${isAndroid ? 'profile-modal-android' : 'profile-modal-ios'} ${isClosingProfile ? 'panel-exit' : 'panel-enter'}`}
              {...profileSwipeHandlers}
            >
              <div className="profile-scroll" ref={profileScrollRef}>
                <button className="profile-back-btn" onClick={closeProfile}>
                  <ChevronLeft size={22} color="#111" />
                </button>
                <div className="profile-header">
                  <div className="profile-avatar-large">
                    <img src={session?.user?.user_metadata?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s64-c'} alt="Profile Large" />
                    <div className="edit-badge">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10.5974 0.402648C10.3395 0.144835 9.98979 0 9.62516 0C9.26052 0 8.91082 0.144835 8.65296 0.402648L8.04692 1.0087L9.9913 2.95308L10.5974 2.34703C10.8552 2.08918 11 1.73947 11 1.37484C11 1.01021 10.8552 0.660505 10.5974 0.402648ZM9.43554 3.50885L7.49115 1.56446L1.12685 7.92876C0.803581 8.25187 0.565942 8.65046 0.43542 9.08848L0.0163715 10.4949C-0.0038601 10.5628 -0.00536903 10.6349 0.0120044 10.7035C0.0293779 10.7722 0.0649875 10.8349 0.115066 10.8849C0.165143 10.935 0.227827 10.9706 0.296484 10.988C0.365141 11.0054 0.437217 11.0039 0.505087 10.9836L1.91152 10.5646C2.34954 10.4341 2.74813 10.1964 3.07124 9.87315L9.43554 3.50885Z" fill="white" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="profile-name">{session?.user?.user_metadata?.full_name?.toUpperCase() || 'USER'}</h2>
                  <p className="profile-email">{session?.user?.email || ''}</p>
                </div>

                <div className="profile-settings-section">
                  <div className="settings-panel profile-settings-panel">
                    <div className="settings-item-row">
                      <div className="settings-item-left">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 17.5C11.6625 17.4999 13.2779 16.9477 14.5925 15.93C15.9072 14.9124 16.8466 13.4869 17.2633 11.8775M10 17.5C8.33751 17.4999 6.72212 16.9477 5.40748 15.93C4.09284 14.9124 3.1534 13.4869 2.73667 11.8775M10 17.5C12.0708 17.5 13.75 14.1417 13.75 10C13.75 5.85833 12.0708 2.5 10 2.5M10 17.5C7.92917 17.5 6.25 14.1417 6.25 10C6.25 5.85833 7.92917 2.5 10 2.5M17.2633 11.8775C17.4175 11.2775 17.5 10.6483 17.5 10C17.5021 8.71009 17.1699 7.44166 16.5358 6.31833M17.2633 11.8775C15.041 13.1095 12.541 13.754 10 13.75C7.365 13.75 4.88917 13.0708 2.73667 11.8775M2.73667 11.8775C2.57896 11.2641 2.49944 10.6333 2.5 10C2.5 8.6625 2.85 7.40583 3.46417 6.31833M10 2.5C11.3302 2.49945 12.6366 2.8528 13.7852 3.5238C14.9337 4.19481 15.8831 5.15931 16.5358 6.31833M10 2.5C8.6698 2.49945 7.3634 2.8528 6.21484 3.5238C5.06628 4.19481 4.11692 5.15931 3.46417 6.31833M16.5358 6.31833C14.7214 7.88994 12.4004 8.75345 10 8.75C7.50167 8.75 5.21667 7.83333 3.46417 6.31833" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{translations[language].language}</span>
                      </div>
                      <div className="language-dropdown-container">
                        <div className="settings-item-right settings-item-right-clickable" onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}>
                          <span>{language === 'EN' ? 'EN' : language === 'ZH' ? '中文' : language === 'MS' ? 'MS' : language === 'JA' ? '日本語' : 'ไทย'}</span>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A0A4AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isLanguageDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                        {isLanguageDropdownOpen && (
                          <div className="language-dropdown-menu">
                            {['EN', 'ZH', 'MS', 'JA', 'TH'].map(lang => (
                              <div key={lang} className={`language-option ${language === lang ? 'selected' : ''}`} onClick={() => { setLanguage(lang); setIsLanguageDropdownOpen(false); }}>
                                <span>{lang === 'EN' ? 'EN' : lang === 'ZH' ? '中文' : lang === 'MS' ? 'MS' : lang === 'JA' ? '日本語' : 'ไทย'}</span>
                                {language === lang && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="settings-item-row">
                      <div className="settings-item-left">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="M4.93 4.93l1.41 1.41"></path><path d="M17.66 17.66l1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M6.34 17.66l-1.41 1.41"></path><path d="M19.07 4.93l-1.41 1.41"></path></svg>
                        <span>{translations[language].appearance}</span>
                      </div>
                      <div className="language-dropdown-container">
                        <div className="settings-item-right settings-item-right-clickable" onClick={() => setIsAppearanceDropdownOpen(!isAppearanceDropdownOpen)}>
                          <span>{appearance === 'light' ? translations[language].light : translations[language].dark}</span>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A0A4AB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isAppearanceDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                        {isAppearanceDropdownOpen && (
                          <div className="language-dropdown-menu">
                            {['light', 'dark'].map(mode => (
                              <div key={mode} className={`language-option ${appearance === mode ? 'selected' : ''}`} onClick={() => { setAppearance(mode); setIsAppearanceDropdownOpen(false); }}>
                                <span>{mode === 'light' ? translations[language].light : translations[language].dark}</span>
                                {appearance === mode && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="profile-menu">
                  <button className="menu-btn">
                    <div className="menu-btn-left">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                      <span>{translations[language].helpFeedback}</span>
                    </div>
                  </button>
                </div>

                <div className="profile-footer">
                  <button className="signout-btn" style={{ cursor: 'pointer', position: 'relative', zIndex: 100 }} onClick={async (e) => {
                    e.stopPropagation();
                    closeProfile();
                    if (supabase) {
                      await supabase.auth.signOut();
                    }
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    {translations[language].signOut}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Edit Todo Modal */}
        {editingTodo && (
          <div
            className={`backdrop modal-backdrop edit-modal-backdrop ${isEditModalMobileLayout ? 'edit-modal-backdrop-mobile' : 'edit-modal-backdrop-desktop'}`}
            onClick={closeEditModal}
            style={editModalBackdropStyle}
          >
            <div
              className={`edit-modal ${isEditModalMobileLayout ? 'edit-modal-mobile' : 'edit-modal-desktop'}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-modal-title"
              style={editModalViewportStyle}
              {...editSwipeHandlers}
            >
              <div className="edit-modal-header">
                <h2 className="edit-modal-title" id="edit-modal-title">{translations[language].editTaskTitle}</h2>
                <button type="button" className="edit-modal-close" onClick={closeEditModal} aria-label={translations[language].close}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div className="edit-modal-body" ref={editModalBodyRef}>
                <textarea
                  ref={editTextareaRef}
                  className="edit-modal-textarea"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onFocus={handleEditTextareaFocus}
                  onBlur={() => setIsEditTextareaFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleEditSave();
                    }
                  }}
                  autoFocus
                  rows={6}
                  placeholder={translations[language].editTaskPlaceholder}
                />
              </div>
              <div className="edit-modal-actions">
                <button type="button" className="edit-modal-save-btn" onClick={handleEditSave}>
                  {translations[language].save}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default MobileApp;
