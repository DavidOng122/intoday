import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ArrowUp, Maximize2, Minimize2 } from 'lucide-react';
import { subDays, addDays, format, isSameDay } from 'date-fns';
import { SendIntent } from 'send-intent';
import useKeyboardOffset from '../hooks/useKeyboardOffset';
import useSwipeDownToClose from '../hooks/useSwipeDownToClose';
import { supabase } from '../lib/supabase';
import { cardTypeConfig } from '../lib/cardTypeConfig';
import { getCurrentTimeBlock, getLogicalToday } from '../lib/dateHelpers';
import { detectCardType, extractMapUrl, extractVideoUrl, fetchMapMeta, fetchVideoMeta } from '../lib/taskParsers';
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
const INITIAL_EDIT_MODAL_VIEWPORT = {
  baseHeight: 0,
  visibleHeight: 0,
  offsetTop: 0,
  keyboardInset: 0,
};
const modalSwipeTransform = (offsetY = 0) => `translateY(${offsetY}px)`;

function MobileApp({ session, platformInfo }) {
  const { platform, isNativePlatform, isIOS, isAndroid } = platformInfo;

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
  const [isTaskInputFocused, setIsTaskInputFocused] = useState(false);
  const [canExpandComposer, setCanExpandComposer] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [sheetBaseHeight, setSheetBaseHeight] = useState(null);
  const [sheetBaseViewportHeight, setSheetBaseViewportHeight] = useState(0);

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

  // Day boundary is 06:00 AM — midnight–05:59 belongs to the previous calendar day.
  const getLogicalToday = () => {
    const now = new Date();
    now.setHours(now.getHours() - 6);
    now.setHours(0, 0, 0, 0);
    return now;
  };

  const [selectedDate, setSelectedDate] = useState(() => getLogicalToday());
  const [currentTime, setCurrentTime] = useState(new Date());

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isClosingProfile, setIsClosingProfile] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calPickerDate, setCalPickerDate] = useState(() => getLogicalToday());
  const profileScrollRef = React.useRef(null);

  useEffect(() => {
    if (!isSheetOpen) {
      setIsTaskInputFocused(false);
      setCanExpandComposer(false);
      setIsComposerExpanded(false);
      setSheetBaseHeight(null);
      setSheetBaseViewportHeight(0);
      return;
    }

    const baseViewportHeight = window.innerHeight;
    setSheetBaseViewportHeight(baseViewportHeight);
    setSheetBaseHeight(Math.min(760, Math.max(0, baseViewportHeight - 24)));
  }, [isSheetOpen]);

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

  const { composerLift, sheetContentLift } = useKeyboardOffset({
    enabled: isSheetOpen,
    baseHeight: sheetBaseHeight,
    baseViewportHeight: sheetBaseViewportHeight,
    isAndroid,
  });
  const closeSheet = useCallback(() => {
    setIsCalendarOpen(false);
    setIsComposerExpanded(false);
    setIsSheetOpen(false);
  }, []);

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

  const accountTouchStartY = React.useRef(null);
  const accountCurrentY = React.useRef(0);

  const handleAccountTouchStart = (e) => {
    accountTouchStartY.current = e.touches[0].clientY;
  };
  const handleAccountTouchMove = (e) => {
    const canSwipeToClose = !profileScrollRef.current || profileScrollRef.current.scrollTop <= 0;

    if (!canSwipeToClose || accountTouchStartY.current === null) return;

    const dy = e.touches[0].clientY - accountTouchStartY.current;
    if (dy > 0) {
      accountCurrentY.current = dy;
      const el = e.currentTarget;
      el.style.transform = `translateY(${dy}px)`;
      el.style.transition = 'none';
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };
  const handleAccountTouchEnd = (e) => {
    if (accountTouchStartY.current === null) return;
    const dy = accountCurrentY.current;
    const el = e.currentTarget;
    if (dy > 120) {
      el.style.transition = 'transform 0.25s ease-out';
      el.style.transform = 'translateY(100vh)';
      setTimeout(() => closeProfile(true), 200);
    } else {
      el.style.transition = 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
      el.style.transform = 'translateY(0)';
    }
    accountTouchStartY.current = null;
    accountCurrentY.current = 0;
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
    enabled: isSheetOpen && isIOS,
    onClose: closeSheet,
    getScrollElement: '.sheet-content',
    ignoreSwipeFrom: '.sheet-input-area',
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
  const stripRef = React.useRef(null);
  const timelineShellRef = React.useRef(null);
  const dayRefs = React.useRef({});
  const timelineRef = React.useRef(null);
  const overlayLabelRefs = React.useRef({});
  const overlayLabelStateRef = React.useRef({});
  const overlayUpdateFrameRef = React.useRef(null);
  const overlayAnimationFrameRef = React.useRef(null);
  const timelineLabelsVisibleRef = React.useRef(false);
  const timelineLabelsHideTimeoutRef = React.useRef(null);
  const dayScrollPositionsRef = React.useRef({});
  const hasAutoScrolledToTodayRef = React.useRef(false);
  // Scroll behavior is explicit so initial Today entry, Today-icon taps,
  // and horizontal day navigation can each do the right thing.
  const pendingTimelineScrollActionRef = React.useRef({
    type: 'initial-today',
    scrollTop: null,
    behavior: 'auto',
  });
  const daySwipeStateRef = React.useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    lock: null,
  });
  const transitionTimeoutRef = React.useRef(null);

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
    if (overlayAnimationFrameRef.current) {
      window.cancelAnimationFrame(overlayAnimationFrameRef.current);
    }
    if (timelineLabelsHideTimeoutRef.current) {
      window.clearTimeout(timelineLabelsHideTimeoutRef.current);
    }
  }, []);

  const animateOverlayLabels = useCallback(() => {
    let shouldContinue = false;

    timeBlocks.forEach((block) => {
      const labelEl = overlayLabelRefs.current[block.id];
      const state = overlayLabelStateRef.current[block.id];
      if (!labelEl || !state) return;

      if (state.targetVisible) {
        if (!Number.isFinite(state.currentY)) {
          state.currentY = state.targetY;
        } else {
          state.currentY += (state.targetY - state.currentY) * 0.18;
          if (Math.abs(state.targetY - state.currentY) < 0.18) {
            state.currentY = state.targetY;
          } else {
            shouldContinue = true;
          }
        }

        labelEl.style.transform = `translate3d(-50%, ${state.currentY}px, 0)`;
      }

      labelEl.style.opacity = state.targetVisible ? '0.96' : '0';
    });

    if (shouldContinue) {
      overlayAnimationFrameRef.current = window.requestAnimationFrame(animateOverlayLabels);
    } else {
      overlayAnimationFrameRef.current = null;
    }
  }, []);

  const ensureOverlayAnimation = useCallback(() => {
    if (overlayAnimationFrameRef.current) return;
    overlayAnimationFrameRef.current = window.requestAnimationFrame(animateOverlayLabels);
  }, [animateOverlayLabels]);

  const hideTimelineLabels = useCallback(() => {
    timelineLabelsVisibleRef.current = false;
    timeBlocks.forEach((block) => {
      const state = overlayLabelStateRef.current[block.id] || {};
      state.targetVisible = false;
      state.wasVisible = false;
      overlayLabelStateRef.current[block.id] = state;
      const labelEl = overlayLabelRefs.current[block.id];
      if (labelEl) {
        labelEl.style.opacity = '0';
      }
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
    const enterInset = 8;
    const exitBuffer = 34;
    const labelSpacing = 24;
    const activeBlocks = new Map();
    const visibleDescriptors = [];

    timelineEl.querySelectorAll('.time-block[data-overlay-source="true"]').forEach((blockEl) => {
      const blockId = blockEl.dataset.timeBlockId;
      if (!blockId) return;
      activeBlocks.set(blockId, blockEl);
    });

    timeBlocks.forEach((block) => {
      const labelEl = overlayLabelRefs.current[block.id];
      const blockEl = activeBlocks.get(block.id);
      const state = overlayLabelStateRef.current[block.id] || {
        currentY: Number.NaN,
        targetY: 0,
        targetVisible: false,
        wasVisible: false,
      };
      overlayLabelStateRef.current[block.id] = state;

      if (!labelEl || !blockEl) {
        state.targetVisible = false;
        state.wasVisible = false;
        return;
      }

      const blockTop = blockEl.offsetTop;
      const blockBottom = blockTop + blockEl.offsetHeight;
      const visible = state.wasVisible
        ? blockBottom > scrollTop - exitBuffer && blockTop < scrollTop + viewportHeight + exitBuffer
        : blockBottom > scrollTop + enterInset && blockTop < scrollTop + viewportHeight - enterInset;

      if (visible) {
        visibleDescriptors.push({
          id: block.id,
          naturalY: blockTop - scrollTop + overlayOffset,
          state,
        });
      } else {
        state.targetVisible = false;
        state.wasVisible = false;
      }
    });

    visibleDescriptors.sort((a, b) => a.naturalY - b.naturalY);

    for (let i = visibleDescriptors.length - 1; i >= 0; i -= 1) {
      const descriptor = visibleDescriptors[i];
      let finalY = Math.max(overlayOffset, descriptor.naturalY);

      if (i < visibleDescriptors.length - 1) {
        finalY = Math.min(finalY, visibleDescriptors[i + 1].state.targetY - labelSpacing);
      }

      descriptor.state.targetY = finalY;
      descriptor.state.targetVisible = true;
      descriptor.state.wasVisible = true;
      if (!Number.isFinite(descriptor.state.currentY)) {
        descriptor.state.currentY = finalY;
      }
    }

    ensureOverlayAnimation();
  }, [ensureOverlayAnimation, hideTimelineLabels]);

  const scheduleOverlayRefresh = useCallback(() => {
    if (overlayUpdateFrameRef.current) {
      window.cancelAnimationFrame(overlayUpdateFrameRef.current);
    }

    overlayUpdateFrameRef.current = window.requestAnimationFrame(() => {
      overlayUpdateFrameRef.current = null;
      refreshVisibleTimeBlockLabels();
    });
  }, [refreshVisibleTimeBlockLabels]);

  const scheduleHideTimelineLabels = useCallback((delay = 1450) => {
    if (timelineLabelsHideTimeoutRef.current) {
      window.clearTimeout(timelineLabelsHideTimeoutRef.current);
    }

    timelineLabelsHideTimeoutRef.current = window.setTimeout(() => {
      hideTimelineLabels();
    }, delay);
  }, [hideTimelineLabels]);

  const activateTimelineLabels = useCallback((delay = 1450) => {
    timelineLabelsVisibleRef.current = true;
    scheduleOverlayRefresh();
    scheduleHideTimelineLabels(delay);
  }, [scheduleHideTimelineLabels, scheduleOverlayRefresh]);

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
      scheduleHideTimelineLabels(1500);
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

  const resetDaySwipeState = useCallback(() => {
    daySwipeStateRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startTime: 0,
      lock: null,
    };
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

  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('todos');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map(t => ({ ...t, dateString: t.dateString || format(new Date(), 'yyyy-MM-dd') }));
    } else {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const getCurrentTimeBlock = () => {
    const hour = currentTime.getHours();
    if (hour >= 0 && hour < 6) return 'Midnight';
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    if (hour >= 18 && hour < 22) return 'Evening';
    return 'Night';
  };

  const handleAddTodo = () => {
    if (!inputText.trim()) return;
    const resolvedBlock = activeChip === 'Now' ? getCurrentTimeBlock() : activeChip;
    const rawText = inputText.trim();
    const cardType = detectCardType(rawText);

    const newTodoId = Date.now();
    const videoUrl = cardType === 'video' ? extractVideoUrl(rawText) : null;
    const mapUrl = cardType === 'map' ? extractMapUrl(rawText) : null;

    const newTodo = {
      id: newTodoId,
      text: rawText,
      timeOfDay: resolvedBlock,
      completed: false,
      dateString: format(selectedDate, 'yyyy-MM-dd'),
      cardType,
      videoUrl,
      mapUrl
    };

    setTodos(prev => [...prev, newTodo]);
    setInputText('');
    closeSheet();

    // Fetch metadata asynchronously without blocking the UI
    if (cardType === 'video' && videoUrl) {
      fetchVideoMeta(videoUrl).then(meta => {
        setTodos(prev => prev.map(t => t.id === newTodoId ? { ...t, ...meta } : t));
      });
    } else if (cardType === 'map' && mapUrl) {
      fetchMapMeta(mapUrl).then(meta => {
        setTodos(prev => prev.map(t => t.id === newTodoId ? { ...t, ...meta } : t));
      });
    }
  };

  const toggleTodo = (id) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const [draggedTodoId, setDraggedTodoId] = useState(null);
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [dragOverBlock, setDragOverBlock] = useState(null);

  // Sync swipe-open CSS class with openSwipeId state
  const prevOpenSwipeId = React.useRef(null);
  useEffect(() => {
    // Remove class from previously open wrapper
    if (prevOpenSwipeId.current !== null) {
      const prev = document.getElementById(`swipe-wrapper-${prevOpenSwipeId.current}`);
      if (prev) prev.classList.remove('swipe-open');
    }
    // Add class to newly open wrapper
    if (openSwipeId !== null) {
      const next = document.getElementById(`swipe-wrapper-${openSwipeId}`);
      if (next) next.classList.add('swipe-open');
    }
    prevOpenSwipeId.current = openSwipeId;
  }, [openSwipeId]);

  // Close any open swipe when tapping outside the swiped card
  useEffect(() => {
    if (openSwipeId === null) return;
    const handleOutsideTap = (e) => {
      const wrapper = document.getElementById(`swipe-wrapper-${openSwipeId}`);
      if (wrapper && !wrapper.contains(e.target)) {
        const el = document.getElementById(`swipe-card-${openSwipeId}`);
        const actionsEl = document.querySelector(`#swipe-wrapper-${openSwipeId} .swipe-actions`);
        if (el) {
          el.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = 'translateX(0)';
          setTimeout(() => { if (el) el.style.transition = ''; }, 280);
        }
        if (actionsEl) {
          actionsEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
          actionsEl.style.opacity = '0';
          actionsEl.style.transform = 'translateX(20px)';
          setTimeout(() => { if (actionsEl) actionsEl.style.transition = ''; }, 220);
        }
        setOpenSwipeId(null);
      }
    };
    document.addEventListener('touchstart', handleOutsideTap, { passive: true });
    document.addEventListener('mousedown', handleOutsideTap);
    return () => {
      document.removeEventListener('touchstart', handleOutsideTap);
      document.removeEventListener('mousedown', handleOutsideTap);
    };
  }, [openSwipeId]);

  const dragOverBlockRef = React.useRef(null); // readable in onTouchEnd closure
  const scrollBlocker = React.useRef(null);     // non-passive touchmove blocker

  const swipeTouchStartX = React.useRef(null);
  const swipeTouchStartY = React.useRef(null);
  const swipeCurrentOffset = React.useRef(0);
  const isDragMode = React.useRef(false);
  const dragOriginY = React.useRef(0);
  const dragTouchY = React.useRef(0);
  const activeDragTodoIdRef = React.useRef(null);
  const lockedTimelineScrollTop = React.useRef(0);
  const autoScrollVelocity = React.useRef(0);
  const autoScrollFrameRef = React.useRef(null);
  const autoScrollLastTsRef = React.useRef(null);

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

  const syncDraggedCardPosition = (todoId, touchY) => {
    const timelineEl = timelineRef.current;
    const scrollDelta = timelineEl ? timelineEl.scrollTop - lockedTimelineScrollTop.current : 0;
    const rawDy = touchY - dragOriginY.current + scrollDelta;
    const dy = Math.max(-2000, Math.min(2000, rawDy));
    const el = document.getElementById(`swipe-card-${todoId}`);
    if (el) el.style.transform = `translate3d(0, ${dy}px, 0) scale(1.04)`;

    const nearest = getNearestBlock(touchY);
    if (nearest !== dragOverBlockRef.current) {
      dragOverBlockRef.current = nearest;
      setDragOverBlock(nearest);
    }
  };

  const stopAutoScroll = useCallback(() => {
    autoScrollVelocity.current = 0;
    autoScrollLastTsRef.current = null;
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

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
      const prevScrollTop = timelineEl.scrollTop;
      const maxScrollTop = Math.max(0, timelineEl.scrollHeight - timelineEl.clientHeight);
      const nextScrollTop = Math.max(
        0,
        Math.min(maxScrollTop, prevScrollTop + autoScrollVelocity.current * elapsed)
      );
      if (nextScrollTop !== prevScrollTop) {
        timelineEl.scrollTop = nextScrollTop;
        syncDraggedCardPosition(todoId, dragTouchY.current);
      } else {
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
    const SCROLL_ZONE = 96;
    const MAX_SPEED = 1.35; // px per ms
    const maxScrollTop = Math.max(0, timelineEl.scrollHeight - timelineEl.clientHeight);

    let velocity = 0;

    if (touchY < rect.top + SCROLL_ZONE) {
      const intensity = (rect.top + SCROLL_ZONE - touchY) / SCROLL_ZONE;
      velocity = -MAX_SPEED * Math.min(Math.max(intensity, 0), 1);
    } else if (touchY > rect.bottom - SCROLL_ZONE) {
      const intensity = (touchY - (rect.bottom - SCROLL_ZONE)) / SCROLL_ZONE;
      velocity = MAX_SPEED * Math.min(Math.max(intensity, 0), 1);
    }

    if ((velocity < 0 && timelineEl.scrollTop <= 0) || (velocity > 0 && timelineEl.scrollTop >= maxScrollTop)) {
      velocity = 0;
    }

    autoScrollVelocity.current = velocity;

    if (velocity !== 0 && autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    } else if (velocity === 0) {
      stopAutoScroll();
    }
  }, [runAutoScroll, stopAutoScroll]);

  const SWIPE_MAX = 136; // px — width of both action buttons
  const SNAP_THRESHOLD = 50;

  const deleteTodo = (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    setOpenSwipeId(null);
  };



  const openEdit = (todo) => {
    setEditingTodo(todo);
    setEditText(todo.text);
    setOpenSwipeId(null);
  };

  const handleEditSave = () => {
    if (!editText.trim()) return;
    setTodos(prev => prev.map(t =>
      t.id === editingTodo.id ? { ...t, text: editText.trim() } : t
    ));
    closeEditModal();
  };

  const getSwipeHandlers = (todoId) => ({
    onTouchStart: (e) => {
      const touch = e.touches[0];
      swipeTouchStartX.current = touch.clientX;
      swipeTouchStartY.current = touch.clientY;
      isDragMode.current = false; // wait for direction detection in onTouchMove
      swipeCurrentOffset.current = 0;

      if (openSwipeId !== null && openSwipeId !== todoId) setOpenSwipeId(null);
    },
    onTouchMove: (e) => {
      const touch = e.touches[0];
      if (swipeTouchStartX.current === null) return;

      const deltaX = touch.clientX - swipeTouchStartX.current;
      const deltaY = touch.clientY - swipeTouchStartY.current;

      // If already in drag mode, handle vertical dragging
      if (isDragMode.current) {
        e.preventDefault();
        dragTouchY.current = touch.clientY;
        updateAutoScroll(touch.clientY);
        syncDraggedCardPosition(todoId, touch.clientY);
        return;
      }

      // Direction detection threshold
      const DIRECTION_THRESHOLD = 8;
      if (Math.abs(deltaX) < DIRECTION_THRESHOLD && Math.abs(deltaY) < DIRECTION_THRESHOLD) return;

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        // Vertical movement → activate drag immediately (no long press)
        e.preventDefault();
        isDragMode.current = true;
        dragOriginY.current = swipeTouchStartY.current;
        dragTouchY.current = touch.clientY;
        activeDragTodoIdRef.current = todoId;
        setDraggedTodoId(todoId);
        lockTimelineScroll();

        const el = document.getElementById(`swipe-card-${todoId}`);
        const wrapper = document.getElementById(`swipe-wrapper-${todoId}`);
        if (el) {
          el.style.transition = 'box-shadow 0.12s ease, opacity 0.12s ease';
          el.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.12)';
          el.style.opacity = '0.95';
          el.style.zIndex = '100';
          el.style.willChange = 'transform';
        }
        // Lock page scroll
        const blocker = (ev) => ev.preventDefault();
        scrollBlocker.current = blocker;
        window.addEventListener('touchmove', blocker, { passive: false });

        if (wrapper) {
          wrapper.classList.add('is-dragging');
          const parentBlock = wrapper.closest('.time-block');
          if (parentBlock) parentBlock.classList.add('is-dragging-parent');
        }
        document.body.classList.add('is-dragging-global');

        syncDraggedCardPosition(todoId, touch.clientY);
        updateAutoScroll(touch.clientY);
      } else {
        // Horizontal movement → swipe to reveal actions with fade (left only)
        if (deltaX > 0) return;
        const rawOffset = Math.abs(deltaX);
        let offset;
        if (rawOffset <= SWIPE_MAX) {
          offset = rawOffset;
        } else {
          const overflow = rawOffset - SWIPE_MAX;
          offset = SWIPE_MAX + overflow * 0.15;
        }
        swipeCurrentOffset.current = offset;
        const el = document.getElementById(`swipe-card-${todoId}`);
        const actionsEl = document.querySelector(`#swipe-wrapper-${todoId} .swipe-actions`);
        if (el) el.style.transform = `translateX(-${offset}px)`;
        if (actionsEl) {
          const progress = Math.min(offset / SWIPE_MAX, 1);
          actionsEl.style.opacity = progress;
          // Slide in from 20px to 0px as you swipe, sitting perfectly behind the card
          const slideX = 20 * (1 - progress);
          actionsEl.style.transform = `translateX(${slideX}px)`;
        }
      }
    },
    onTouchEnd: (e) => {
      if (isDragMode.current) {
        isDragMode.current = false;
        stopAutoScroll();
        const el = document.getElementById(`swipe-card-${todoId}`);
        const wrapper = document.getElementById(`swipe-wrapper-${todoId}`);

        // Use ref for stale-closure-safe latest nearest block
        const targetBlock = dragOverBlockRef.current;
        if (targetBlock) {
          setTodos(prev => prev.map(t => t.id === todoId ? { ...t, timeOfDay: targetBlock } : t));
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
        if (wrapper) {
          wrapper.classList.remove('is-dragging');
          const parentBlock = wrapper.closest('.time-block');
          if (parentBlock) parentBlock.classList.remove('is-dragging-parent');
        }
        document.body.classList.remove('is-dragging-global');
        unlockTimelineScroll();
        activeDragTodoIdRef.current = null;
        setDraggedTodoId(null);
        setDragOverBlock(null);
        // Release scroll lock
        if (scrollBlocker.current) {
          window.removeEventListener('touchmove', scrollBlocker.current);
          scrollBlocker.current = null;
        }
        dragOverBlockRef.current = null;
        swipeTouchStartX.current = null;
        swipeTouchStartY.current = null;
        swipeCurrentOffset.current = 0;
        return;
      }

      // Regular swipe snap
      const offset = swipeCurrentOffset.current;
      const el = document.getElementById(`swipe-card-${todoId}`);
      const actionsEl = document.querySelector(`#swipe-wrapper-${todoId} .swipe-actions`);
      if (offset >= SNAP_THRESHOLD) {
        if (el) {
          el.style.transition = 'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = `translateX(-${SWIPE_MAX}px)`;
          setTimeout(() => { if (el) el.style.transition = ''; }, 320);
        }
        if (actionsEl) {
          actionsEl.style.transition = 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
          actionsEl.style.opacity = '1';
          actionsEl.style.transform = 'translateX(0)';
          actionsEl.style.pointerEvents = 'auto'; // enable clicks immediately
          setTimeout(() => { if (actionsEl) { actionsEl.style.transition = ''; } }, 300);
        }
        setOpenSwipeId(todoId);
      } else {
        if (el) {
          el.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
          el.style.transform = 'translateX(0)';
          setTimeout(() => { if (el) el.style.transition = ''; }, 280);
        }
        if (actionsEl) {
          actionsEl.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
          actionsEl.style.opacity = '0';
          actionsEl.style.transform = 'translateX(20px)';
          actionsEl.style.pointerEvents = 'none';
          setTimeout(() => { if (actionsEl) { actionsEl.style.transition = ''; } }, 220);
        }
        setOpenSwipeId(null);
      }
      swipeTouchStartX.current = null;
      swipeTouchStartY.current = null;
      swipeCurrentOffset.current = 0;
    },
  });

  const closeSwipe = (todoId) => {
    const el = document.getElementById(`swipe-card-${todoId}`);
    if (el) {
      el.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'translateX(0)';
      setTimeout(() => { if (el) el.style.transition = ''; }, 280);
    }
    setOpenSwipeId(null);
  };

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
    const todosCopy = [...todos];
    const draggedIndex = todosCopy.findIndex(t => t.id === draggedTodoId);
    if (draggedIndex === -1) return;
    const draggedTodo = todosCopy[draggedIndex];
    draggedTodo.timeOfDay = targetTodo.timeOfDay;
    todosCopy.splice(draggedIndex, 1);
    const newTargetIndex = todosCopy.findIndex(t => t.id === targetTodo.id);
    const insertIndex = isBottomHalf ? newTargetIndex + 1 : newTargetIndex;
    todosCopy.splice(insertIndex, 0, draggedTodo);
    setTodos(todosCopy);
  };

  const handleDropOnBlock = (e, blockId) => {
    e.preventDefault();
    if (!draggedTodoId) return;
    const todosCopy = [...todos];
    const draggedIndex = todosCopy.findIndex(t => t.id === draggedTodoId);
    if (draggedIndex === -1) return;
    const draggedTodo = todosCopy[draggedIndex];
    draggedTodo.timeOfDay = blockId;
    todosCopy.splice(draggedIndex, 1);
    todosCopy.push(draggedTodo);
    setTodos(todosCopy);
  };

  const logicalToday = getLogicalToday();
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
    return todos.filter(t => t.dateString === dateString);
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


  const getTimeIndicatorStyle = (block, date = selectedDate) => {
    if (!isSameDay(date, getLogicalToday())) return null;

    // Only show the indicator in the block that matches current time
    const currentBlockId = getCurrentTimeBlock();
    if (block.id !== currentBlockId) return null;

    const parseTime = (timeStr, isEnd) => {
      const [h, m] = timeStr.split(':').map(Number);
      return (h === 0 && timeStr === '00:00' && isEnd) ? 24 * 60 : h * 60 + m;
    };
    const startMins = parseTime(block.start, false);
    let endMins = parseTime(block.end, true);
    if (endMins <= startMins) endMins += 24 * 60;
    const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

    let percentage = (currentMins - startMins) / (endMins - startMins);
    // Clamp between 0 and 1 just in case of edge timing
    percentage = Math.max(0, Math.min(1, percentage));

    return { top: `calc(70px + (100% - 110px) * ${percentage})` };
  };

  const isTimeBlockPast = (block) => {
    // If selected date is in the past, all blocks are past.
    const today = getLogicalToday();
    const selDateMidnight = new Date(selectedDate);
    selDateMidnight.setHours(0, 0, 0, 0);

    if (selDateMidnight < today) return true;
    if (selDateMidnight > today) return false;

    // If it's today, check if the block's absolute end time has passed.
    const [h, m] = block.end.split(':').map(Number);
    let endDateTime = new Date(selectedDate);
    endDateTime.setHours(h, m, 0, 0);

    // Cross-midnight adjustment:
    // Night (ends at 00:00) and Midnight (ends at 06:00) are technically on the next calendar day.
    if (block.id === 'Midnight' || (block.id === 'Night' && h === 0)) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

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

  const handleDaySwipePointerDown = useCallback((e) => {
    if (!isCoarsePointer || anyOverlayOpen || dayTransition || !e.isPrimary || e.pointerType !== 'touch') return;
    if (e.currentTarget !== e.target) return;
    activateTimelineLabels(1550);

    daySwipeStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startTime: performance.now(),
      lock: null,
    };

    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [activateTimelineLabels, anyOverlayOpen, dayTransition, isCoarsePointer]);

  const handleDaySwipePointerMove = useCallback((e) => {
    const swipe = daySwipeStateRef.current;
    if (swipe.pointerId !== e.pointerId || anyOverlayOpen || dayTransition) return;
    activateTimelineLabels(1500);

    const dx = e.clientX - swipe.startX;
    const dy = e.clientY - swipe.startY;
    swipe.lastX = e.clientX;
    swipe.lastY = e.clientY;

    if (!swipe.lock) {
      if (Math.abs(dx) < DAY_SWIPE_CONFIG.INTENT_THRESHOLD_PX && Math.abs(dy) < DAY_SWIPE_CONFIG.INTENT_THRESHOLD_PX) {
        return;
      }

      if (Math.abs(dx) > Math.abs(dy) * DAY_SWIPE_CONFIG.HORIZONTAL_LOCK_RATIO && Math.abs(dx) > DAY_SWIPE_CONFIG.INTENT_THRESHOLD_PX) {
        swipe.lock = 'horizontal';
      } else {
        swipe.lock = 'vertical';
        setDaySwipeOffset(0);
        return;
      }
    }

    if (swipe.lock !== 'horizontal') return;

    if (e.cancelable) {
      e.preventDefault();
    }

    const resistedOffset = Math.sign(dx) * Math.min(
      Math.abs(dx) * DAY_SWIPE_CONFIG.DRAG_RESISTANCE,
      DAY_SWIPE_CONFIG.MAX_DRAG_OFFSET_PX
    );
    setDaySwipeOffset(resistedOffset);
  }, [activateTimelineLabels, anyOverlayOpen, dayTransition]);

  const handleDaySwipePointerEnd = useCallback((e) => {
    const swipe = daySwipeStateRef.current;
    if (swipe.pointerId !== e.pointerId) return;

    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const totalDx = e.clientX - swipe.startX;
    const elapsed = Math.max(performance.now() - swipe.startTime, 1);
    const velocityX = totalDx / elapsed;

    const shouldChangeDay = swipe.lock === 'horizontal' && (
      Math.abs(totalDx) >= DAY_SWIPE_CONFIG.CHANGE_DAY_THRESHOLD_PX ||
      Math.abs(velocityX) >= DAY_SWIPE_CONFIG.VELOCITY_THRESHOLD_PX_PER_MS
    );

    if (shouldChangeDay && !dayTransition && !anyOverlayOpen) {
      const nextDate = totalDx < 0 ? addDays(selectedDate, 1) : subDays(selectedDate, 1);
      transitionToDate(nextDate, {
        durationMs: DAY_SWIPE_CONFIG.SWIPE_ANIMATION_DURATION_MS,
      });
    } else {
      setDaySwipeOffset(0);
    }

    resetDaySwipeState();
    scheduleHideTimelineLabels(1550);
  }, [anyOverlayOpen, dayTransition, resetDaySwipeState, scheduleHideTimelineLabels, selectedDate, transitionToDate]);

  const renderTimelineBlocks = useCallback((date, options = {}) => {
    const dayTodos = getDayTodos(date);
    const dateKey = format(date, 'yyyy-MM-dd');

    return timeBlocks.map((block) => {
      const blockTodos = dayTodos.filter(t => t.timeOfDay === block.id);
      const indicatorStyle = getTimeIndicatorStyle(block, date);
      const enableEmptyAreaSwipe = !options.isStatic;

      return (
        <div
          className="time-block"
          key={`${dateKey}-${block.id}`}
          data-time-block-id={block.id}
          data-date-key={dateKey}
          data-overlay-source={!options.isStatic ? 'true' : 'false'}
        >
          <div className="time-col">
            <span className="time-text">{block.start}</span>
            {indicatorStyle && (
              <img
                src="/pin.png"
                alt="now"
                className="current-time-indicator-wrapper"
                style={indicatorStyle}
              />
            )}
            <span className="time-text bottom">{block.end}</span>
          </div>
          <div
            className={`tasks-col ${enableEmptyAreaSwipe ? 'tasks-col-swipe-enabled' : ''}`}
            data-block-id={block.id}
            onDragOver={options.isStatic ? undefined : handleDragOver}
            onDrop={options.isStatic ? undefined : (e) => handleDropOnBlock(e, block.id)}
            onPointerDown={enableEmptyAreaSwipe ? handleDaySwipePointerDown : undefined}
            onPointerMove={enableEmptyAreaSwipe ? handleDaySwipePointerMove : undefined}
            onPointerUp={enableEmptyAreaSwipe ? handleDaySwipePointerEnd : undefined}
            onPointerCancel={enableEmptyAreaSwipe ? handleDaySwipePointerEnd : undefined}
          >
            {blockTodos.map(todo => {
              const cType = todo.cardType || 'plain';
              const cfg = cardTypeConfig[cType] || cardTypeConfig.plain;
              const isVideo = cType === 'video';
              const isMap = cType === 'map';
              const isMeeting = cType === 'meeting';
              const isPlain = cType === 'plain';

              let displayTitle = todo.text;
              let displaySub = translations[language].actionItem;
              let redirectUrl = null;

              if (isVideo && todo.videoTitle) {
                displayTitle = todo.videoTitle;
                displaySub = todo.videoPlatform || 'Saved Video';
                redirectUrl = todo.videoUrl;
              } else if (isMap && todo.mapTitle) {
                displayTitle = todo.mapTitle;
                displaySub = todo.mapSubtitle || 'Location';
                redirectUrl = todo.mapUrl;
              } else if (isMeeting) {
                const timeMatch = todo.text.match(/\b(\d{1,2}:\d{2}(?:\s*[APap][Mm])?|\d{1,2}\s*[APap][Mm])\b/);
                displaySub = timeMatch ? timeMatch[1].trim() : 'Video Call';
                redirectUrl = todo.redirectUrl || null;
                displayTitle = todo.text
                  .split(/\n|　/)
                  .map(l => l.trim())
                  .filter(l =>
                    l.length > 0 &&
                    !/https?:\/\//i.test(l) &&
                    !/^開催日時|^開催方法|^date:|^time:|^method:/i.test(l)
                  )
                  .join(' ')
                  .replace(/https?:\/\/\S+/gi, '')
                  .replace(/\d{4}\/\d{2}\/\d{2}\s*\d{1,2}:\d{2}～?/g, '')
                  .replace(/\s{2,}/g, ' ')
                  .trim() || todo.text;
              } else if (isVideo && todo.videoUrl) {
                redirectUrl = todo.videoUrl;
              } else if (isMap && todo.mapUrl) {
                redirectUrl = todo.mapUrl;
              }

              return (
                <div key={todo.id} id={`swipe-wrapper-${todo.id}`} className="swipe-wrapper">
                  <div className="swipe-actions">
                    <button className="swipe-btn edit" onClick={() => openEdit(todo)}>
                      <img src="/edit.png" alt="Edit" className="swipe-icon" />
                    </button>
                    <button className="swipe-btn delete" onClick={() => deleteTodo(todo.id)}>
                      <img src="/delete.png" alt="Delete" className="swipe-icon" />
                    </button>
                  </div>

                  <div
                    id={`swipe-card-${todo.id}`}
                    className={`task-card ${todo.completed ? 'completed' : ''} ${draggedTodoId === todo.id ? 'dragging' : ''}`}
                    onClick={() => {
                      if (openSwipeId === todo.id) { closeSwipe(todo.id); return; }
                      if (isPlain) {
                        openEdit(todo);
                        return;
                      }
                      if (redirectUrl) {
                        window.open(redirectUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        toggleTodo(todo.id);
                      }
                    }}
                    draggable={!options.isStatic}
                    onDragStart={options.isStatic ? undefined : (e) => handleDragStart(e, todo.id)}
                    onDragEnd={options.isStatic ? undefined : handleDragEnd}
                    onDragOver={options.isStatic ? undefined : handleDragOver}
                    onDrop={options.isStatic ? undefined : (e) => handleDropOnTodo(e, todo)}
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
  }, [appearance, deleteTodo, draggedTodoId, getDayTodos, getSwipeHandlers, handleDaySwipePointerDown, handleDaySwipePointerEnd, handleDaySwipePointerMove, handleDragEnd, handleDragOver, handleDropOnBlock, handleDropOnTodo, language, openEdit, openSwipeId, toggleTodo]);

  const timelinePanels = useMemo(() => {
    if (!dayTransition) {
      return [{
        key: format(selectedDate, 'yyyy-MM-dd'),
        date: selectedDate,
        className: 'timeline-panel is-active',
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
  }, [daySwipeOffset, dayTransition, selectedDate]);

  useLayoutEffect(() => {
    scheduleOverlayRefresh();
  }, [scheduleOverlayRefresh, selectedDate, dayTransition, todos]);

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
    activateTimelineLabels(1550);
  }, [activateTimelineLabels]);

  const handleTimelineTouchMove = useCallback(() => {
    activateTimelineLabels(1500);
  }, [activateTimelineLabels]);

  const handleTimelineTouchEnd = useCallback(() => {
    scheduleHideTimelineLabels(1550);
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
      <div className={`app-container platform-${platform} ${isNativePlatform ? 'native-shell' : 'web-shell'} ${appearance === 'dark' ? 'dark-theme' : ''}`}>
        {/* Top Header */}
        <header className="header">
          <div className="header-side header-side-left">
            <div className="avatar" onClick={openProfilePanel} style={{ cursor: 'pointer' }}>
              <img src={session?.user?.user_metadata?.avatar_url || 'https://lh3.googleusercontent.com/a/default-user=s64-c'} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            </div>
          </div>

          <div className={`header-center ${isAndroid ? 'header-center-android' : 'header-center-ios'}`} style={{ justifyContent: isSameDay(selectedDate, getLogicalToday()) ? 'flex-start' : 'center' }}>
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
              <div className="header-title" style={{ transition: 'all 0.3s', fontSize: isSameDay(selectedDate, getLogicalToday()) ? '16px' : '20px', fontStyle: 'italic', fontFamily: '"LTC Bodoni 175", serif', fontWeight: 400, wordWrap: 'break-word', margin: 0 }}>
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
          className="calendar-strip"
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
            {timeBlocks.map((block) => (
              <div
                key={block.id}
                ref={(node) => {
                  if (node) {
                    overlayLabelRefs.current[block.id] = node;
                  } else {
                    delete overlayLabelRefs.current[block.id];
                  }
                }}
                className="timeline-overlay-label"
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
                  <div className={`sheet-lower-stack ${isCalendarOpen ? 'calendar-open' : ''}`}>
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

                        <div className="chips-container">
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
              onTouchStart={isIOS ? handleAccountTouchStart : undefined}
              onTouchMove={isIOS ? handleAccountTouchMove : undefined}
              onTouchEnd={isIOS ? handleAccountTouchEnd : undefined}
              onTouchCancel={isIOS ? handleAccountTouchEnd : undefined}
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
                <h2 className="edit-modal-title" id="edit-modal-title">Edit</h2>
                <button type="button" className="edit-modal-close" onClick={closeEditModal} aria-label="Close edit modal">
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
                  placeholder="Edit task..."
                />
              </div>
              <div className="edit-modal-actions">
                <button type="button" className="edit-modal-save-btn" onClick={handleEditSave}>
                  Save Changes
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
