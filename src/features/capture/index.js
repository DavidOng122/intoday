// Public API for the capture feature.

export { useDesktopCapture } from './hooks/useDesktopCapture';
export { default as QuickAddMenu } from './components/QuickAddMenu';
export {
  hasSupportedUploadFiles,
  isSupportedUploadFile,
  serializeUploadAttachment,
  createUploadedFileStorageKey,
} from './services/uploadUtils';
export {
  getUploadedFileRecord,
  saveUploadedFileBlob,
  deleteUploadedFileBlob,
} from '../../shared/storage/uploadedFileStorage';
