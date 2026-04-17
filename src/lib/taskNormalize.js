import { sections } from './desktopConstants';
import { getDerivedTaskFields, normalizeCardType } from '../taskCardUtils';
import { dateKey } from './dateUtils';
import { getLogicalToday } from './dateHelpers';
import { isValidDesktopSlot, isFiniteCanvasCoordinate } from './domUtils';
import { getTaskWorkspaceId } from './workspaceUtils';
import { normalizePackIcon, normalizePackCover, normalizePackTags, normalizePackActiveDurationType, normalizePackActiveDate } from './packPageUtils';

export const normalizeTask = (task) => {
  const derivedFields = getDerivedTaskFields(task.text || '');

  return {
    ...derivedFields,
    ...task,
    text: task.text || '',
    completed: task.completed ?? false,
    dateString: task.dateString || dateKey(getLogicalToday()),
    timeOfDay: task.timeOfDay || sectionIdToMobileId(task.section),
    cardType: normalizeCardType(task.cardType || derivedFields.cardType),
    updatedAt: typeof task.updatedAt === 'string' && task.updatedAt.trim() ? task.updatedAt : null,
    desktopSlot: isValidDesktopSlot(task.desktopSlot) ? task.desktopSlot : null,
    desktopCanvasX: isFiniteCanvasCoordinate(task.desktopCanvasX) ? task.desktopCanvasX : null,
    desktopCanvasY: isFiniteCanvasCoordinate(task.desktopCanvasY) ? task.desktopCanvasY : null,
    desktopZ: Number.isFinite(task.desktopZ) ? task.desktopZ : null,
    desktopWorkspaceId: getTaskWorkspaceId(task),
    desktopGroupId: typeof task.desktopGroupId === 'string' && task.desktopGroupId.trim() ? task.desktopGroupId : null,
    desktopGroupName: typeof task.desktopGroupName === 'string' && task.desktopGroupName.trim() ? task.desktopGroupName : null,
    desktopGroupIcon: normalizePackIcon(task.desktopGroupIcon),
    desktopGroupCover: normalizePackCover(task.desktopGroupCover),
    desktopGroupTags: normalizePackTags(task.desktopGroupTags),
    desktopGroupActiveDurationType: normalizePackActiveDurationType(task.desktopGroupActiveDurationType),
    desktopGroupActiveFrom: normalizePackActiveDate(task.desktopGroupActiveFrom),
    desktopGroupActiveUntil: normalizePackActiveDate(task.desktopGroupActiveUntil),
    photoDataUrl: typeof task.photoDataUrl === 'string' && task.photoDataUrl.trim() ? task.photoDataUrl : null,
    photoFileName: typeof task.photoFileName === 'string' && task.photoFileName.trim() ? task.photoFileName : null,
    photoMimeType: typeof task.photoMimeType === 'string' && task.photoMimeType.trim() ? task.photoMimeType : null,
    photoWidth: Number.isFinite(task.photoWidth) ? task.photoWidth : null,
    photoHeight: Number.isFinite(task.photoHeight) ? task.photoHeight : null,
    photoUrl: typeof task.photoUrl === 'string' && task.photoUrl.trim() ? task.photoUrl : null,
    photoTitle: typeof task.photoTitle === 'string' && task.photoTitle.trim() ? task.photoTitle : null,
    uploadedFileStorageKey: typeof task.uploadedFileStorageKey === 'string' && task.uploadedFileStorageKey.trim() ? task.uploadedFileStorageKey : null,
    uploadedFileType: typeof task.uploadedFileType === 'string' && task.uploadedFileType.trim() ? task.uploadedFileType : null,
    uploadedOriginalFileName: typeof task.uploadedOriginalFileName === 'string' && task.uploadedOriginalFileName.trim() ? task.uploadedOriginalFileName : null,
    uploadedMimeType: typeof task.uploadedMimeType === 'string' && task.uploadedMimeType.trim() ? task.uploadedMimeType : null,
    uploadedFileSize: Number.isFinite(task.uploadedFileSize) ? task.uploadedFileSize : null,
    uploadedSourceLabel: typeof task.uploadedSourceLabel === 'string' && task.uploadedSourceLabel.trim() ? task.uploadedSourceLabel : null,
    uploadedCreatedAt: typeof task.uploadedCreatedAt === 'string' && task.uploadedCreatedAt.trim() ? task.uploadedCreatedAt : null,
    uploadedUpdatedAt: typeof task.uploadedUpdatedAt === 'string' && task.uploadedUpdatedAt.trim() ? task.uploadedUpdatedAt : null,
    extractedText: typeof task.extractedText === 'string' && task.extractedText.trim() ? task.extractedText : null,
  };
};

export const sectionIdToMobileId = (sectionId) => {
  const matched = sections.find((section) => section.id === sectionId);
  return matched?.mobileId || 'Morning';
};