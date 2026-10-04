import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';
import { CloseIcon } from '../../../shared/ui/icons/DesktopIcons';
import { fetchLinkPreviewMeta } from '../../../entities/task/model/taskCardPresentation';

const normalizeUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  try {
    return new URL(/^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed);
  } catch {
    return null;
  }
};

const getPreviewDetails = (value, metadata) => {
  const url = normalizeUrl(value);
  if (!url) {
    return {
      domain: 'Text note',
      title: value,
      subtitle: 'Saved as a note',
      faviconUrl: null,
      imageUrl: null,
      kind: 'text',
    };
  }

  const domain = url.hostname.replace(/^www\./i, '');
  const decodedPath = decodeURIComponent(url.pathname)
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/[-_]+/g, ' ')
    ?.trim();
  const isImage = /\.(?:avif|gif|jpe?g|png|webp)$/i.test(url.pathname);
  const isPdf = /\.pdf$/i.test(url.pathname);

  return {
    domain,
    title: metadata?.linkTitle || decodedPath || domain,
    subtitle: `Saved from ${domain}`,
    faviconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
    imageUrl: metadata?.linkImage || (isImage ? url.href : null),
    kind: isPdf ? 'pdf' : 'link',
  };
};

const InboxAddPreviewRow = ({ value, onRemove }) => {
  const [metadata, setMetadata] = useState(null);
  const [previewImageFailed, setPreviewImageFailed] = useState(false);
  const preview = getPreviewDetails(value, metadata);

  useEffect(() => {
    const url = normalizeUrl(value);
    if (!url) return undefined;
    let active = true;
    fetchLinkPreviewMeta(url.href).then((nextMetadata) => {
      if (active && nextMetadata) setMetadata(nextMetadata);
    });
    return () => {
      active = false;
    };
  }, [value]);

  return (
    <div className="desktop-inbox-add-preview-row">
      <div className={`desktop-inbox-add-preview-thumbnail is-${preview.kind}`}>
        {preview.imageUrl && !previewImageFailed ? (
          <img src={preview.imageUrl} alt="" onError={() => setPreviewImageFailed(true)} />
        ) : preview.kind === 'pdf' ? (
          <span>PDF</span>
        ) : preview.kind === 'text' ? (
          <span>T</span>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <div className="desktop-inbox-add-preview-copy">
        <div className="desktop-inbox-add-preview-source">
          {preview.faviconUrl ? <img src={preview.faviconUrl} alt="" /> : null}
          <span>{preview.domain}</span>
        </div>
        <strong>{preview.title}</strong>
        <span className="desktop-inbox-add-preview-subtitle">{preview.subtitle}</span>
      </div>
      <button
        type="button"
        className="desktop-inbox-add-preview-remove"
        onClick={onRemove}
        aria-label={`Remove ${preview.title}`}
      >
        <CloseIcon />
      </button>
    </div>
  );
};

const InboxAddConfirmDialog = ({
  open,
  values = [],
  submitting = false,
  error = '',
  onClose,
  onRemove,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose?.();
    }}>
      <Dialog.Portal container={getDesktopPortalContainer()}>
        <Dialog.Overlay className="desktop-inbox-add-confirm-backdrop" />
        <Dialog.Content className="desktop-inbox-add-confirm-dialog">
        <Dialog.Close asChild>
          <button
            type="button"
            className="desktop-inbox-add-confirm-close"
            aria-label="Close add confirmation"
          >
            <CloseIcon />
          </button>
        </Dialog.Close>
        <div className="desktop-inbox-add-confirm-heading">
          <Dialog.Title asChild><h2>Add</h2></Dialog.Title>
          <Dialog.Description asChild><p>You can add multiple links, photos, and PDFs at once.</p></Dialog.Description>
        </div>
        <div className="desktop-inbox-add-preview-list">
          {values.map((value, index) => (
            <InboxAddPreviewRow
              key={`${value}-${index}`}
              value={value}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
        {error ? <div className="desktop-inbox-add-confirm-error" role="status">{error}</div> : null}
        <button
          type="button"
          className="desktop-inbox-add-confirm-submit"
          disabled={submitting || values.length === 0}
          onClick={onConfirm}
        >
          {submitting ? 'Adding...' : 'Add to Inbox'}
        </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default InboxAddConfirmDialog;
