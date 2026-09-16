import { normalizeTask } from '../../../lib/taskNormalize';
import { saveUploadedFileBlob } from '../../../shared/storage/uploadedFileStorage';
import { CARD_TYPES } from '../../../entities/task/model/taskCardPresentation';
import { createUpdatedTimestamp } from '../../pack/model/packMetadata';
import { UPLOADED_FILE_SOURCE_LABEL } from '../config/uploadConstants';
import { createUploadedFileStorageKey, getSupportedUploadKind, getUploadedFileTitle } from './uploadUtils';

// This is deliberately UI-free. Every upload entry point must create the same
// local blob record and task payload before a hook decides where it appears.
export const createUploadedTasks = async (files, { workspaceId, dateString }) => {
  const operationUpdatedAt = createUpdatedTimestamp();

  return Promise.all(files.map(async (file, index) => {
    const uploadKind = getSupportedUploadKind(file);
    if (!uploadKind) {
      throw new Error(`Unsupported file type: ${file?.name || 'unknown'}`);
    }
    const isImageAttachment = uploadKind === 'image';
    const attachment = {
      file,
      uploadKind,
      originalFileName: file.name || (isImageAttachment ? 'photo' : 'untitled-file'),
      title: getUploadedFileTitle(file.name, isImageAttachment ? 'Photo' : 'Untitled file'),
      mimeType: file.type || 'application/octet-stream',
      size: Number.isFinite(file.size) ? file.size : 0,
      createdAt: operationUpdatedAt,
    };
    const storageKey = createUploadedFileStorageKey(attachment.originalFileName);
    // IndexedDB is an offline fallback, never the source of truth. Its quota
    // must not prevent a cloud upload from being queued.
    try {
      await saveUploadedFileBlob({
        storageKey,
        blob: attachment.file,
        metadata: {
          originalFileName: attachment.originalFileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          uploadedFileType: attachment.uploadKind,
          createdAt: operationUpdatedAt,
          updatedAt: operationUpdatedAt,
        },
      });
    } catch (error) {
      console.warn('Failed to cache uploaded file locally:', error);
    }

    return normalizeTask({
      id: Date.now() + index + Math.floor(Math.random() * 1000),
      text: attachment.title,
      title: attachment.title,
      completed: false,
      desktopWorkspaceId: workspaceId,
      timeOfDay: 'Morning',
      dateString,
      updatedAt: operationUpdatedAt,
      cardType: isImageAttachment ? CARD_TYPES.PHOTO : CARD_TYPES.DOCUMENT,
      primaryUrl: null,
      source: UPLOADED_FILE_SOURCE_LABEL,
      uploadedSourceLabel: UPLOADED_FILE_SOURCE_LABEL,
      uploadedFileStorageKey: storageKey,
      uploadedFileType: attachment.uploadKind,
      uploadedOriginalFileName: attachment.originalFileName,
      uploadedMimeType: attachment.mimeType,
      uploadedFileSize: attachment.size,
      uploadedCreatedAt: attachment.createdAt,
      uploadedUpdatedAt: operationUpdatedAt,
      extractedText: null,
      // Object URLs are transient and explicitly removed before persistence.
      // They make a selected photo appear immediately while its binary upload
      // happens in the background.
      localPreviewUrl: isImageAttachment ? URL.createObjectURL(attachment.file) : null,
      uploadState: 'uploading',
      uploadedFileStoragePath: null,
      redirectUrl: null,
      photoUrl: null,
      photoTitle: isImageAttachment ? attachment.title : null,
      photoFileName: isImageAttachment ? attachment.originalFileName : null,
      photoDataUrl: null,
      photoWidth: null,
      photoHeight: null,
      desktopSlot: null,
      desktopZ: Date.now() + index,
    });
  }));
};
