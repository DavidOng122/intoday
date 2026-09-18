import { createInboxTask } from '../../inbox';
import { normalizeTask } from '../../../lib/taskNormalize';
import { getUploadedFileRecord } from '../../../shared/storage/uploadedFileStorage';
import {
  hasSupportedUploadFiles,
  isSupportedUploadFile,
} from '../services/uploadUtils';
import { createUploadedTasks } from '../services/uploadedTaskFactory';
import { createStorageSignedUrl, downloadFileFromStorage, uploadFileToStorage } from '../services/uploadStorage';
import {
  CARD_TYPES,
  fetchLinkPreviewMeta,
  fetchMapMeta,
  fetchSpotifyMeta,
  fetchVideoMeta,
} from '../../../entities/task/model/taskCardPresentation';
import { dateKey } from '../../../lib/dateUtils';
import { getDesktopCanvasResolvedPosition, getNextDesktopCanvasPosition } from '../../canvas';
import {
  DESKTOP_CANVAS_CARD_GAP,
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_PHOTO_CARD_HEIGHT,
} from '../../canvas';

export const useDesktopCapture = ({
  activeWorkspaceId,
  canvasFileDragDepthRef,
  clampCanvasPosition,
  draggedTaskId,
  getCanvasPointFromClient,
  inboxEnabled,
  isCanvasFileDragActive,
  selectedDateKey,
  selectedDateRef,
  setFullscreenImage,
  setIsCanvasFileDragActive,
  setTasks,
  setToastMessage,
  userId,
}) => {
  const showToast = (message) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((current) => (current === message ? null : current));
    }, 2200);
  };
  const openUploadedFileTask = async (task) => {
    const storageKey = task.uploadedFileStorageKey;
    const storagePath = task.uploadedFileStoragePath;
    const uploadedType = String(task.uploadedFileType || '').toLowerCase();

    if (uploadedType === 'image' && storagePath) {
      try {
        const signedUrl = await createStorageSignedUrl(storagePath);
        if (signedUrl) {
          setFullscreenImage(signedUrl);
          return true;
        }
      } catch (error) {
        console.error('Failed to open uploaded image from Storage:', error);
      }
    }
  
    if (uploadedType === 'image' && (task?.photoUrl || task?.photoDataUrl)) {
      setFullscreenImage(task.photoUrl || task.photoDataUrl);
      return true;
    }
  
    if (!storageKey && !storagePath) {
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
      let blob = null;
      if (storagePath) {
        try {
          blob = await downloadFileFromStorage(storagePath);
        } catch (error) {
          // Offline/local cache remains a fallback if Storage is temporarily
          // unavailable. The remote path is still the durable source.
          console.warn('Failed to download file from Storage:', error);
        }
      }
      if (!blob && storageKey) {
        const record = await getUploadedFileRecord(storageKey);
        blob = record?.blob || null;
      }
      if (!blob) {
        if (newWin) newWin.close();
        showToast('File is not available yet. Please try again.');
        return true;
      }
  
      if (uploadedType === 'image') {
        const objectUrl = URL.createObjectURL(blob);
        setFullscreenImage(objectUrl);
      } else if (newWin) {
        const objectUrl = URL.createObjectURL(blob);
        if (uploadedType === 'word') {
          // Browsers cannot reliably render DOC/DOCX. Download it with its
          // original filename instead of showing a blank browser tab.
          const link = newWin.document.createElement('a');
          link.href = objectUrl;
          link.download = task.uploadedOriginalFileName || 'document.docx';
          newWin.document.body.appendChild(link);
          link.click();
          newWin.close();
        } else {
          // PDFs are natively previewable in supported browsers.
          newWin.location.href = objectUrl;
        }
      } else {
        // Fallback if popup blocker aggressively blocked the synch open
        const objectUrl = URL.createObjectURL(blob);
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
  // Upload creation is shared, while the entry point explicitly controls its
  // destination: Inbox menu uploads remain unorganised; a native Canvas drop
  // is placed at the user's drop point.
  const uploadCreatedFiles = (fileTasks, sourceFiles) => {
    fileTasks.forEach((task, index) => {
      const file = sourceFiles[index];
      if (!file) return;
      uploadFileToStorage({ file, userId }).then((uploadedFileStoragePath) => {
        setTasks((currentTasks) => currentTasks.map((currentTask) => (
          currentTask.id === task.id
            ? normalizeTask({
              ...currentTask,
              uploadedFileStoragePath,
              // The local preview is deliberately discarded after the server
              // confirms the binary. Future views resolve a signed URL.
              localPreviewUrl: null,
              uploadState: null,
              updatedAt: new Date().toISOString(),
            })
            : currentTask
        )));
      }).catch((error) => {
        console.error('Failed to upload file to Supabase Storage:', error);
        setTasks((currentTasks) => currentTasks.map((currentTask) => (
          currentTask.id === task.id
            ? normalizeTask({ ...currentTask, uploadState: 'failed' })
            : currentTask
        )));
        showToast('Upload failed. The file is kept on this device.');
      });
    });
  };

  const importFiles = async (files, { dropBasePosition = null, destination = inboxEnabled ? 'inbox' : 'canvas', note = '' } = {}) => {
    const supportedFiles = Array.from(files || []).filter((file) => isSupportedUploadFile(file));
    if (!supportedFiles.length) return;
  
    const droppedDateKey = selectedDateRef.current ? dateKey(selectedDateRef.current) : selectedDateKey;
  
    try {
      const fileTasks = await createUploadedTasks(supportedFiles, {
        workspaceId: activeWorkspaceId,
        dateString: droppedDateKey,
        note,
      });
  
      setTasks((prev) => {
        let nextTasks = [...prev];
        fileTasks.forEach((task, index) => {
          if (destination === 'inbox') {
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
          const resolvedPosition = getDesktopCanvasResolvedPosition(
            workspaceTasks,
            new Set([task.id]),
            preferredPosition,
          );
          const nextPosition = clampCanvasPosition(resolvedPosition, {
            width: DESKTOP_CANVAS_CARD_WIDTH,
            height: task.cardType === CARD_TYPES.PHOTO ? DESKTOP_PHOTO_CARD_HEIGHT : DESKTOP_CANVAS_CARD_HEIGHT,
          });
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

      // Rendering and interaction are local-first. The binary transfer runs
      // independently so a slow network never blocks the Canvas or Inbox.
      uploadCreatedFiles(fileTasks, supportedFiles);

      showToast(supportedFiles.length === 1 ? 'File added — uploading…' : `${supportedFiles.length} files added — uploading…`);
    } catch (error) {
      console.error('Failed to import files:', error);
      showToast('Unable to import files');
      throw error;
    }
  };
  const handleCanvasFileDrop = async (event) => {
    // We only prevent default and proceed if there are files. If an internal
    // task is being dragged, clear this overlay and let its own handler finish.
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
    const dropCenter = getCanvasPointFromClient(event.clientX, event.clientY);
    const dropBasePosition = dropCenter
      ? { x: dropCenter.x - DESKTOP_CANVAS_CARD_WIDTH / 2, y: dropCenter.y - DESKTOP_PHOTO_CARD_HEIGHT / 2 }
      : null;
    try {
      await importFiles(event.dataTransfer?.files, { dropBasePosition, destination: 'canvas' });
    } catch {
      // importFiles already reported the user-facing failure.
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
  return {
    showToast,
    openUploadedFileTask,
    handleCanvasFileDragEnter,
    handleCanvasFileDragOver,
    handleCanvasFileDragLeave,
    handleCanvasFileDrop,
    importFiles,
    applyAsyncMetadata,
  };
};
