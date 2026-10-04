import React, { useRef } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { getDesktopPortalContainer } from './desktopPortal';

const DesktopDeleteConfirmModal = ({
  open,
  title,
  description = null,
  cancelLabel = 'Cancel',
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
}) => {
  const confirmingRef = useRef(false);
  const previouslyFocusedElementRef = useRef(null);

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return;
        if (confirmingRef.current) {
          confirmingRef.current = false;
          return;
        }
        onCancel?.();
      }}
    >
      <AlertDialog.Portal container={getDesktopPortalContainer()}>
        <AlertDialog.Overlay
          className="desktop-delete-confirm-backdrop"
          onClick={(event) => event.stopPropagation()}
        />
        <AlertDialog.Content
          className="desktop-delete-confirm-dialog"
          onClick={(event) => event.stopPropagation()}
          onOpenAutoFocus={() => {
            const activeElement = document.activeElement;
            previouslyFocusedElementRef.current = activeElement instanceof HTMLElement && activeElement !== document.body
              ? activeElement
              : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            previouslyFocusedElementRef.current?.focus({ preventScroll: true });
          }}
        >
          <div className="desktop-delete-confirm-copy">
            <AlertDialog.Title className="desktop-delete-confirm-title">{title}</AlertDialog.Title>
            {description ? (
              <AlertDialog.Description className="desktop-delete-confirm-description">
                {description}
              </AlertDialog.Description>
            ) : null}
          </div>
          <div className="desktop-delete-confirm-actions">
            <AlertDialog.Cancel asChild>
              <button
                type="button"
                className="desktop-delete-confirm-button desktop-delete-confirm-button-secondary"
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                type="button"
                className="desktop-delete-confirm-button desktop-delete-confirm-button-primary"
                onClick={() => {
                  confirmingRef.current = true;
                  try {
                    onConfirm?.();
                  } finally {
                    queueMicrotask(() => {
                      confirmingRef.current = false;
                    });
                  }
                }}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

export default DesktopDeleteConfirmModal;
