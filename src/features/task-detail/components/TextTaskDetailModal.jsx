import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';
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

const TextTaskDetailModal = ({ task, labels = {}, language, onClose, onSave }) => {
  const presentation = useMemo(() => getTaskCardPresentation(task, labels), [labels, task]);
  const [draft, setDraft] = useState(task?.text || '');
  const [titleDraft, setTitleDraft] = useState(task?.title || presentation.displayTitle || '');
  const updatedAtLabel = formatUpdatedAt(task?.updatedAt, language);
  const savedTitle = task?.title || presentation.displayTitle || '';
  const textareaRef = useRef(null);
  const lastSavedDraftRef = useRef({ text: task?.text || '', title: savedTitle });

  const saveDraft = useCallback(() => {
    if (!task || (
      draft === lastSavedDraftRef.current.text
      && titleDraft === lastSavedDraftRef.current.title
    )) return;
    const previous = lastSavedDraftRef.current;
    lastSavedDraftRef.current = { text: draft, title: titleDraft };
    try {
      onSave?.(task.id, { text: draft, title: titleDraft });
    } catch (error) {
      lastSavedDraftRef.current = previous;
      throw error;
    }
  }, [draft, onSave, task, titleDraft]);
  const handleClose = useCallback(() => {
    saveDraft();
    onClose?.();
  }, [onClose, saveDraft]);

  // The editor stays responsive locally. Persist after a short pause instead
  // of synchronising every keystroke, then save immediately on blur/close.
  useEffect(() => {
    if (!task || (draft === task.text && titleDraft === savedTitle)) return undefined;
    const timer = window.setTimeout(saveDraft, 600);
    return () => window.clearTimeout(timer);
  }, [draft, saveDraft, savedTitle, task, titleDraft]);

  if (!task) return null;

  return (
    <Dialog.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <Dialog.Portal container={getDesktopPortalContainer()}>
        <Dialog.Overlay className="desktop-text-detail-backdrop" />
        <Dialog.Content
          className="desktop-text-detail-modal desktop-text-task-detail-content"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            textareaRef.current?.focus();
          }}
        >
          <Dialog.Title className="desktop-text-detail-accessible-title">
            {titleDraft || labels.text || 'Text'}
          </Dialog.Title>
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
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="desktop-text-detail-icon-button"
                  onClick={saveDraft}
                  aria-label={labels.close || 'Close'}
                >
                  <X size={22} />
                </button>
              </Dialog.Close>
            </div>
          </header>

          <div className="desktop-text-detail-body">
            <textarea
              ref={textareaRef}
              className="desktop-text-detail-editor is-inline"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={saveDraft}
              placeholder={labels.textDetailPlaceholder || 'Write something...'}
              aria-label={labels.textDetailEdit || 'Edit text'}
            />
          </div>

          <footer className="desktop-text-detail-footer">
            <span>{updatedAtLabel ? `${labels.textDetailLastEdited || 'Last edited'} ${updatedAtLabel}` : ''}</span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default TextTaskDetailModal;
