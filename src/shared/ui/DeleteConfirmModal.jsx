import React from 'react';

const DesktopDeleteConfirmModal = ({
  open,
  title,
  description = null,
  cancelLabel = 'Cancel',
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div role="presentation" onClick={onCancel} className="desktop-delete-confirm-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-delete-confirm-title"
        onClick={(event) => event.stopPropagation()}
        className="desktop-delete-confirm-dialog"
      >
        <div className="desktop-delete-confirm-copy">
          <h2 id="desktop-delete-confirm-title" className="desktop-delete-confirm-title">{title}</h2>
          {description ? <p className="desktop-delete-confirm-description">{description}</p> : null}
        </div>
        <div className="desktop-delete-confirm-actions">
          <button
            type="button"
            className="desktop-delete-confirm-button desktop-delete-confirm-button-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="desktop-delete-confirm-button desktop-delete-confirm-button-primary"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesktopDeleteConfirmModal;
