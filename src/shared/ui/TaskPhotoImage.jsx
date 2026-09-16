import { useEffect, useState } from 'react';
import { createStorageSignedUrl } from '../../features/capture/services/uploadStorage';
import { getUploadedFileRecord } from '../storage/uploadedFileStorage';
import { getTaskPhotoPreviewSource } from '../storage/taskPhotoPreview';

// Remote Storage is authoritative. IndexedDB remains a local fallback while an
// upload is pending or when a legacy local-only attachment is opened offline.
const TaskPhotoImage = ({ task, alt = '', onError, ...imageProps }) => {
  const [source, setSource] = useState(null);
  const localPreview = task?.localPreviewUrl;
  const fallbackPreview = getTaskPhotoPreviewSource(task);
  const storagePath = task?.uploadedFileStoragePath;
  const storageKey = task?.uploadedFileStorageKey;

  useEffect(() => {
    let active = true;
    let localObjectUrl = null;

    if (localPreview) {
      return () => { active = false; };
    }

    const resolveSource = async () => {
      try {
        if (storagePath) {
          const signedUrl = await createStorageSignedUrl(storagePath);
          if (active) setSource(signedUrl);
          return;
        }

        if (fallbackPreview) {
          if (active) setSource(fallbackPreview);
          return;
        }

        if (storageKey) {
          const record = await getUploadedFileRecord(storageKey);
          if (!record?.blob) return;
          localObjectUrl = URL.createObjectURL(record.blob);
          if (active) setSource(localObjectUrl);
        }
      } catch (error) {
        console.error('Failed to resolve photo preview:', error);
        if (active) setSource(null);
      }
    };

    resolveSource();
    return () => {
      active = false;
      if (localObjectUrl) URL.revokeObjectURL(localObjectUrl);
    };
  }, [fallbackPreview, localPreview, storageKey, storagePath]);

  const displaySource = localPreview || source;
  if (!displaySource) return null;
  return <img src={displaySource} alt={alt} onError={onError} {...imageProps} />;
};

export default TaskPhotoImage;
