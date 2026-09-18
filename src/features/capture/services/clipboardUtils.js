export const getClipboardImageFile = (clipboardItems) => {
  const imageItem = Array.from(clipboardItems || []).find((item) => (
    String(item?.type || '').toLowerCase().startsWith('image/')
  ));
  return imageItem?.getAsFile?.() || null;
};

export const normalizeClipboardImageFile = (file) => {
  if (!file) return null;
  const type = String(file.type || 'image/png').toLowerCase();
  const extension = type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  const hasUsefulName = typeof file.name === 'string' && /\.[a-z0-9]+$/i.test(file.name);
  if (hasUsefulName) return file;
  return new File([file], `screenshot-${Date.now()}.${extension}`, { type });
};

export const isEditableClipboardTarget = (target) => (
  target?.isContentEditable === true
  || ['INPUT', 'TEXTAREA'].includes(String(target?.tagName || '').toUpperCase())
);