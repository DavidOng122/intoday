import { normalizeTask } from '../../../lib/taskNormalize';
import { saveUploadedFileBlob } from '../../../shared/storage/uploadedFileStorage';
import { CARD_TYPES } from '../../../entities/task/model/taskCardPresentation';
import { createUpdatedTimestamp } from '../../pack/model/packMetadata';
import { UPLOADED_FILE_SOURCE_LABEL } from '../config/uploadConstants';
import { createUploadedFileStorageKey, serializeUploadAttachment } from './uploadUtils';

// This is deliberately UI-free. Every upload entry point must create the same
// local blob record and task payload before a hook decides where it appears.
export const createUploadedTasks = async (files, { workspaceId, dateString }) => {
  const serializedAttachments = await Promise.all(files.map((file) => serializeUploadAttachment(file)));
  const operationUpdatedAt = createUpdatedTimestamp();

  return Promise.all(serializedAttachments.map(async (attachment, index) => {
    const storageKey = createUploadedFileStorageKey(attachment.originalFileName);
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

    const isImageAttachment = attachment.uploadKind === 'image';
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
      redirectUrl: isImageAttachment ? (attachment.previewUrl || attachment.photoDataUrl || null) : null,
      photoUrl: isImageAttachment ? (attachment.previewUrl || attachment.photoDataUrl || null) : null,
      photoTitle: isImageAttachment ? attachment.title : null,
      photoFileName: isImageAttachment ? attachment.originalFileName : null,
      photoDataUrl: isImageAttachment ? attachment.photoDataUrl : null,
      photoWidth: isImageAttachment ? attachment.photoWidth : null,
      photoHeight: isImageAttachment ? attachment.photoHeight : null,
      desktopSlot: null,
      desktopZ: Date.now() + index,
    });
  }));
};
