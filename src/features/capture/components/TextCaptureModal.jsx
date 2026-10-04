import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';

// A draft stays outside the task store until the user chooses Add, so it
// cannot leak into autosync when the dialog is dismissed.
const TextCaptureModal = ({ labels = {}, onCancel, onSubmit, returnFocusRef }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const submitButtonRef = useRef(null);
  const submittingRef = useRef(false);

  const submit = async () => {
    if (submittingRef.current) return;
    const nextText = text.trim();
    if (!nextText) {
      setError(labels.quickAddRequired || 'Enter something first.');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit?.({ text: nextText, title: title.trim() });
    } catch {
      setError(labels.quickAddSaveError || 'Unable to save. Please try again.');
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel?.();
      }}
    >
      <Dialog.Portal container={getDesktopPortalContainer()}>
        <Dialog.Overlay
          className="desktop-text-detail-backdrop desktop-text-capture-overlay"
          onClick={(event) => event.stopPropagation()}
        />
        <Dialog.Content
          className="desktop-text-detail-modal desktop-text-capture-modal"
          onClick={(event) => event.stopPropagation()}
          onEscapeKeyDown={(event) => event.stopPropagation()}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            textareaRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef?.current?.isConnected) {
              event.preventDefault();
              returnFocusRef.current.focus({ preventScroll: true });
            }
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              submitButtonRef.current?.click();
            }
          }}
        >
          <Dialog.Title className="desktop-text-capture-accessible-title">
            {labels.text || 'Text'}
          </Dialog.Title>
          <header className="desktop-text-detail-header">
            <span className="desktop-text-detail-type-icon" aria-hidden="true">T</span>
            <div className="desktop-text-detail-heading">
              <input id="desktop-text-capture-title" className="desktop-text-detail-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={labels.text || 'Text'} aria-label={labels.textDetailTitle || 'Text title'} />
            </div>
            <div className="desktop-text-detail-actions">
              <Dialog.Close asChild>
                <button type="button" className="desktop-text-detail-icon-button" aria-label={labels.close || 'Close'}><X size={22} /></button>
              </Dialog.Close>
            </div>
          </header>
          <div className="desktop-text-detail-body">
            <textarea ref={textareaRef} className="desktop-text-detail-editor is-inline" value={text} onChange={(event) => { setText(event.target.value); setError(''); }} placeholder={labels.textDetailPlaceholder || 'Write something...'} aria-label={labels.textDetailEdit || 'Write text'} />
          </div>
          <footer className="desktop-text-detail-footer desktop-text-capture-footer">
            {error ? <span className="desktop-text-capture-error" role="status">{error}</span> : <span />}
            <div className="desktop-text-capture-actions">
              <Dialog.Close asChild>
                <button type="button" className="desktop-text-capture-cancel">{labels.cancel || 'Cancel'}</button>
              </Dialog.Close>
              <button ref={submitButtonRef} id="desktop-text-capture-submit" type="button" className="desktop-text-capture-submit" disabled={submitting} onClick={submit}>{submitting ? (labels.quickAddSaving || 'Saving...') : (labels.add || 'Add')}</button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default TextCaptureModal;
