import { CARD_TYPES, isTextCardType, normalizeCardType } from '../lib/cardTypeDetection';

export const TASK_INTERACTION_PLATFORMS = Object.freeze({
  MOBILE: 'mobile',
  DESKTOP: 'desktop',
});

export const PRIMARY_ACTION_TYPES = Object.freeze({
  EDIT: 'edit',
  OPEN: 'open',
});

export const SECONDARY_EDIT_ENTRY_TYPES = Object.freeze({
  MOBILE_SWIPE: 'mobile-swipe',
  DESKTOP_HOVER: 'desktop-hover',
});

const OPEN_FIRST_CARD_TYPES = new Set([
  CARD_TYPES.MEETING,
  CARD_TYPES.DOCUMENT,
  CARD_TYPES.VIDEO,
  CARD_TYPES.MUSIC,
  CARD_TYPES.PODCAST,
  CARD_TYPES.PLACE,
  CARD_TYPES.SOCIAL,
  CARD_TYPES.SHOPPING,
  CARD_TYPES.FINANCIAL,
  CARD_TYPES.LINK,
]);

export const isEditFirstTaskType = (cardType) => isTextCardType(normalizeCardType(cardType));

export const isOpenFirstTaskType = (cardType) => OPEN_FIRST_CARD_TYPES.has(normalizeCardType(cardType));

export const getTaskPrimaryActionType = ({ task, hasResolvedUrl }) => {
  if (isEditFirstTaskType(task?.cardType)) {
    return PRIMARY_ACTION_TYPES.EDIT;
  }

  if (isOpenFirstTaskType(task?.cardType) && hasResolvedUrl) {
    return PRIMARY_ACTION_TYPES.OPEN;
  }

  return PRIMARY_ACTION_TYPES.EDIT;
};

export const getTaskSecondaryEditEntry = (platform) => (
  platform === TASK_INTERACTION_PLATFORMS.MOBILE
    ? SECONDARY_EDIT_ENTRY_TYPES.MOBILE_SWIPE
    : SECONDARY_EDIT_ENTRY_TYPES.DESKTOP_HOVER
);
