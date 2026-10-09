import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';
import {
  SearchIcon,
  CloseIcon,
  PlusIcon,
} from '../../../shared/ui/icons/DesktopIcons';
import { DESKTOP_APP_WINDOW_SCALE } from '../../../shared/config/viewportConstants';
import { getTaskCardPresentation, normalizeCardType } from '../../../entities/task/model/taskCardPresentation';
import QuickAddMenu from '../../capture/components/QuickAddMenu';
import { getClipboardImageFile, isEditableClipboardTarget, normalizeClipboardImageFile } from '../../capture/services/clipboardUtils.js';
import InboxImageCaptureDialog from './InboxImageCaptureDialog';
import TaskPhotoImage from '../../../shared/ui/TaskPhotoImage';
import { hasTaskPhotoPreview } from '../../../shared/storage/taskPhotoPreview';

const getInboxLinkFallbackTitle = (displayTitle, redirectUrl) => {
  if (!redirectUrl || !/^(link|链接)$/i.test(String(displayTitle || '').trim())) return displayTitle;

  try {
    const hostname = new URL(redirectUrl).hostname.replace(/^www\./i, '');
    return hostname || displayTitle;
  } catch {
    return displayTitle;
  }
};

const getInboxSiteIconUrl = (redirectUrl) => {
  if (!redirectUrl) return null;
  try {
    const normalizedUrl = /^www\./i.test(redirectUrl) ? `https://${redirectUrl}` : redirectUrl;
    const parsedUrl = new URL(normalizedUrl);
    if (!/^https?:$/i.test(parsedUrl.protocol)) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsedUrl.hostname)}&sz=64`;
  } catch {
    return null;
  }
};

const InboxTaskItem = ({
  item,
  labels,
  packOptions,
  isMoveMenuOpen,
  isMoving,
  onMoveMenuOpenChange,
  onMoveToPack,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) => {
  const { cfg, displayTitle, displaySub, redirectUrl } = getTaskCardPresentation(item, labels);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const resolvedDisplayTitle = getInboxLinkFallbackTitle(displayTitle, redirectUrl);
  const siteIconUrl = getInboxSiteIconUrl(redirectUrl);
  const hasUploadedImage = String(item?.uploadedFileType || '').toLowerCase() === 'image'
    && hasTaskPhotoPreview(item);
  const shouldShowUploadedThumbnail = Boolean(hasUploadedImage && !thumbnailFailed);
  const usesNeutralIconSurface = Boolean(siteIconUrl || hasUploadedImage);
  const iconBackground = usesNeutralIconSurface ? '#f7f8fa' : cfg.bg;
  const iconBorder = usesNeutralIconSurface ? '1px solid #eef0f3' : 'none';

  return (
    <div
      className="desktop-inbox-item"
      onPointerDown={(event) => onPointerDown?.(item, event)}
      onPointerMove={(event) => onPointerMove?.(item, event)}
      onPointerUp={(event) => onPointerUp?.(item, event)}
      onPointerCancel={(event) => onPointerCancel?.(item, event)}
    >
      <div
        className="desktop-inbox-item-icon-wrapper"
        style={{
          background: iconBackground,
          border: iconBorder,
        }}
      >
        {shouldShowUploadedThumbnail ? (
          <TaskPhotoImage
            task={item}
            alt=""
            className="desktop-inbox-uploaded-thumbnail"
            onError={() => setThumbnailFailed(true)}
          />
        ) : siteIconUrl ? (
          <img src={siteIconUrl} alt="" className="desktop-inbox-site-icon" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = cfg.icon; }} />
        ) : (
          <img
            src={cfg.icon}
            alt={normalizeCardType(item.cardType)}
            style={{ width: 14, height: 14, objectFit: 'contain' }}
          />
        )}
      </div>
      <div className="desktop-inbox-item-copy">
        <div className="desktop-inbox-item-title">
          {resolvedDisplayTitle}
        </div>
        <div className="desktop-inbox-item-subtitle">
          {displaySub || item.sourceLabel || 'Item'}
        </div>
      </div>
      <DropdownMenu.Root
        open={isMoveMenuOpen}
        onOpenChange={(open) => onMoveMenuOpenChange(item.id, open)}
        modal={false}
      >
        <div className="desktop-inbox-move-control" onPointerDown={(event) => event.stopPropagation()}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="desktop-inbox-moveto-btn"
              disabled={isMoving || packOptions.length === 0}
              aria-label={packOptions.length ? `Move ${resolvedDisplayTitle} to a Pack` : 'No Packs available'}
              title={packOptions.length ? 'Move to a Pack' : 'No Packs available'}
            >
              {isMoving ? (labels.moving || 'Moving...') : (labels.moveToPack || 'Move to...')}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal container={getDesktopPortalContainer()}>
            <DropdownMenu.Content
              className="desktop-inbox-pack-menu"
              aria-label={`Choose a Pack for ${resolvedDisplayTitle}`}
              side="right"
              align="start"
              sideOffset={8 * DESKTOP_APP_WINDOW_SCALE}
              collisionPadding={16 * DESKTOP_APP_WINDOW_SCALE}
              style={{ transform: `scale(${DESKTOP_APP_WINDOW_SCALE})` }}
              onEscapeKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {packOptions.map((pack) => (
                <DropdownMenu.Item
                  key={pack.id}
                  className="desktop-inbox-pack-option"
                  onSelect={(event) => {
                    event.preventDefault();
                    onMoveToPack(item.id, pack.id);
                  }}
                >
                  <span className="desktop-inbox-pack-option-icon" aria-hidden="true">
                    {pack.icon || '•'}
                  </span>
                  <span className="desktop-inbox-pack-option-name">{pack.name}</span>
                  <span className="desktop-inbox-pack-option-count">{pack.itemCount}</span>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </div>
      </DropdownMenu.Root>
    </div>
  );
};

const InboxPanel = ({
  open,
  isDraggingOut = false,
  items = [],
  packOptions = [],
  t = {},
  onClose,
  onCreateItem,
  onImportFiles,
  onMoveToPack,
  onTaskPointerDown,
  onTaskPointerMove,
  onTaskPointerUp,
  onTaskPointerCancel,
  anchorRef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMoveItemId, setActiveMoveItemId] = useState(null);
  const [movingItemId, setMovingItemId] = useState(null);
  const [moveError, setMoveError] = useState('');
  const [clipboardImage, setClipboardImage] = useState(null);
  const [clipboardSubmitting, setClipboardSubmitting] = useState(false);
  const [clipboardError, setClipboardError] = useState('');
  const panelRef = useRef(null);

  const handleClose = useCallback(() => {
    onClose?.();
    setSearchQuery('');
    setActiveMoveItemId(null);
    setMoveError('');
  }, [onClose]);

  const handleMoveMenuOpenChange = useCallback((itemId, isOpen) => {
    if (isOpen) setMoveError('');
    setActiveMoveItemId(isOpen ? itemId : null);
  }, []);

  const handleMoveToPack = useCallback(async (itemId, packId) => {
    if (movingItemId !== null || typeof onMoveToPack !== 'function') return;

    setMovingItemId(itemId);
    setMoveError('');
    try {
      await onMoveToPack(itemId, packId);
      setActiveMoveItemId(null);
    } catch {
      setMoveError('Unable to move this item. It is still in Inbox.');
    } finally {
      setMovingItemId(null);
    }
  }, [movingItemId, onMoveToPack]);

  useEffect(() => {
    const handlePaste = (event) => {
      const target = event.target;
      if (isEditableClipboardTarget(target)) return;

      const file = normalizeClipboardImageFile(getClipboardImageFile(event.clipboardData?.items));
      if (!file) return;

      event.preventDefault();
      setClipboardError('');
      setClipboardImage(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleClipboardClose = useCallback(() => {
    if (clipboardSubmitting) return;
    setClipboardImage(null);
    setClipboardError('');
  }, [clipboardSubmitting]);

  const handleClipboardConfirm = useCallback(async (file, note) => {
    if (clipboardSubmitting || typeof onImportFiles !== 'function') return;
    setClipboardSubmitting(true);
    setClipboardError('');
    try {
      await onImportFiles([file], { destination: 'inbox', note });
      setClipboardImage(null);
    } catch (error) {
      console.error('Failed to save pasted image:', error);
      setClipboardError('Unable to save image. Please try again.');
    } finally {
      setClipboardSubmitting(false);
    }
  }, [clipboardSubmitting, onImportFiles]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    const positionPanel = () => {
      const panel = panelRef.current;
      const anchor = anchorRef?.current;
      if (!panel) return;

      const anchorRect = anchor?.getBoundingClientRect?.();
      const panelRect = panel.getBoundingClientRect();
      const computedPanelWidth = Number.parseFloat(window.getComputedStyle(panel).width) || 355;
      const renderedScale = panelRect.width > 0 ? panelRect.width / computedPanelWidth : 1;
      const panelWidth = panelRect.width || Math.min(355, window.innerWidth - 32) * renderedScale;
      const rightEdge = anchorRect?.right ?? window.innerWidth - 16;
      const viewportInset = 16 * renderedScale;
      const nextVisualLeft = Math.max(
        viewportInset,
        Math.min(rightEdge - panelWidth, window.innerWidth - panelWidth - viewportInset),
      );
      const nextVisualTop = Math.max(viewportInset, (anchorRect?.bottom ?? 73) + (5 * renderedScale));

      panel.style.left = `${Math.round(nextVisualLeft / renderedScale)}px`;
      panel.style.top = `${Math.round(nextVisualTop / renderedScale)}px`;
    };

    positionPanel();
    window.addEventListener('resize', positionPanel);
    return () => window.removeEventListener('resize', positionPanel);
  }, [anchorRef, open]);

  if (!open) {
    return (
      <InboxImageCaptureDialog
        file={clipboardImage}
        submitting={clipboardSubmitting}
        error={clipboardError}
        onClose={handleClipboardClose}
        onConfirm={handleClipboardConfirm}
      />
    );
  }

  const q = searchQuery.trim().toLowerCase();

  const filteredItems = q ? items.filter((item) => {
    const { displayTitle, displaySub } = getTaskCardPresentation(item, t);
    return (
      String(displayTitle || '').toLowerCase().includes(q) ||
      String(displaySub || '').toLowerCase().includes(q) ||
      String(item.text || '').toLowerCase().includes(q)
    );
  }) : items;

  const isEmpty = filteredItems.length === 0;

  return (
    <Dialog.Root
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
    <div className={`desktop-inbox-overlay ${isDraggingOut ? 'is-dragging-out' : ''}`}>
      <Dialog.Content
        asChild
        onInteractOutside={(event) => {
          if (event.target?.closest?.('[data-quick-add-layer]')) {
            event.preventDefault();
          }
        }}
      >
      <div
        ref={panelRef}
        className="desktop-inbox-container"
        aria-label={t.inbox || 'Inbox'}
      >
        <div className="desktop-inbox-header">
          <div className="desktop-inbox-title-row">
            <div className="desktop-inbox-heading-group">
              <h2 className="desktop-inbox-heading">{t.inbox || 'Inbox'}</h2>
              <span className="desktop-inbox-heading-count">{items.length}</span>
            </div>
            <div className="desktop-inbox-header-actions">
              <span className="desktop-inbox-new-badge" aria-label={t.quickAddNew || 'New feature'}>{t.quickAddNew || 'NEW'}</span>
              <QuickAddMenu
                labels={t}
                onCreateItem={onCreateItem}
                onImportFiles={onImportFiles}
                renderTrigger={({ open: quickAddOpen }) => (
                  <button
                    type="button"
                    className={`desktop-inbox-add-toggle ${quickAddOpen ? 'is-open' : ''}`}
                    aria-label={t.quickAddMenuLabel || 'Add to Inbox'}
                    aria-expanded={quickAddOpen}
                    aria-haspopup="menu"
                  >
                    <PlusIcon size={18} />
                  </button>
                )}
              />
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="desktop-inbox-close-btn"
                  aria-label={t.close || 'Close inbox'}
                >
                  <CloseIcon />
                </button>
              </Dialog.Close>
            </div>
          </div>
          <p className="desktop-inbox-subheading">
            {(items.length === 1 ? (t.inboxUnorganizedOne || '{count} unorganized item') : (t.inboxUnorganizedOther || '{count} unorganized items')).replace('{count}', items.length)}
          </p>
          <div className="desktop-inbox-search-container">
            <span className="desktop-inbox-search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder={t.searchInbox || 'Search inbox...'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveMoveItemId(null);
              }}
              className="desktop-inbox-search-input"
            />
            <span className="desktop-inbox-search-icon desktop-inbox-search-icon-right" aria-hidden="true">
              <SearchIcon />
            </span>
          </div>
        </div>

        <div
          className="desktop-inbox-content"
          onScroll={() => setActiveMoveItemId(null)}
        >
          {moveError ? (
            <div className="desktop-inbox-move-error" role="status">{moveError}</div>
          ) : null}
          {isEmpty ? (
            <div className="desktop-inbox-empty">
              {t.inboxEmpty || 'No items to organize'}
            </div>
          ) : (
            <div className="desktop-inbox-list">
              {filteredItems.map((item) => (
                <InboxTaskItem
                  key={item.id}
                  item={item}
                  labels={t}
                  packOptions={packOptions}
                  isMoveMenuOpen={activeMoveItemId === item.id}
                  isMoving={movingItemId === item.id}
                  onMoveMenuOpenChange={handleMoveMenuOpenChange}
                  onMoveToPack={handleMoveToPack}
                  onPointerDown={onTaskPointerDown}
                  onPointerMove={onTaskPointerMove}
                  onPointerUp={onTaskPointerUp}
                  onPointerCancel={onTaskPointerCancel}
                />
              ))}
            </div>
          )}
      </div>
      </div>
      </Dialog.Content>
      <InboxImageCaptureDialog
        file={clipboardImage}
        submitting={clipboardSubmitting}
        error={clipboardError}
        onClose={handleClipboardClose}
        onConfirm={handleClipboardConfirm}
      />
    </div>
    </Dialog.Root>
  );
};

export default InboxPanel;
