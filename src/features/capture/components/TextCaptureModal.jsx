import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// A draft stays outside the task store until the user chooses Add, so it
// cannot leak into autosync when the dialog is dismissed.
const TextCaptureModal = ({ appearance, labels = {}, onCancel, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel?.();
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('desktop-text-capture-submit')?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const submit = async () => {
    const nextText = text.trim();
    if (!nextText) {
      setError(labels.quickAddRequired || 'Enter something first.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit?.({ text: nextText, title: title.trim() });
    } catch {
      setError(labels.quickAddSaveError || 'Unable to save. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className={`desktop-text-detail-backdrop ${appearance === 'dark' ? 'is-dark' : ''}`} role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel?.(); }}>
      <section className="desktop-text-detail-modal desktop-text-capture-modal" role="dialog" aria-modal="true" aria-labelledby="desktop-text-capture-title">
        <header className="desktop-text-detail-header">
          <span className="desktop-text-detail-type-icon" aria-hidden="true">T</span>
          <div className="desktop-text-detail-heading">
            <input id="desktop-text-capture-title" className="desktop-text-detail-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={labels.text || 'Text'} aria-label={labels.textDetailTitle || 'Text title'} />
          </div>
          <div className="desktop-text-detail-actions">
            <button type="button" className="desktop-text-detail-icon-button" onClick={onCancel} aria-label={labels.close || 'Close'}><X size={22} /></button>
          </div>
        </header>
        <div className="desktop-text-detail-body">
          <textarea className="desktop-text-detail-editor is-inline" value={text} onChange={(event) => { setText(event.target.value); setError(''); }} autoFocus placeholder={labels.textDetailPlaceholder || 'Write something...'} aria-label={labels.textDetailEdit || 'Write text'} />
        </div>
        <footer className="desktop-text-detail-footer desktop-text-capture-footer">
          {error ? <span className="desktop-text-capture-error" role="status">{error}</span> : <span />}
          <div className="desktop-text-capture-actions">
            <button type="button" className="desktop-text-capture-cancel" onClick={onCancel}>{labels.cancel || 'Cancel'}</button>
            <button id="desktop-text-capture-submit" type="button" className="desktop-text-capture-submit" disabled={submitting} onClick={submit}>{submitting ? (labels.quickAddSaving || 'Saving...') : (labels.add || 'Add')}</button>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default TextCaptureModal;
