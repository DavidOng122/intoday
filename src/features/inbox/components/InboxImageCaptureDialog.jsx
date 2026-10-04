import React, { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';

const InboxImageCaptureDialog = ({ file, submitting = false, error = '', onClose, onConfirm }) => {
  const [note, setNote] = useState('');
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!file || !previewUrl) return null;

  return (
    <Dialog.Root open={Boolean(file)} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose?.();
    }}>
      <Dialog.Portal container={getDesktopPortalContainer()}>
        <Dialog.Overlay className="desktop-inbox-image-capture-backdrop" />
        <Dialog.Content className="desktop-inbox-image-capture-dialog">
        <div className="desktop-inbox-image-capture-heading">
          <Dialog.Title className="desktop-inbox-image-capture-title">Add image to Inbox</Dialog.Title>
          <Dialog.Close asChild>
            <button type="button" aria-label="Cancel image capture">Cancel</button>
          </Dialog.Close>
        </div>
        <img className="desktop-inbox-image-capture-preview" src={previewUrl} alt="Pasted clipboard preview" />
        <textarea
          className="desktop-inbox-image-capture-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a note (optional)"
          aria-label="Image note"
        />
        {error ? <div className="desktop-inbox-image-capture-error" role="status">{error}</div> : null}
        <div className="desktop-inbox-image-capture-actions">
          <Dialog.Close asChild>
            <button type="button">Cancel</button>
          </Dialog.Close>
          <button type="button" disabled={submitting} onClick={() => onConfirm?.(file, note.trim())}>
            {submitting ? 'Saving...' : 'Save to Inbox'}
          </button>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default InboxImageCaptureDialog;