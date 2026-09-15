import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import {
  SearchIcon,
  CloseIcon,
  PlusIcon,
} from '../../../shared/ui/icons/DesktopIcons';
import { getTaskCardPresentation, normalizeCardType } from '../../../entities/task/model/taskCardPresentation';
import QuickAddMenu from '../../capture/components/QuickAddMenu';

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
  appearance,
  labels,
  packOptions,
  isMoveMenuOpen,
  moveMenuPosition,
  isMoving,
  onToggleMoveMenu,
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
  const uploadedImageUrl = String(item?.uploadedFileType || '').toLowerCase() === 'image'
    ? (item.photoUrl || item.photoDataUrl || null)
    : null;
  const shouldShowUploadedThumbnail = Boolean(uploadedImageUrl && !thumbnailFailed);
  const usesNeutralIconSurface = Boolean(siteIconUrl || uploadedImageUrl);
  const iconBackground = usesNeutralIconSurface ? (appearance === 'dark' ? '#2a2a2c' : '#f7f8fa') : (appearance === 'dark' ? cfg.darkBg : cfg.bg);
  const iconBorder = usesNeutralIconSurface ? (appearance === 'dark' ? '1px solid #3a3d42' : '1px solid #eef0f3') : (appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none');

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
          <img
            src={uploadedImageUrl}
            alt=""
            className="desktop-inbox-uploaded-thumbnail"
            onError={() => setThumbnailFailed(true)}
          />
        ) : siteIconUrl ? (
          <img src={siteIconUrl} alt="" className="desktop-inbox-site-icon" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = cfg.icon; }} />
        ) : appearance === 'dark' && cfg.darkIconColor ? (
          <div
            style={{
              width: 14,
              height: 14,
              backgroundColor: cfg.darkIconColor,
              maskImage: `url(${cfg.icon})`,
              WebkitMaskImage: `url(${cfg.icon})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
            }}
          />
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
      <div className="desktop-inbox-move-control" onPointerDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="desktop-inbox-moveto-btn"
          disabled={isMoving || packOptions.length === 0}
          aria-haspopup="menu"
          aria-expanded={isMoveMenuOpen}
          aria-label={packOptions.length ? `Move ${resolvedDisplayTitle} to a Pack` : 'No Packs available'}
          title={packOptions.length ? 'Move to a Pack' : 'No Packs available'}
          onClick={(event) => onToggleMoveMenu(item.id, event.currentTarget)}
        >
          {isMoving ? (labels.moving || 'Moving...') : (labels.moveToPack || 'Move to...')}
        </button>

        {isMoveMenuOpen && moveMenuPosition && typeof document !== 'undefined' ? createPortal(
          <div
            className={`desktop-inbox-pack-menu ${appearance === 'dark' ? 'is-dark' : ''}`}
            role="menu"
            aria-label={`Choose a Pack for ${resolvedDisplayTitle}`}
            style={{
              left: moveMenuPosition.left,
              top: moveMenuPosition.top,
              transform: `scale(${moveMenuPosition.scale})`,
              transformOrigin: 'top left',
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {packOptions.map((pack) => (
              <button
                key={pack.id}
                type="button"
                role="menuitem"
                className="desktop-inbox-pack-option"
                onClick={() => onMoveToPack(item.id, pack.id)}
              >
                <span className="desktop-inbox-pack-option-icon" aria-hidden="true">
                  {pack.icon || '•'}
                </span>
                <span className="desktop-inbox-pack-option-name">{pack.name}</span>
                <span className="desktop-inbox-pack-option-count">{pack.itemCount}</span>
              </button>
            ))}
          </div>,
          document.body,
        ) : null}
      </div>
    </div>
  );
};

const InboxPanel = ({
  open,
  isDraggingOut = false,
  items = [],
  packOptions = [],
  appearance,
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
  const [moveMenuPosition, setMoveMenuPosition] = useState(null);
  const [movingItemId, setMovingItemId] = useState(null);
  const [moveError, setMoveError] = useState('');
  const panelRef = useRef(null);

  const handleClose = useCallback(() => {
    onClose?.();
    setSearchQuery('');
    setActiveMoveItemId(null);
    setMoveMenuPosition(null);
    setMoveError('');
  }, [onClose]);

  const handleToggleMoveMenu = useCallback((itemId, anchorElement) => {
    setMoveError('');
    if (activeMoveItemId === itemId) {
      setActiveMoveItemId(null);
      setMoveMenuPosition(null);
      return;
    }

    const anchorRect = anchorElement.getBoundingClientRect();
    const panelRect = anchorElement.closest('.desktop-inbox-container')?.getBoundingClientRect();
    const computedWidth = Number.parseFloat(window.getComputedStyle(anchorElement).width) || 78;
    const renderedScale = anchorRect.width > 0 ? anchorRect.width / computedWidth : 1;
    const menuVisualWidth = 220 * renderedScale;
    const menuVisualGap = 8 * renderedScale;
    const menuVisualInset = 16 * renderedScale;
    const panelLeft = panelRect?.left ?? anchorRect.left;
    const panelRight = panelRect?.right ?? anchorRect.right;
    const canOpenToRight = panelRight + menuVisualGap + menuVisualWidth
      <= window.innerWidth - menuVisualInset;

    setMoveMenuPosition({
      left: (canOpenToRight
        ? panelRight + menuVisualGap
        : panelLeft - menuVisualGap - menuVisualWidth),
      top: anchorRect.top,
      scale: renderedScale,
    });
    setActiveMoveItemId(itemId);
  }, [activeMoveItemId]);

  const handleMoveToPack = useCallback(async (itemId, packId) => {
    if (movingItemId !== null || typeof onMoveToPack !== 'function') return;

    setMovingItemId(itemId);
    setMoveError('');
    try {
      await onMoveToPack(itemId, packId);
      setActiveMoveItemId(null);
      setMoveMenuPosition(null);
    } catch {
      setMoveError('Unable to move this item. It is still in Inbox.');
    } finally {
      setMovingItemId(null);
    }
  }, [movingItemId, onMoveToPack]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeMoveItemId !== null) {
          setActiveMoveItemId(null);
          setMoveMenuPosition(null);
        } else {
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMoveItemId, open, handleClose]);

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

  if (!open) return null;

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
    <div
      role="presentation"
      className={`desktop-inbox-overlay ${isDraggingOut ? 'is-dragging-out' : ''}`}
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        className="desktop-inbox-container"
        role="dialog"
        aria-modal="true"
        aria-label={t.inbox || 'Inbox'}
        onClick={(e) => e.stopPropagation()}
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
                renderTrigger={({ open: quickAddOpen, toggle }) => (
                  <button
                    type="button"
                    className={`desktop-inbox-add-toggle ${quickAddOpen ? 'is-open' : ''}`}
                    onClick={toggle}
                    aria-label={t.quickAddMenuLabel || 'Add to Inbox'}
                    aria-expanded={quickAddOpen}
                    aria-haspopup="menu"
                  >
                    <PlusIcon size={18} />
                  </button>
                )}
              />
              <button
                type="button"
                className="desktop-inbox-close-btn"
                onClick={handleClose}
                aria-label={t.close || 'Close inbox'}
              >
                <CloseIcon />
              </button>
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
          onScroll={() => {
            setActiveMoveItemId(null);
            setMoveMenuPosition(null);
          }}
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
                  appearance={appearance}
                  labels={t}
                  packOptions={packOptions}
                  isMoveMenuOpen={activeMoveItemId === item.id}
                  moveMenuPosition={moveMenuPosition}
                  isMoving={movingItemId === item.id}
                  onToggleMoveMenu={handleToggleMoveMenu}
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
    </div>
  );
};

export default InboxPanel;
