export const getTaskPhotoPreviewSource = (task) => (
  task?.localPreviewUrl || task?.photoDataUrl || task?.photoUrl || null
);

export const hasTaskPhotoPreview = (task) => Boolean(
  getTaskPhotoPreviewSource(task) || task?.uploadedFileStoragePath || task?.uploadedFileStorageKey,
);
