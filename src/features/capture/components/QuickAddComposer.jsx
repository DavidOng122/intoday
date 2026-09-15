import { useEffect, useRef, useState } from 'react';

const QuickAddComposer = ({ kind, labels, onCancel, onSubmit }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const isLink = kind === 'link';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextValue = value.trim();
    if (!nextValue) {
      setError(labels.quickAddRequired || 'Enter something first.');
      return;
    }
    if (isLink) {
      let normalized;
      try {
        // A scheme-less hostname is convenient in a capture UI, but the
        // persisted value remains a normal URL for existing link detection.
        normalized = /^[a-z][a-z\d+.-]*:\/\//i.test(nextValue) ? nextValue : `https://${nextValue}`;
        const parsed = new URL(normalized);
        if (!/^https?:$/i.test(parsed.protocol) || !parsed.hostname) throw new Error('Invalid link');
      } catch {
        setError(labels.quickAddInvalidLink || 'Enter a valid website link.');
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit(normalized);
      } catch {
        setError(labels.quickAddSaveError || 'Unable to save. Please try again.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(nextValue);
    } catch {
      setError(labels.quickAddSaveError || 'Unable to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="desktop-quick-add-composer" onSubmit={handleSubmit}>
      <label className="desktop-quick-add-composer-label" htmlFor="desktop-quick-add-input">
        {isLink ? labels.link : labels.text}
      </label>
      <textarea
        ref={inputRef}
        id="desktop-quick-add-input"
        className="desktop-quick-add-composer-input"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setError('');
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={isLink ? labels.quickAddLinkPlaceholder : labels.quickAddTextPlaceholder}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="desktop-quick-add-composer-error" role="status">{error}</p> : null}
      <div className="desktop-quick-add-composer-actions">
        <button type="button" className="desktop-quick-add-composer-cancel" onClick={onCancel}>
          {labels.cancel}
        </button>
        <button type="submit" className="desktop-quick-add-composer-submit" disabled={submitting}>
          {submitting ? labels.quickAddSaving : labels.add}
        </button>
      </div>
    </form>
  );
};

export default QuickAddComposer;
