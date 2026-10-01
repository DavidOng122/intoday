import { useEffect, useRef } from 'react';
import { deleteUploadedFileBlob } from '../../../shared/storage/uploadedFileStorage';

export const useUploadedFileLifecycle = ({ tasks }) => {
  const previousUploadedFileKeysRef = useRef(new Set());

  useEffect(() => {
    const nextKeys = new Set(
      tasks
        .map((task) => task.uploadedFileStorageKey)
        .filter((storageKey) => typeof storageKey === 'string' && storageKey.trim())
    );
    const previousKeys = previousUploadedFileKeysRef.current;
    previousKeys.forEach((storageKey) => {
      if (!nextKeys.has(storageKey)) {
        deleteUploadedFileBlob(storageKey).catch((error) => {
          console.error('Failed to delete uploaded file blob:', error);
        });
      }
    });
    previousUploadedFileKeysRef.current = nextKeys;
  }, [tasks]);
};
