import { DESKTOP_IMAGE_DROP_MAX_EDGE, SUPPORTED_UPLOAD_IMAGE_EXTENSIONS, SUPPORTED_UPLOAD_WORD_EXTENSIONS, SUPPORTED_UPLOAD_PDF_EXTENSIONS } from './desktopConstants';

export const getUploadedFileTitle = (fileName = '', fallback = 'Untitled file') => fileName.replace(/\.[^.]+$/, '').trim() || fallback;

export const getDroppedImageTitle = (fileName = '') => getUploadedFileTitle(fileName, 'Photo');

export const getFileExtension = (fileName = '') => {
  const segments = String(fileName || '').toLowerCase().split('.');
  return segments.length > 1 ? segments.pop() : '';
};

export const getUploadedFileFallbackMimeType = (uploadKind) => {
  if (uploadKind === 'pdf') return 'application/pdf';
  if (uploadKind === 'word') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (uploadKind === 'image') return 'image/png';
  return 'application/octet-stream';
};

export const getSupportedUploadKind = (file) => {
  const mimeType = String(file?.type || '').toLowerCase();
  const extension = getFileExtension(file?.name || '');

  if (mimeType === 'application/pdf' || SUPPORTED_UPLOAD_PDF_EXTENSIONS.includes(extension)) {
    return 'pdf';
  }

  if (
    mimeType === 'application/msword'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || SUPPORTED_UPLOAD_WORD_EXTENSIONS.includes(extension)
  ) {
    return 'word';
  }

  if (
    (mimeType.startsWith('image/') && SUPPORTED_UPLOAD_IMAGE_EXTENSIONS.includes(extension))
    || SUPPORTED_UPLOAD_IMAGE_EXTENSIONS.includes(extension)
  ) {
    return 'image';
  }

  return null;
};

export const isSupportedUploadFile = (file) => Boolean(getSupportedUploadKind(file));

export const isSupportedConvertFile = (file) => {
  const mimeType = String(file?.type || '').toLowerCase();
  const extension = getFileExtension(file?.name || '');
  return (
    mimeType === 'application/pdf'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || mimeType === 'text/plain'
    || mimeType === 'text/html'
    || mimeType === 'text/markdown'
    || mimeType === 'text/csv'
    || extension === 'pdf'
    || extension === 'docx'
    || extension === 'html'
    || extension === 'htm'
    || extension === 'txt'
    || extension === 'md'
    || extension === 'csv'
    || extension === 'tsv'
    || extension === 'xml'
  );
};

export const hasImageFiles = (dataTransfer) => {
  const files = Array.from(dataTransfer?.files || []);
  if (files.some((file) => getSupportedUploadKind(file) === 'image' || String(file?.type || '').toLowerCase().startsWith('image/'))) {
    return true;
  }

  const items = Array.from(dataTransfer?.items || []);
  if (items.some((item) => item.kind === 'file' && String(item.type || '').toLowerCase().startsWith('image/'))) {
    return true;
  }

  const types = Array.from(dataTransfer?.types || []);
  return types.includes('Files');
};

export const hasSupportedUploadFiles = (dataTransfer) => {
  const files = Array.from(dataTransfer?.files || []);
  if (files.some((file) => isSupportedUploadFile(file))) {
    return true;
  }

  const items = Array.from(dataTransfer?.items || []);
  if (items.some((item) => {
    if (item.kind !== 'file') return false;
    const itemType = String(item.type || '').toLowerCase();
    return (
      itemType === 'application/pdf'
      || itemType === 'application/msword'
      || itemType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || itemType === 'image/png'
      || itemType === 'image/jpeg'
      || itemType === 'image/webp'
    );
  })) {
    return true;
  }

  const types = Array.from(dataTransfer?.types || []);
  return types.includes('Files');
};

export const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

export const loadImageElement = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to decode image'));
  image.src = src;
});

export const createUploadAttachmentId = () => `${Date.now()}-${Math.round(Math.random() * 100000)}`;

export const createUploadedFileStorageKey = (fileName = 'file') => {
  const normalizedName = String(fileName || 'file')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'file';
  return `upload:${Date.now()}:${Math.random().toString(36).slice(2, 10)}:${normalizedName}`;
};

export const serializeDroppedImageFile = async (file) => {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(originalDataUrl);
  const longestEdge = Math.max(image.naturalWidth || 0, image.naturalHeight || 0);
  const scale = longestEdge > DESKTOP_IMAGE_DROP_MAX_EDGE
    ? DESKTOP_IMAGE_DROP_MAX_EDGE / longestEdge
    : 1;
  const targetWidth = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const targetHeight = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    return {
      photoDataUrl: originalDataUrl,
      photoWidth: image.naturalWidth || targetWidth,
      photoHeight: image.naturalHeight || targetHeight,
      photoMimeType: file.type || 'image/png',
    };
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  const shouldKeepAlpha = /png|webp|gif|avif/i.test(file.type || '');
  const mimeType = shouldKeepAlpha ? 'image/png' : 'image/jpeg';
  const photoDataUrl = canvas.toDataURL(mimeType, DESKTOP_IMAGE_DROP_QUALITY);

  return {
    photoDataUrl,
    photoWidth: targetWidth,
    photoHeight: targetHeight,
    photoMimeType: mimeType,
  };
};

export const serializeUploadAttachment = async (file) => {
  const uploadKind = getSupportedUploadKind(file);
  if (!uploadKind) {
    throw new Error(`Unsupported file type: ${file?.name || 'unknown'}`);
  }

  const fallbackTitle = uploadKind === 'image' ? 'Photo' : 'Untitled file';
  const baseAttachment = {
    id: createUploadAttachmentId(),
    file,
    uploadKind,
    title: uploadKind === 'image' ? getDroppedImageTitle(file.name) : getUploadedFileTitle(file.name, fallbackTitle),
    originalFileName: file.name || `${fallbackTitle.toLowerCase().replace(/\s+/g, '-')}`,
    mimeType: file.type || getUploadedFileFallbackMimeType(uploadKind),
    size: Number.isFinite(file.size) ? file.size : 0,
    createdAt: createUpdatedTimestamp(),
    updatedAt: createUpdatedTimestamp(),
    extractedText: null,
    previewUrl: null,
  };

  if (uploadKind !== 'image') {
    return baseAttachment;
  }

  const photoFields = await serializeDroppedImageFile(file);
  return {
    ...baseAttachment,
    ...photoFields,
    previewUrl: photoFields.photoDataUrl || null,
  };
};
