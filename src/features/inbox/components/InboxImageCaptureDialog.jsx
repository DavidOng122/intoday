import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const InboxImageCaptureDialog = ({ file, appearance = 'light', submitting = false, error = '', onClose, onConfirm }) => {
  const [note, setNote] = useState('');
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!file) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, onClose]);

  if (!file || !previewUrl || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`desktop-inbox-image-capture-backdrop ${appearance === 'dark' ? 'is-dark' : ''}`} role="presentation" onClick={onClose}>
      <section
        className="desktop-inbox-image-capture-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-inbox-image-capture-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="desktop-inbox-image-capture-heading">
          <h2 id="desktop-inbox-image-capture-title">Add image to Inbox</h2>
          <button type="button" onClick={onClose} aria-label="Cancel image capture">Cancel</button>
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
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" disabled={submitting} onClick={() => onConfirm?.(file, note.trim())}>
            {submitting ? 'Saving...' : 'Save to Inbox'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default InboxImageCaptureDialog;