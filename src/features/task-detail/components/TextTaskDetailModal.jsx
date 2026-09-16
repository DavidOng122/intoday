import { useCallback, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getTaskCardPresentation } from '../../../entities/task/model/taskCardPresentation';

const LOCALE_BY_LANGUAGE = {
  EN: 'en-US',
  ZH: 'zh-CN',
  MS: 'ms-MY',
  JA: 'ja-JP',
  TH: 'th-TH',
};

const formatUpdatedAt = (updatedAt, language) => {
  const date = updatedAt ? new Date(updatedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALE_BY_LANGUAGE[language] || 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const TextTaskDetailModal = ({ task, appearance, labels = {}, language, onClose, onSave }) => {
  const presentation = useMemo(() => getTaskCardPresentation(task, labels), [labels, task]);
  const [draft, setDraft] = useState(task?.text || '');
  const [titleDraft, setTitleDraft] = useState(task?.title || presentation.displayTitle || '');
  const updatedAtLabel = formatUpdatedAt(task?.updatedAt, language);
  const savedTitle = task?.title || presentation.displayTitle || '';

  const saveDraft = useCallback(() => {
    if (draft === task.text && titleDraft === savedTitle) return;
    onSave?.(task.id, { text: draft, title: titleDraft });
  }, [draft, onSave, savedTitle, task, titleDraft]);

  // The editor stays responsive locally. Persist after a short pause instead
  // of synchronising every keystroke, then save immediately on blur/close.
  useEffect(() => {
    if (draft === task.text && titleDraft === savedTitle) return undefined;
    const timer = window.setTimeout(saveDraft, 600);
    return () => window.clearTimeout(timer);
  }, [draft, saveDraft, savedTitle, task, titleDraft]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        saveDraft();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, saveDraft]);

  if (!task) return null;

  return (
    <div
      className={`desktop-text-detail-backdrop ${appearance === 'dark' ? 'is-dark' : ''}`}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          saveDraft();
          onClose?.();
        }
      }}
    >
      <section className="desktop-text-detail-modal" role="dialog" aria-modal="true" aria-labelledby="desktop-text-detail-title">
        <header className="desktop-text-detail-header">
          <span className="desktop-text-detail-type-icon" aria-hidden="true">T</span>
          <div className="desktop-text-detail-heading">
            <input
              id="desktop-text-detail-title"
              className="desktop-text-detail-title-input"
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={saveDraft}
              placeholder={labels.text || 'Text'}
              aria-label={labels.textDetailTitle || 'Text title'}
            />
          </div>
          <div className="desktop-text-detail-actions">
            <button type="button" className="desktop-text-detail-icon-button" onClick={() => { saveDraft(); onClose?.(); }} aria-label={labels.close || 'Close'}>
              <X size={22} />
            </button>
          </div>
        </header>

        <div className="desktop-text-detail-body">
          <textarea
            className="desktop-text-detail-editor is-inline"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={saveDraft}
            autoFocus
            placeholder={labels.textDetailPlaceholder || 'Write something...'}
            aria-label={labels.textDetailEdit || 'Edit text'}
          />
        </div>

        <footer className="desktop-text-detail-footer">
          <span>{updatedAtLabel ? `${labels.textDetailLastEdited || 'Last edited'} ${updatedAtLabel}` : ''}</span>
        </footer>
      </section>
    </div>
  );
};

export default TextTaskDetailModal;
