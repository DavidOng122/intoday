import { trackUserEvent } from '../../../shared/lib/analytics';
import { createInboxTask } from '../../inbox';
import { createUpdatedTimestamp } from '../../pack/model/packMetadata';
import { normalizeTask, sectionIdToMobileId } from '../../../lib/taskNormalize';
import { getUploadedFileRecord, saveUploadedFileBlob } from '../../../shared/storage/uploadedFileStorage';
import {
  createUploadedFileStorageKey,
  hasSupportedUploadFiles,
  isSupportedUploadFile,
  serializeUploadAttachment,
} from '../services/uploadUtils';
import {
  CARD_TYPES,
  fetchLinkPreviewMeta,
  fetchMapMeta,
  fetchSpotifyMeta,
  fetchVideoMeta,
  getDerivedTaskFields,
} from '../../../entities/task/model/taskCardPresentation';
import { dateKey } from '../../../lib/dateUtils';
import { getDesktopCanvasResolvedPosition, getNextDesktopCanvasPosition } from '../../canvas';
import {
  DESKTOP_CANVAS_CARD_GAP,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_PHOTO_CARD_HEIGHT,
} from '../../canvas';
import { UPLOADED_FILE_SOURCE_LABEL } from '../config/uploadConstants';

export const useDesktopCapture = ({
  activeWorkspaceId,
  addPanelAttachments,
  canvasFileDragDepthRef,
  currentBlock,
  draggedTaskId,
  getCanvasPointFromClient,
  getFirstAvailableDesktopSlot,
  inboxEnabled,
  inputText,
  isCanvasFileDragActive,
  selectedDateKey,
  selectedDateRef,
  setAddPanelAttachments,
  setFullscreenImage,
  setInputText,
  setIsCanvasFileDragActive,
  setPanelOpen,
  setTasks,
  setToastMessage,
  todaySelected,
  user,
}) => {
  const closePanel = () => {
    setInputText('');
    setAddPanelAttachments([]);
    setPanelOpen(false);
  };
  const showToast = (message) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2200);
  };
  const openUploadedFileTask = async (task) => {
    const storageKey = task.uploadedFileStorageKey;
    const uploadedType = String(task.uploadedFileType || '').toLowerCase();
  
    if (uploadedType === 'image' && (task?.photoUrl || task?.photoDataUrl)) {
      setFullscreenImage(task.photoUrl || task.photoDataUrl);
      return true;
    }
  
    if (!storageKey) {
      return false;
    }
    
    // For non-images, open a blank window synchronously before 'await' to bypass popup blockers
    let newWin = null;
    if (uploadedType !== 'image') {
      newWin = window.open('', '_blank');
      if (newWin) {
        newWin.document.title = 'Loading...';
        newWin.document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#666;">Opening file...</div>';
      }
    }
  
    try {
      const record = await getUploadedFileRecord(storageKey);
      if (!record?.blob) {
        if (newWin) newWin.close();
        showToast('File is no longer available on this device');
        return true;
      }
  
      if (uploadedType === 'image') {
        const objectUrl = URL.createObjectURL(record.blob);
        setFullscreenImage(objectUrl);
      } else if (newWin) {
        const objectUrl = URL.createObjectURL(record.blob);
        newWin.location.href = objectUrl;
      } else {
        // Fallback if popup blocker aggressively blocked the synch open
        const objectUrl = URL.createObjectURL(record.blob);
        window.open(objectUrl, '_blank');
      }
      return true;
    } catch (error) {
      console.error('Failed to open uploaded file:', error);
      if (newWin) newWin.close();
      showToast('Unable to open file');
      return true;
    }
  };
  const handleCanvasFileDragEnter = (event) => {
    // Allow if it's a file drag OR if an internal task is being dragged
    if (!hasSupportedUploadFiles(event.dataTransfer) && !draggedTaskId) return;
    event.preventDefault();
    canvasFileDragDepthRef.current += 1;
    setIsCanvasFileDragActive(true);
  };
  const handleCanvasFileDragOver = (event) => {
    // Allow if it's a file drag OR if an internal task is being dragged
    if (!hasSupportedUploadFiles(event.dataTransfer) && !draggedTaskId) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    if (!isCanvasFileDragActive) {
      setIsCanvasFileDragActive(true);
    }
  };
  const handleCanvasFileDragLeave = (event) => {
    if (!hasSupportedUploadFiles(event.dataTransfer) && !draggedTaskId) return;
    event.preventDefault();
    canvasFileDragDepthRef.current = Math.max(0, canvasFileDragDepthRef.current - 1);
    if (canvasFileDragDepthRef.current === 0) {
      setIsCanvasFileDragActive(false);
    }
  };
  const handleCanvasFileDrop = async (event) => {
    // We only prevent default and proceed if there are files.
    // If it's an internal task drag (draggedTaskId), we clear the overlay and let internal logic handle it.
    if (!hasSupportedUploadFiles(event.dataTransfer)) {
      if (draggedTaskId) {
        setIsCanvasFileDragActive(false);
        canvasFileDragDepthRef.current = 0;
      }
      return;
    }
  
    event.preventDefault();
    event.stopPropagation();
    canvasFileDragDepthRef.current = 0;
    setIsCanvasFileDragActive(false);
  
    const supportedFiles = Array.from(event.dataTransfer?.files || []).filter((file) => isSupportedUploadFile(file));
    if (!supportedFiles.length) return;
  
    const droppedDateKey = selectedDateRef.current ? dateKey(selectedDateRef.current) : selectedDateKey;
    const dropCenter = getCanvasPointFromClient(event.clientX, event.clientY);
    const dropBasePosition = dropCenter
      ? { x: dropCenter.x - DESKTOP_CANVAS_CARD_WIDTH / 2, y: dropCenter.y - DESKTOP_PHOTO_CARD_HEIGHT / 2 }
      : null;
  
    try {
      const serializedAttachments = await Promise.all(supportedFiles.map((file) => serializeUploadAttachment(file)));
      const operationUpdatedAt = createUpdatedTimestamp();
      
      const fileTasks = await Promise.all(serializedAttachments.map(async (attachment, index) => {
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
        
        const taskId = Date.now() + index + Math.floor(Math.random() * 1000);
        const isImageAttachment = attachment.uploadKind === 'image';
        
        return normalizeTask({
          id: taskId,
          text: attachment.title,
          title: attachment.title,
          completed: false,
          desktopWorkspaceId: activeWorkspaceId,
          timeOfDay: 'Morning',
          dateString: droppedDateKey,
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
  
      setTasks((prev) => {
        let nextTasks = [...prev];
        fileTasks.forEach((task, index) => {
          if (inboxEnabled) {
            nextTasks = [...nextTasks, normalizeTask(createInboxTask(task))];
            return;
          }
          const workspaceTasks = nextTasks;
          const preferredPosition = dropBasePosition
            ? {
              x: dropBasePosition.x,
              y: dropBasePosition.y + (index * (DESKTOP_CANVAS_CARD_GAP + 12)),
            }
            : getNextDesktopCanvasPosition(workspaceTasks);
          const nextPosition = getDesktopCanvasResolvedPosition(
            workspaceTasks,
            new Set([task.id]),
            preferredPosition,
          );
          nextTasks = [
            ...nextTasks,
            normalizeTask({
              ...task,
              desktopCanvasX: nextPosition.x,
              desktopCanvasY: nextPosition.y,
            }),
          ];
        });
        return nextTasks;
      });
  
      showToast(supportedFiles.length === 1 ? 'File added' : `${supportedFiles.length} files added`);
    } catch (error) {
      console.error('Failed to import dropped files:', error);
      showToast('Unable to import files');
    }
  };
  const applyAsyncMetadata = (taskId, cardType, videoUrl, mapUrl, primaryUrl, updatedAt = null) => {
    if (cardType === 'video' && videoUrl) {
      fetchVideoMeta(videoUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta, ...(updatedAt ? { updatedAt } : {}) }) : task)));
      });
    } else if (cardType === 'place' && mapUrl) {
      fetchMapMeta(mapUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta, ...(updatedAt ? { updatedAt } : {}) }) : task)));
      });
    } else if ((cardType === 'music' || cardType === 'podcast') && primaryUrl) {
      fetchSpotifyMeta(primaryUrl).then((meta) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta, ...(updatedAt ? { updatedAt } : {}) }) : task)));
      });
    } else if (primaryUrl && (!cardType || cardType === 'link' || cardType === 'text' || cardType === 'ai_tool' || cardType === 'social' || cardType === 'shopping' || cardType === 'financial' || cardType === 'document')) {
      fetchLinkPreviewMeta(primaryUrl).then((meta) => {
        if (meta) {
          setTasks((prev) => prev.map((task) => (task.id === taskId ? normalizeTask({ ...task, ...meta, ...(updatedAt ? { updatedAt } : {}) }) : task)));
        }
      });
    }
  };
  const handleAddPanelFilesSelected = async (files) => {
    if (!files?.length) return;
  
    const selectedFiles = Array.from(files);
    const supportedFiles = selectedFiles.filter((file) => isSupportedUploadFile(file));
    const rejectedCount = selectedFiles.length - supportedFiles.length;
  
    if (rejectedCount > 0) {
      showToast(rejectedCount === 1 ? 'Unsupported file skipped' : `${rejectedCount} unsupported files skipped`);
    }
    if (!supportedFiles.length) return;
  
    try {
      const serializedAttachments = await Promise.all(supportedFiles.map((file) => serializeUploadAttachment(file)));
      setAddPanelAttachments((current) => [...current, ...serializedAttachments]);
      showToast(serializedAttachments.length === 1 ? 'File attached' : `${serializedAttachments.length} files attached`);
    } catch (error) {
      console.error('Failed to attach files to add panel:', error);
      showToast('Unable to attach files');
    }
  };
  const handleRemoveAddPanelAttachment = (attachmentId) => {
    setAddPanelAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };
  const saveTask = async () => {
    const rawText = inputText.trim();
    if (!rawText && addPanelAttachments.length === 0) return;
  
    const resolvedTimeOfDay = todaySelected ? sectionIdToMobileId(currentBlock) : 'Morning';
    const typeFields = rawText ? getDerivedTaskFields(rawText) : null;
    const taskId = Date.now();
    const operationUpdatedAt = createUpdatedTimestamp();
    let preparedAttachments = [];
  
    if (addPanelAttachments.length) {
      try {
        preparedAttachments = await Promise.all(addPanelAttachments.map(async (attachment) => {
          const storageKey = createUploadedFileStorageKey(attachment.originalFileName || attachment.title);
          await saveUploadedFileBlob({
            storageKey,
            blob: attachment.file,
            metadata: {
              originalFileName: attachment.originalFileName,
              mimeType: attachment.mimeType,
              size: attachment.size,
              uploadedFileType: attachment.uploadKind,
              createdAt: attachment.createdAt,
              updatedAt: operationUpdatedAt,
            },
          });
          return {
            ...attachment,
            storageKey,
          };
        }));
      } catch (error) {
        console.error('Failed to store uploaded files:', error);
        showToast('Unable to save files');
        return;
      }
    }
  
    setTasks((prev) => {
      let nextTasks = [...prev];
  
      if (rawText && typeFields) {
        const nextTask = normalizeTask({
          id: taskId,
          text: rawText,
          completed: false,
          desktopWorkspaceId: activeWorkspaceId,
          timeOfDay: resolvedTimeOfDay,
          dateString: selectedDateKey,
          updatedAt: operationUpdatedAt,
          ...typeFields,
          desktopSlot: null,
          desktopZ: Date.now(),
        });
        if (inboxEnabled) {
          nextTasks = [...nextTasks, normalizeTask(createInboxTask(nextTask))];
        } else {
          const workspaceTasks = nextTasks;
          const nextPosition = getNextDesktopCanvasPosition(workspaceTasks);
          const desktopSlot = getFirstAvailableDesktopSlot(workspaceTasks, selectedDateKey, nextTask.timeOfDay);
          nextTasks = [...nextTasks, normalizeTask({
            ...nextTask,
            desktopSlot,
            desktopCanvasX: nextPosition.x,
            desktopCanvasY: nextPosition.y,
          })];
        }
      }
  
      preparedAttachments.forEach((attachment, index) => {
        const attachmentTaskId = taskId + index + 1;
        const isImageAttachment = attachment.uploadKind === 'image';
        const attachmentTask = normalizeTask({
          id: attachmentTaskId,
          text: attachment.title,
          title: attachment.title,
          completed: false,
          desktopWorkspaceId: activeWorkspaceId,
          timeOfDay: 'Morning',
          dateString: selectedDateKey,
          updatedAt: operationUpdatedAt,
          cardType: isImageAttachment ? CARD_TYPES.PHOTO : CARD_TYPES.DOCUMENT,
          primaryUrl: null,
          source: UPLOADED_FILE_SOURCE_LABEL,
          uploadedSourceLabel: UPLOADED_FILE_SOURCE_LABEL,
          uploadedFileStorageKey: attachment.storageKey,
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
          desktopZ: Date.now() + index + 1,
        });
        if (inboxEnabled) {
          nextTasks = [...nextTasks, normalizeTask(createInboxTask(attachmentTask))];
        } else {
          const workspaceTasks = nextTasks;
          const nextPosition = getNextDesktopCanvasPosition(workspaceTasks);
          nextTasks = [...nextTasks, normalizeTask({
            ...attachmentTask,
            desktopCanvasX: nextPosition.x,
            desktopCanvasY: nextPosition.y,
          })];
        }
      });
  
      return nextTasks;
    });
  
    // Track analytics 
    if (user?.id && rawText && typeFields) {
      trackUserEvent(user.id, 'task_added', { cardType: typeFields.cardType, platform: 'desktop' });
    }
  
    setInputText('');
    setAddPanelAttachments([]);
    setPanelOpen(false);
    if (rawText && typeFields) {
      applyAsyncMetadata(taskId, typeFields.cardType, typeFields.videoUrl, typeFields.mapUrl, typeFields.primaryUrl, operationUpdatedAt);
    }
  };

  return {
    closePanel,
    showToast,
    openUploadedFileTask,
    handleCanvasFileDragEnter,
    handleCanvasFileDragOver,
    handleCanvasFileDragLeave,
    handleCanvasFileDrop,
    applyAsyncMetadata,
    handleAddPanelFilesSelected,
    handleRemoveAddPanelAttachment,
    saveTask,
  };
};
