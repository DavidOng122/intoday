import { useEffect, useRef } from 'react';
import { deleteUploadedFileBlob } from '../../../shared/storage/uploadedFileStorage';

export const useUploadedFileLifecycle = ({ tasks, userId }) => {
  const previousUploadedFileKeysRef = useRef(new Set());

  useEffect(() => {
    const nextKeys = new Set(
      tasks
        .map((task) => task.uploadedFileStorageKey)
        .filter((storageKey) => typeof storageKey === 'string' && storageKey.trim()),
    );
    const previousKeys = previousUploadedFileKeysRef.current;
    const removedKeys = [...previousKeys].filter((storageKey) => !nextKeys.has(storageKey));
    removedKeys.forEach((storageKey) => {
      deleteUploadedFileBlob(storageKey).catch((error) => {
        console.error('Failed to delete the local uploaded file blob:', error);
      });
    });
    previousUploadedFileKeysRef.current = nextKeys;
  }, [tasks, userId]);
};
