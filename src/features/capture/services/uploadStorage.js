import { supabase } from '../../../supabase';

export const UPLOADS_BUCKET = 'uploads';

const safeFileName = (fileName = 'file') => String(fileName)
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(-80) || 'file';

const createObjectId = () => (
  globalThis.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

export const createUploadedFilePath = (userId, fileName) => {
  if (!userId) throw new Error('A signed-in user is required to upload files.');
  return `${userId}/${createObjectId()}-${safeFileName(fileName)}`;
};

export const uploadFileToStorage = async ({ file, userId }) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const storagePath = createUploadedFilePath(userId, file?.name);
  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '31536000',
      contentType: file?.type || 'application/octet-stream',
      upsert: false,
    });

  if (error) throw error;
  return storagePath;
};

export const createStorageSignedUrl = async (storagePath, expiresIn = 60 * 60) => {
  if (!supabase || !storagePath) return null;
  const { data, error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl || null;
};

export const downloadFileFromStorage = async (storagePath) => {
  if (!supabase || !storagePath) return null;
  const { data, error } = await supabase.storage.from(UPLOADS_BUCKET).download(storagePath);
  if (error) throw error;
  return data || null;
};
