/* eslint-disable react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import EmojiPicker from 'emoji-picker-react';
import JSZip from 'jszip';
import { CARD_TYPES, getTaskCardPresentation, normalizeCardType } from '../../../entities/task/model/taskCardPresentation';
import { getPackMetadataTextFromItems } from '../model/packMetadata';
import { normalizePackTags } from '../../../entities/pack/model/packValueNormalizers';
import { getPackItemSourceMeta } from '../model/packItemSource';
import {
  getDesktopGroupDisplayName,
  getDesktopGroupDisplayTags,
  getDesktopGroupIcon,
} from '../model/groupMetadata';
import {
  buildCopyForAIText,
  buildRoleMarkdown,
  buildWholePackMarkdown,
  collectPackAssets,
  copyTextToClipboard,
  downloadBlob,
  downloadMarkdown,
  getPackFilterLabel,
  getPackRoleHeading,
  getPackTaskRoles,
  PACK_FILTER_ORDER,
  sanitizePackFilename,
} from '../services/packExport';
import DesktopDeleteConfirmModal from '../../../shared/ui/DeleteConfirmModal';
import {
  CloseIcon,
  GithubGlyphIcon,
  LinkGlobeIcon,
  NotionGlyphIcon,
  PackCopyIcon,
  PackExportIcon,
  PackLinkIcon,
  PackSelectIcon,
  PackShareIcon,
  SearchIcon,
  SparkRosetteIcon,
  VideoGlyphIcon,
  YouTubeGlyphIcon,
} from '../../../shared/ui/icons/DesktopIcons';

const PackItemSourceIcon = ({ task, appearance, labels }) => {
  const [imgError, setImgError] = useState(false);
  const { cfg } = getTaskCardPresentation(task, labels || {});
  const { sourceKey, domain } = getPackItemSourceMeta(task, labels || {});
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';
  const photoPreview = task?.photoDataUrl || task?.photoUrl;

  if (normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO && photoPreview) {
    return (
        <span className="desktop-pack-page-item-leading desktop-pack-page-item-leading-photo-preview" aria-hidden="true">
          <img
            src={photoPreview}
            alt=""
            width={36}
            height={36}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }}
          />
        </span>
    );
  }

  if (domain && !imgError) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    return (
      <span className="desktop-pack-page-item-leading desktop-pack-page-item-leading-favicon" aria-hidden="true">
        <img
          src={faviconUrl}
          alt=""
          width={22}
          height={22}
          style={{ borderRadius: 4, objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`desktop-pack-page-item-leading desktop-pack-page-item-leading-${sourceKey || 'link'}`}
      aria-hidden="true"
      style={{ background: iconBackground, border: iconBorder }}
    >
      {appearance === 'dark' && cfg.darkIconColor ? (
        <span
          style={{
            width: 18,
            height: 18,
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
        <img src={cfg.icon} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
      )}
    </span>
  );
};

const DesktopPackPageHeader = ({
  tasks,
  onUpdateGroup,
  appearance,
  labels = {},
  isSelectMode = false,
  selectedCount = 0,
  onExitSelectMode,
  onDeleteSelected,
}) => {
  const groupTitle = getDesktopGroupDisplayName(tasks);
  const groupIcon = getDesktopGroupIcon(tasks);
  const groupTags = getDesktopGroupDisplayTags(tasks);
  const updatedLabel = getPackMetadataTextFromItems(tasks);
  const metadataParts = [
    `${tasks.length} ${tasks.length === 1 ? 'item' : 'items'}`,
    updatedLabel,
  ].filter(Boolean);
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isTagInputOpen, setIsTagInputOpen] = useState(false);
  const [draftTag, setDraftTag] = useState('');

  const commitTitle = useCallback(() => {
    const nextTitle = draftTitle.trim();
    setIsTitleEditing(false);
    if (!nextTitle || nextTitle === groupTitle) return;
    onUpdateGroup({ desktopGroupName: nextTitle });
  }, [draftTitle, groupTitle, onUpdateGroup]);

  const handleTitleKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitTitle();
    }
    if (event.key === 'Escape') {
      setDraftTitle(groupTitle);
      setIsTitleEditing(false);
    }
  }, [commitTitle, groupTitle]);

  const handleTagSubmit = useCallback(() => {
    const nextTag = draftTag.trim();
    if (!nextTag) {
      setDraftTag('');
      setIsTagInputOpen(false);
      return;
    }

    const nextTags = normalizePackTags([...groupTags, nextTag]);
    onUpdateGroup({ desktopGroupTags: nextTags });
    setDraftTag('');
    setIsTagInputOpen(false);
  }, [draftTag, groupTags, onUpdateGroup]);


  return (
    <div className="desktop-pack-page-header">
      <div className="desktop-pack-page-header-body">
        <div className="desktop-pack-page-header-tools">
          {groupIcon ? (
            <button
              type="button"
              className="desktop-pack-page-icon"
              onClick={() => setIsIconPickerOpen((current) => !current)}
              aria-label="Change icon"
            >
              {groupIcon}
            </button>
          ) : (
            <button
              type="button"
              className="desktop-pack-page-inline-action"
              onClick={() => setIsIconPickerOpen((current) => !current)}
            >
              {labels.addIcon || 'Add icon'}
            </button>
          )}
          {!groupTags.length && !isTagInputOpen ? (
            <button
              type="button"
              className="desktop-pack-page-inline-action"
              onClick={() => setIsTagInputOpen(true)}
            >
              {labels.addTag || 'Add tag'}
            </button>
          ) : null}
        </div>

        {isIconPickerOpen ? (
          <div className="desktop-pack-page-icon-picker" style={{ padding: 0, border: 'none', background: 'transparent', boxShadow: 'none', zIndex: 9999 }}>
            <EmojiPicker
              theme={appearance === 'dark' ? 'dark' : 'light'}
              onEmojiClick={(emojiData) => {
                onUpdateGroup({ desktopGroupIcon: emojiData.emoji });
                setIsIconPickerOpen(false);
              }}
              skinTonesDisabled
              autoFocusSearch={false}
              width={320}
              height={400}
            />
            {groupIcon ? (
              <button
                type="button"
                className="desktop-pack-page-inline-action is-inline"
                style={{
                  marginTop: 8,
                  width: '100%',
                  justifyContent: 'center',
                  background: 'var(--desktop-cancel-bg)',
                  padding: '8px',
                  borderRadius: 8,
                }}
                onClick={() => {
                  onUpdateGroup({ desktopGroupIcon: null });
                  setIsIconPickerOpen(false);
                }}
              >
                {labels.removeIcon || 'Remove icon'}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="desktop-pack-page-title-area">
          {isTitleEditing ? (
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              className="desktop-pack-page-title-input"
              autoFocus
            />
          ) : (
            <button
              type="button"
              id="desktop-group-full-view-title"
              className="desktop-pack-page-title"
              onClick={() => {
                setDraftTitle(groupTitle);
                setIsTitleEditing(true);
              }}
            >
              {groupTitle}
            </button>
          )}
          <div className="desktop-pack-page-metadata">
            {metadataParts.join(' / ')}
          </div>
        </div>

        <div className="desktop-pack-page-tags">
          {groupTags.map((tag) => (
            <span key={tag} className="desktop-pack-page-tag">
              <span>{tag}</span>
              <button
                type="button"
                className="desktop-pack-page-tag-remove"
                onClick={() => onUpdateGroup({
                  desktopGroupTags: groupTags.filter((currentTag) => currentTag !== tag),
                })}
                aria-label={`Remove ${tag}`}
              >
                x
              </button>
            </span>
          ))}
          {isTagInputOpen ? (
            <input
              value={draftTag}
              onChange={(event) => setDraftTag(event.target.value)}
              onBlur={handleTagSubmit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleTagSubmit();
                }
                if (event.key === 'Escape') {
                  setDraftTag('');
                  setIsTagInputOpen(false);
                }
              }}
              className="desktop-pack-page-tag-input"
              placeholder={labels.addTag || 'Add tag'}
              autoFocus
            />
          ) : (
            <button
              type="button"
              className="desktop-pack-page-inline-action is-inline"
              onClick={() => setIsTagInputOpen(true)}
            >
              {labels.addTag || 'Add tag'}
            </button>
          )}
        </div>
      </div>
      {isSelectMode ? (
        <div className="desktop-pack-page-selection-bar">
          <button
            type="button"
            className="desktop-pack-page-selection-action"
            onClick={onExitSelectMode}
          >
            {labels.cancel || 'Cancel'}
          </button>
          <div className="desktop-pack-page-selection-count">
            {(labels.selectionCount || '{count} selected').replace('{count}', selectedCount)}
          </div>
          <button
            type="button"
            className="desktop-pack-page-selection-delete"
            onClick={onDeleteSelected}
            disabled={selectedCount === 0}
          >
            {labels.deleteSelectedCount || 'Delete selected'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

const DesktopShareLinkModal = ({ open, title, shareUrl, labels = {}, onClose, onCopied }) => {
  const [copied, setCopied] = useState(false);
  const handleClose = useCallback(() => {
    setCopied(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(shareUrl);
      setCopied(true);
      onCopied?.();
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="desktop-share-link-modal"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation();
        handleClose();
      }}
    >
      <div className="desktop-share-link-backdrop" />
      <div
        className="desktop-share-link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-share-link-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="desktop-share-link-header">
          <h2 id="desktop-share-link-title">{title}</h2>
          <button type="button" className="desktop-share-link-close" onClick={handleClose} aria-label={labels.close || 'Close'}>
            <CloseIcon />
          </button>
        </div>
        <div className="desktop-share-link-url-row">
          <div className="desktop-share-link-url" title={shareUrl}>{shareUrl}</div>
          <button type="button" className="desktop-share-link-copy" onClick={handleCopy}>
            <PackCopyIcon />
            <span>{copied ? (labels.copied || 'Copied') : (labels.copyLink || 'Copy link')}</span>
          </button>
        </div>
        <div className="desktop-share-link-notice">
          <span className="desktop-share-link-info" aria-hidden="true">i</span>
          <p>{labels.publicShareNotice || 'Anyone with the public link can access it. Share responsibly. You can delete the link at any time. Third-party sharing is subject to that platform’s policies.'}</p>
        </div>
      </div>
    </div>
  );
};


const DesktopGroupFullViewModal = ({
  view,
  appearance,
  labels,
  language,
  onClose,
  onTaskOpen,
  onDeleteTasks,
  onUpdateGroup,
  onToast,
}) => {
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isBackdropVisible, setIsBackdropVisible] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAtSourcePosition, setIsAtSourcePosition] = useState(false);
  const [flipSnapshot, setFlipSnapshot] = useState(null);
  const [hasOriginTransition, setHasOriginTransition] = useState(false);
  const exportMenuRef = useRef(null);
  const shareMenuRef = useRef(null);
  const shellRef = useRef(null);
  const openContentTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  
  const tasks = view?.tasks || [];
  const open = Boolean(view);

  useEffect(() => {
    if (!open) {
      setItemSearchQuery('');
      setActiveFilter('All');
      setIsSearchVisible(false);
      setIsExportMenuOpen(false);
      setIsShareMenuOpen(false);
      setIsShareModalOpen(false);
      setHighlightedTaskId(null);
      setIsSelectMode(false);
      setSelectedItemIds([]);
      setIsDeleteConfirmOpen(false);
      setIsBackdropVisible(false);
      setIsContentVisible(false);
      setIsClosing(false);
      setIsAtSourcePosition(false);
      setFlipSnapshot(null);
      setHasOriginTransition(false);
    }
  }, [open]);

  useEffect(() => () => {
    if (openContentTimerRef.current) window.clearTimeout(openContentTimerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!open || !view?.groupId || !shellRef.current) return;

    if (openContentTimerRef.current) window.clearTimeout(openContentTimerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    const finalRect = shellRef.current.getBoundingClientRect();
    const originRect = view.originRect;

    setIsClosing(false);

    if (!originRect || !finalRect.width || !finalRect.height) {
      setFlipSnapshot(null);
      setHasOriginTransition(false);
      setIsAtSourcePosition(false);
      setIsBackdropVisible(true);
      setIsContentVisible(true);
      return;
    }

    const scaleX = Math.max(0.36, originRect.width / finalRect.width);
    const scaleY = Math.max(0.22, originRect.height / finalRect.height);
    const translateX = (originRect.left + (originRect.width / 2)) - (finalRect.left + (finalRect.width / 2));
    const translateY = (originRect.top + (originRect.height / 2)) - (finalRect.top + (finalRect.height / 2));

    setFlipSnapshot({
      translateX,
      translateY,
      scaleX,
      scaleY,
    });
    setHasOriginTransition(true);
    setIsAtSourcePosition(true);
    setIsBackdropVisible(false);
    setIsContentVisible(false);

    window.requestAnimationFrame(() => {
      setIsBackdropVisible(true);
      setIsAtSourcePosition(false);
      openContentTimerRef.current = window.setTimeout(() => {
        setIsContentVisible(true);
      }, 110);
    });
  }, [open, view?.groupId]);

  useEffect(() => {
    const existingIds = new Set(tasks.map((task) => task.id));
    console.debug('[desktop-group-modal] prune selected items effect', {
      open,
      taskCount: tasks.length,
      taskIds: tasks.map((task) => task.id),
    });
    setSelectedItemIds((current) => {
      const next = current.filter((taskId) => existingIds.has(taskId));
      const changed = next.length !== current.length;
      console.debug('[desktop-group-modal] prune selected items setState', {
        previous: current,
        next,
        changed,
      });
      return changed ? next : current;
    });
  }, [tasks]);

  useEffect(() => {
    if (!open || (!isExportMenuOpen && !isShareMenuOpen)) return undefined;

    const handlePointerDown = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setIsShareMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
        setIsShareMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportMenuOpen, isShareMenuOpen, open]);

  useEffect(() => {
    if (!open || !view?.focusTaskId) return undefined;

    const targetId = view.focusTaskId;
    setHighlightedTaskId(targetId);
    const scrollTimer = window.setTimeout(() => {
      const node = document.getElementById(`desktop-pack-page-item-${targetId}`);
      node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
    const clearTimer = window.setTimeout(() => {
      setHighlightedTaskId((current) => (current === targetId ? null : current));
    }, 2200);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [open, view?.focusTaskId]);
  
  const filteredTasks = useMemo(() => {
    let list = [...tasks];

    // Filter by role
    if (activeFilter !== 'All') {
      list = list.filter(task => {
        const roles = getPackTaskRoles(task, labels);
        return roles.includes(activeFilter);
      });
    }

    // Search filter
    if (itemSearchQuery.trim()) {
      const sq = itemSearchQuery.toLowerCase();
      list = list.filter(task => {
        const { displayTitle, displaySub } = getTaskCardPresentation(task, labels);
        const { domain } = getPackItemSourceMeta(task, labels);
        return (
          (displayTitle || '').toLowerCase().includes(sq) ||
          (displaySub || '').toLowerCase().includes(sq) ||
          (task.text || '').toLowerCase().includes(sq) ||
          (domain || '').toLowerCase().includes(sq) ||
          (task.tags || []).some(t => t.toLowerCase().includes(sq))
        );
      });
    }
    
    return list;
  }, [tasks, itemSearchQuery, activeFilter, labels]);

  if (!open || !tasks?.length) return null;

  const filters = PACK_FILTER_ORDER;
  const isDark = appearance === 'dark';
  const selectedCount = selectedItemIds.length;
  const groupTitle = getDesktopGroupDisplayName(tasks);
  const shareUrl = `${window.location.origin}/share/${sanitizePackFilename(groupTitle)}`;
  const toggleSelectItem = (taskId) => {
    setSelectedItemIds((current) => (
      current.includes(taskId)
        ? current.filter((id) => id !== taskId)
        : [...current, taskId]
    ));
  };
  const enterSelectMode = () => {
    setIsSearchVisible(false);
    setIsExportMenuOpen(false);
    setIsShareMenuOpen(false);
    setIsSelectMode(true);
    setSelectedItemIds([]);
    setIsDeleteConfirmOpen(false);
  };
  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedItemIds([]);
    setIsDeleteConfirmOpen(false);
  };
  const handleDeleteSelected = () => {
    if (selectedCount === 0) return;
    setIsDeleteConfirmOpen(true);
  };
  const confirmDeleteSelected = () => {
    if (selectedCount === 0) {
      setIsDeleteConfirmOpen(false);
      return;
    }
    onDeleteTasks?.(selectedItemIds);
    setIsDeleteConfirmOpen(false);
    setSelectedItemIds([]);
    setIsSelectMode(false);
  };
  const handleExportWholePack = () => {
    const markdown = buildWholePackMarkdown(tasks, labels);
    const filename = `${sanitizePackFilename(getDesktopGroupDisplayName(tasks))}.md`;
    downloadMarkdown(filename, markdown);
    setIsExportMenuOpen(false);
    setIsShareMenuOpen(false);
    setIsShareModalOpen(false);
  };
  const handleExportPackBundle = async () => {
    try {
      const { assets, assetPathByStorageKey, assetPathByTaskId } = await collectPackAssets(tasks);
      const markdown = buildWholePackMarkdown(tasks, labels, { assetPathByStorageKey, assetPathByTaskId });
      const zip = new JSZip();
      zip.file('context.md', markdown);
      assets.forEach((asset) => {
        zip.file(asset.path, asset.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const packSlug = sanitizePackFilename(getDesktopGroupDisplayName(tasks));
      const filename = packSlug === 'untitled-pack' ? 'untitled-pack.zip' : `${packSlug}-pack.zip`;
      downloadBlob(filename, zipBlob);
    } catch (error) {
      console.error('Failed to export pack bundle:', error);
      onToast?.('Unable to export pack bundle');
    }
    setIsExportMenuOpen(false);
  };
  const handleCopyWholePackForAi = async () => {
    const text = buildCopyForAIText(tasks, labels, 'all');
    if (!text) {
      onToast?.('No pack content to copy');
      setIsExportMenuOpen(false);
      return;
    }
    try {
      await copyTextToClipboard(text);
      onToast?.('Copied whole pack for AI');
    } catch {
      onToast?.('Unable to copy whole pack');
    }
    setIsExportMenuOpen(false);
  };
  const handleCopyRoleForAi = async (role, exportType) => {
    const text = buildCopyForAIText(tasks, labels, exportType);
    const roleHeading = getPackRoleHeading(role);
    if (!text) {
      onToast?.(`No ${roleHeading} items to copy`);
      setIsExportMenuOpen(false);
      return;
    }
    try {
      await copyTextToClipboard(text);
      onToast?.(`Copied ${roleHeading} for AI`);
    } catch {
      onToast?.(`Unable to copy ${roleHeading}`);
    }
    setIsExportMenuOpen(false);
  };
  const handleExportByRole = (role) => {
    const markdown = buildRoleMarkdown(tasks, labels, role);
    const roleHeading = getPackRoleHeading(role);
    const roleSlug = roleHeading.toLowerCase();
    if (!markdown) {
      onToast?.(`No ${roleHeading} items to export`);
      setIsExportMenuOpen(false);
      return;
    }
    const filename = `${sanitizePackFilename(getDesktopGroupDisplayName(tasks))}-${roleSlug}.md`;
    downloadMarkdown(filename, markdown);
    setIsExportMenuOpen(false);
  };
  const handleExportMenuAction = (action) => {
    if (action === 'copy-for-ai') {
      handleCopyWholePackForAi();
      return;
    }
    if (action === 'copy-context') {
      handleCopyRoleForAi('Context', 'context');
      return;
    }
    if (action === 'copy-code') {
      handleCopyRoleForAi('Code', 'code');
      return;
    }
    if (action === 'copy-notes') {
      handleCopyRoleForAi('Notes', 'notes');
      return;
    }
    if (action === 'copy-reference') {
      handleCopyRoleForAi('Reference', 'reference');
      return;
    }
    if (action === 'whole-pack') {
      handleExportWholePack();
      return;
    }
    if (action === 'pack-bundle') {
      void handleExportPackBundle();
      return;
    }
    if (action === 'context') {
      handleExportByRole('Context');
      return;
    }
    if (action === 'code') {
      handleExportByRole('Code');
      return;
    }
    if (action === 'notes') {
      handleExportByRole('Notes');
      return;
    }
    if (action === 'reference') {
      handleExportByRole('Reference');
      return;
    }
    setIsExportMenuOpen(false);
  };
  const exportMenuOptions = (() => {
    switch (activeFilter) {
      case 'Context':
        return [
          { id: 'copy-context', label: labels.copyForAI || 'Copy for AI' },
          { id: 'context', label: labels.exportContext || 'Export Context' },
        ];
      case 'Code':
        return [
          { id: 'copy-code', label: labels.copyForAI || 'Copy for AI' },
          { id: 'code', label: labels.exportTech || 'Export Tech' },
        ];
      case 'Notes':
        return [
          { id: 'copy-notes', label: labels.copyForAI || 'Copy for AI' },
          { id: 'notes', label: labels.exportNotes || 'Export Notes' },
        ];
      case 'Reference':
        return [
          { id: 'copy-reference', label: labels.copyForAI || 'Copy for AI' },
          { id: 'reference', label: labels.exportReference || 'Export Reference' },
        ];
      case 'All':
      default:
        return [
          { id: 'copy-for-ai', label: labels.copyForAI || 'Copy for AI' },
          { id: 'whole-pack', label: labels.exportWholePack || 'Export whole pack' },
          { id: 'pack-bundle', label: labels.exportPackBundle || 'Export Pack Bundle (.zip)' },
        ];
    }
  })();

  const handleRequestClose = () => {
    if (isClosing) return;

    if (openContentTimerRef.current) window.clearTimeout(openContentTimerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    setIsExportMenuOpen(false);
    setIsShareMenuOpen(false);
    setIsShareModalOpen(false);
    setIsDeleteConfirmOpen(false);
    setIsContentVisible(false);
    setIsBackdropVisible(false);
    setIsClosing(true);

    closeTimerRef.current = window.setTimeout(() => {
      onClose?.();
    }, view?.originRect ? 260 : 180);
  };

  const shellMotionStyle = flipSnapshot ? {
    '--desktop-pack-flip-x': `${flipSnapshot.translateX}px`,
    '--desktop-pack-flip-y': `${flipSnapshot.translateY}px`,
    '--desktop-pack-flip-scale-x': `${flipSnapshot.scaleX}`,
    '--desktop-pack-flip-scale-y': `${flipSnapshot.scaleY}`,
  } : undefined;

  return (
    <div
      role="presentation"
      onClick={handleRequestClose}
      className="desktop-pack-page-modal"
    >
      <div className={`desktop-pack-page-backdrop ${isBackdropVisible ? 'is-visible' : ''}`} />
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-group-full-view-title"
        onClick={(event) => event.stopPropagation()}
        className={`desktop-pack-page-shell ${isDark ? 'is-dark' : ''} ${hasOriginTransition ? 'has-origin-transition' : ''} ${isAtSourcePosition ? 'is-from-card' : ''} ${isClosing ? 'is-closing' : ''}`}
        style={shellMotionStyle}
      >
        <div className={`desktop-pack-page-shell-inner ${isContentVisible ? 'is-visible' : ''}`}>
        <div className="desktop-pack-page-topbar">
          <button
            type="button"
            onClick={handleRequestClose}
            aria-label={labels.close}
            className="desktop-pack-page-close"
          >
            <CloseIcon />
          </button>
        </div>

        <DesktopPackPageHeader
          tasks={tasks}
          onUpdateGroup={onUpdateGroup}
          appearance={appearance}
          language={language}
          labels={labels}
          isSelectMode={isSelectMode}
          selectedCount={selectedCount}
          onEnterSelectMode={enterSelectMode}
          onExitSelectMode={exitSelectMode}
          onDeleteSelected={handleDeleteSelected}
        />

        <div className="desktop-pack-page-content">
          <div className="desktop-pack-page-controls">
            <div className="desktop-pack-page-controls-bar">
              <div className="desktop-pack-page-filters" role="tablist" aria-label="Pack filters">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={`desktop-pack-page-filter-btn ${activeFilter === filter ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveFilter(filter);
                      setIsSearchVisible(false);
                      setIsExportMenuOpen(false);
                    }}
                  >
                    {getPackFilterLabel(filter, labels)}
                  </button>
                ))}
              </div>
              <div className={`desktop-pack-page-control-actions ${isSelectMode ? 'is-select-mode' : ''}`}>
                {isSelectMode ? (
                  <button
                    type="button"
                    className="desktop-pack-page-toolbar-action desktop-pack-page-toolbar-text-action is-active"
                    onClick={exitSelectMode}
                  >
                    <PackSelectIcon />
                    <span>{labels.select || 'Select'}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`desktop-pack-page-toolbar-action desktop-pack-page-search-toggle ${isSearchVisible ? 'is-active' : ''}`}
                      onClick={() => {
                        setIsSearchVisible((current) => !current);
                        setIsExportMenuOpen(false);
                        setIsShareMenuOpen(false);
                      }}
                      aria-label="Search items"
                      aria-expanded={isSearchVisible}
                    >
                      <SearchIcon />
                    </button>
                    <span className="desktop-pack-page-toolbar-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className="desktop-pack-page-toolbar-action desktop-pack-page-toolbar-text-action"
                      onClick={enterSelectMode}
                    >
                      <PackSelectIcon />
                      <span>{labels.select || 'Select'}</span>
                    </button>
                    <div className="desktop-pack-page-toolbar-menu-anchor" ref={shareMenuRef}>
                      <button
                        type="button"
                        className={`desktop-pack-page-toolbar-action desktop-pack-page-toolbar-text-action desktop-pack-page-share-button ${isShareMenuOpen ? 'is-active' : ''}`}
                        aria-haspopup="menu"
                        aria-expanded={isShareMenuOpen}
                        onClick={() => {
                          setIsShareMenuOpen((current) => !current);
                          setIsExportMenuOpen(false);
                        }}
                      >
                        <PackShareIcon />
                        <span>{labels.share || 'Share'}</span>
                      </button>
                      {isShareMenuOpen ? (
                        <div className="desktop-pack-page-toolbar-menu desktop-pack-page-share-menu" role="menu" aria-label={labels.share || 'Share'}>
                          <button
                            type="button"
                            role="menuitem"
                            className="desktop-pack-page-share-menu-item"
                            onClick={() => {
                              setIsShareMenuOpen(false);
                              setIsShareModalOpen(true);
                            }}
                          >
                            <span className="desktop-pack-page-share-menu-icon"><PackLinkIcon /></span>
                            <span className="desktop-pack-page-share-menu-copy">
                              <strong>{labels.copyShareLink || 'Copy share link'}</strong>
                              <small>{labels.shareLinkSubtitle || 'Share this group with a link'}</small>
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="desktop-pack-page-toolbar-menu-anchor" ref={exportMenuRef}>
                      <button
                        type="button"
                        className={`desktop-pack-page-toolbar-action desktop-pack-page-toolbar-text-action ${isExportMenuOpen ? 'is-active' : ''}`}
                        aria-haspopup="menu"
                        aria-expanded={isExportMenuOpen}
                        onClick={() => {
                          setIsExportMenuOpen((current) => !current);
                          setIsShareMenuOpen(false);
                        }}
                      >
                        <PackExportIcon />
                        <span>{labels.exportPack || 'Export'}</span>
                      </button>
                      {isExportMenuOpen ? (
                        <div className="desktop-pack-page-toolbar-menu" role="menu" aria-label="Export pack">
                          {exportMenuOptions.map(({ id, label }) => (
                            <button
                              key={id}
                              type="button"
                              role="menuitem"
                              className="desktop-pack-page-toolbar-menu-item"
                              onClick={() => handleExportMenuAction(id)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
            {isSearchVisible && (
              <div className="desktop-pack-page-search-wrapper is-revealed">
                <SearchIcon />
                <input
                  type="text"
                  placeholder={labels.searchInPack || 'Search in pack...'}
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="desktop-pack-page-search-input"
                  autoFocus
                />
              </div>
            )}
          </div>
          
          <div className="desktop-pack-page-item-list">
            {filteredTasks.length === 0 ? (
              <div className="desktop-pack-page-empty">{labels.noItemsFound || 'No items found'}</div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  id={`desktop-pack-page-item-${task.id}`}
                  className={`desktop-pack-page-item ${highlightedTaskId === task.id ? 'is-highlighted' : ''}`}
                >
                  {isSelectMode ? (
                    <button
                      type="button"
                      className={`desktop-pack-page-item-checkbox ${selectedItemIds.includes(task.id) ? 'is-selected' : ''}`}
                      aria-pressed={selectedItemIds.includes(task.id)}
                      aria-label={`${selectedItemIds.includes(task.id) ? 'Deselect' : 'Select'} ${task.text || 'item'}`}
                      onClick={() => toggleSelectItem(task.id)}
                    >
                      <span className="desktop-pack-page-item-checkbox-mark" aria-hidden="true">
                        {selectedItemIds.includes(task.id) ? '✓' : ''}
                      </span>
                    </button>
                  ) : null}
                  {(() => {
                    const { label } = getPackItemSourceMeta(task, labels);
                    const { displayTitle } = getTaskCardPresentation(task, labels);
                    return (
                      <>
                        <PackItemSourceIcon task={task} appearance={appearance} labels={labels} />
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelectMode) {
                              toggleSelectItem(task.id);
                              return;
                            }
                            onTaskOpen(task);
                          }}
                          className="desktop-pack-page-item-main"
                        >
                          <div className="desktop-pack-page-item-title">
                            {displayTitle || task.text || 'Untitled item'}
                          </div>
                          <div className="desktop-pack-page-item-subtitle">
                            {label}
                          </div>
                        </button>
                      </>
                    );
                  })()}
                </div>
              ))
            )}
          </div>
        </div>
        <DesktopDeleteConfirmModal
          open={isDeleteConfirmOpen}
          title={selectedCount === 1 
            ? (labels.deleteItemQuestion || 'Delete this item?') 
            : (labels.deleteMultipleItemsQuestion || 'Delete {count} selected items?').replace('{count}', selectedCount)}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={confirmDeleteSelected}
        />
        </div>
      </div>
      <DesktopShareLinkModal
        open={isShareModalOpen}
        title={groupTitle}
        shareUrl={shareUrl}
        labels={labels}
        onClose={() => setIsShareModalOpen(false)}
        onCopied={() => onToast?.(labels.linkCopied || 'Link copied')}
      />
    </div>
  );
};

export default DesktopGroupFullViewModal;
