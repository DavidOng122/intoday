import React, { useState } from 'react';
import { OpenFullViewIcon } from '../../../shared/ui/icons/DesktopIcons';

import { getTaskCardPresentation, normalizeCardType, CARD_TYPES } from '../../../entities/task/model/taskCardPresentation';
import { getLogicalToday } from '../../../lib/dateHelpers';
import { dateKey } from '../../../lib/dateUtils';
import { getPackMetadataTextFromItems } from '../../pack';
import { getPackItemSourceMeta } from '../../pack';
import {
  getDesktopGroupCardHeight,
  getDesktopGroupDisplayName,
  getDesktopGroupDisplayTags,
  getDesktopGroupIcon,
  getDesktopGroupListHeight,
  getDesktopVisibleGroupTaskCount,
} from '../../pack';
import {
  DESKTOP_GROUP_CARD_COLLAPSED_LIST_MAX_HEIGHT,
  DESKTOP_GROUP_CARD_EXPANDED_LIST_MAX_HEIGHT,
  DESKTOP_PHOTO_CARD_HEIGHT,
} from '../model/canvasConstants';

const TaskCardFaviconIcon = ({ task, appearance, cfg, faviconUrl: propFaviconUrl }) => {
  const [imgError, setImgError] = useState(false);
  const { domain } = getPackItemSourceMeta(task, {});
  const iconBackground = appearance === 'dark' ? cfg.darkBg : cfg.bg;
  const iconBorder = appearance === 'dark' ? `1px solid ${cfg.darkStroke}` : 'none';
  const photoPreview = task?.photoDataUrl || task?.photoUrl;

  if (normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO && photoPreview) {
    return (
        <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', background: '#f3f3f3', border: iconBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img
            src={photoPreview}
            alt=""
            width={32}
            height={32}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
    );
  }

  const faviconUrl = propFaviconUrl || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null);

  if (faviconUrl && !imgError) {
    return (
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: appearance === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)',
        border: appearance === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <img
          src={faviconUrl}
          alt=""
          width={18}
          height={18}
          style={{ borderRadius: 3, objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: existing card-type icon
  return (
    <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBackground, border: iconBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {appearance === 'dark' && cfg.darkIconColor ? (
        <div style={{
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
        }} />
      ) : (
        <img src={cfg.icon} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
      )}
    </div>
  );
};

const TaskCardContent = ({ task, appearance, labels }) => {
  const { cfg, displayTitle, displaySub, faviconUrl } = getTaskCardPresentation(task, labels);
  const isPhotoCard = normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO;
  const photoPreview = task?.photoDataUrl || task?.photoUrl;

  // Resolve the best available content title
  const contentTitle = (() => {
    const fetched = task.photoTitle || task.linkTitle || task.videoTitle || task.musicTitle || task.mapTitle;
    if (fetched && fetched.trim()) return fetched.trim();
    return displayTitle; // already derived (may be slug, URL slug, or platform name)
  })();

  // Source label: e.g. "ChatGPT", "YouTube", "youtube.com"
  const { label: sourceLabel } = getPackItemSourceMeta(task, labels || {});

  // Only show subtitle if it adds different info from the title
  const subtitle = sourceLabel && sourceLabel.toLowerCase() !== contentTitle.toLowerCase()
    ? sourceLabel
    : displaySub;

  if (isPhotoCard && photoPreview) {
    return (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            width: '100%',
            height: 162,
            borderRadius: 12,
            overflow: 'hidden',
            background: appearance === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,17,0.04)',
            border: appearance === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(17,17,17,0.06)',
            flexShrink: 0,
          }}
        >
            <img
              src={photoPreview}
              alt={contentTitle || 'Photo'}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ maxWidth: '100%', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word', color: 'var(--desktop-card-title)', fontSize: 13, fontWeight: 590, lineHeight: '18px' }}>
            {contentTitle}
          </div>
          <div style={{ color: 'var(--desktop-card-desc)', fontSize: 11, fontWeight: 400, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <TaskCardFaviconIcon task={task} appearance={appearance} cfg={cfg} faviconUrl={faviconUrl} />
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ maxWidth: '100%', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word', color: 'var(--desktop-card-title)', fontSize: 13, fontWeight: 590, lineHeight: '20px' }}>
          {contentTitle}
        </div>
        <div style={{ color: 'var(--desktop-card-desc)', fontSize: 11, fontWeight: 400, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subtitle}
        </div>
      </div>
    </>
  );
};

const TaskCard = (props) => {
  const {
    task,
    appearance,
    onClick,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    isDragging,
    isSelected,
  } = props;
  const taskCardLabels = props?.labels;

  const isPast = task.dateString < dateKey(getLogicalToday());
  const isPhotoCard = normalizeCardType(task?.cardType) === CARD_TYPES.PHOTO;

  return (
      <div id={`desktop-task-wrapper-${task.id}`} className={`desktop-task-wrapper ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''} ${isPast ? 'is-past' : ''}`}>
      <button
        id={`desktop-task-card-${task.id}`}
        type="button"
        className={`desktop-task-card ${isDragging ? 'is-dragging' : ''}`}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDragStart={(event) => event.preventDefault()}
        style={{
          width: '100%',
          minHeight: isPhotoCard ? DESKTOP_PHOTO_CARD_HEIGHT : 76,
          borderRadius: 11,
          border: '2px solid var(--desktop-task-border)',
          background: 'var(--desktop-task-bg)',
          padding: isPhotoCard ? '10px' : '12px 14px',
          display: 'flex',
          flexDirection: isPhotoCard ? 'column' : 'row',
          alignItems: isPhotoCard ? 'stretch' : 'center',
          gap: 12,
          boxShadow: 'var(--desktop-task-shadow)',
          cursor: isDragging ? 'grabbing' : 'pointer',
          textAlign: 'left',
          opacity: 1,
          transition: 'none',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        <TaskCardContent
          task={task}
          appearance={appearance}
          labels={taskCardLabels}
          onDragStart={(e) => e.preventDefault()}
        />
      </button>
    </div>
  );
};

const GroupedTaskCard = ({
  tasks,
  appearance,
  labels,
  isDragging,
  isGroupDragActive,
  isSelected,
  draggedTaskId,
  onOpenItem,
  onOpenFullView,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) => {
  const leadTask = tasks[0];
  const [isExpanded, setIsExpanded] = useState(false);
  const groupTitle = getDesktopGroupDisplayName(tasks);
  const groupMetadataText = getPackMetadataTextFromItems(tasks);
  const groupChips = getDesktopGroupDisplayTags(tasks);
  const groupIcon = getDesktopGroupIcon(tasks);
  const groupTask = {
    ...leadTask,
    groupTaskIds: tasks.map((task) => task.id),
    groupSize: tasks.length,
    desktopGroupName: groupTitle,
    updatedAt: leadTask.updatedAt,
    isGroupInitiator: true,
  };

  // If we are dragging a single item out of this group, hide it from the group preview
  const isDraggingGroup = isDragging && isGroupDragActive;
  const filteredTasks = tasks.filter((t) => isDraggingGroup || t.id !== draggedTaskId);
  const collapsedVisibleCount = getDesktopVisibleGroupTaskCount(filteredTasks, DESKTOP_GROUP_CARD_COLLAPSED_LIST_MAX_HEIGHT);
  const expandedVisibleCount = getDesktopVisibleGroupTaskCount(filteredTasks, DESKTOP_GROUP_CARD_EXPANDED_LIST_MAX_HEIGHT);
  const visibleItemCount = isExpanded ? expandedVisibleCount : collapsedVisibleCount;
  const collapsedHiddenTaskCount = Math.max(0, filteredTasks.length - collapsedVisibleCount);
  const hiddenTaskCount = Math.max(0, filteredTasks.length - visibleItemCount);
  const groupCardMinHeight = getDesktopGroupCardHeight(filteredTasks, visibleItemCount);
  const groupListMaxHeight = getDesktopGroupListHeight(filteredTasks, visibleItemCount);
  const canScrollExpandedList = isExpanded && hiddenTaskCount > 0;

  return (
      <div id={`desktop-task-wrapper-${leadTask.id}`} className={`desktop-task-wrapper desktop-task-group-wrapper ${isDragging ? 'is-dragging' : ''} ${isSelected ? 'is-selected' : ''}`}>
        <div
          id={`desktop-group-card-${leadTask.id}`}
          className={`desktop-task-card desktop-task-group-card ${isDragging ? 'is-dragging' : ''} ${isExpanded ? 'is-expanded' : ''}`}
          onPointerDown={(event) => onPointerDown(groupTask, event)}
          onPointerMove={(event) => onPointerMove(groupTask, event)}
          onPointerUp={(event) => onPointerUp(groupTask, event)}
          onPointerCancel={(event) => onPointerCancel(groupTask, event)}
          onMouseLeave={() => setIsExpanded(false)}
          style={{ width: '100%', minHeight: groupCardMinHeight, touchAction: 'none', userSelect: 'none' }}
        >
          <button
            type="button"
            className="desktop-task-group-summary-button"
            aria-label="Open full view"
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              event.stopPropagation();
              onPointerDown?.(groupTask, event);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenFullView?.(event);
            }}
          >
            <div className="desktop-task-group-header">
              <div className="desktop-task-group-title-wrap">
                {groupIcon ? (
                  <span className="desktop-task-group-title-icon">{groupIcon}</span>
                ) : (
                  <span className="desktop-task-group-title-dot" />
                )}
                <div className="desktop-task-group-title-block">
                  <span
                    className="desktop-task-group-title"
                    onDragStart={(e) => e.preventDefault()}
                    style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                  >
                    {groupTitle}
                  </span>
                  {groupMetadataText ? (
                    <span
                      className="desktop-task-group-metadata"
                      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                    >
                      {groupMetadataText}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="desktop-task-group-header-actions">
                <span className="desktop-task-group-open-icon" aria-hidden="true">
                  <OpenFullViewIcon />
                </span>
              </div>
            </div>
            {groupChips.length > 0 ? (
              <div className="desktop-task-group-chip-row">
                {groupChips.map((chip) => (
                  <span key={chip} className="desktop-task-group-chip">{chip}</span>
                ))}
              </div>
            ) : null}
          </button>
          <div className="desktop-task-group-divider" />
        <div
          className="desktop-task-group-list"
          style={{ maxHeight: groupListMaxHeight, overflowY: canScrollExpandedList ? 'auto' : 'hidden' }}
          onPointerDown={(event) => {
            // Only trigger if clicking the list container itself (empty space)
            if (event.target === event.currentTarget) {
              onPointerDown?.(groupTask, event);
            }
          }}
          onPointerMove={(event) => {
            if (event.target === event.currentTarget) {
              onPointerMove?.(groupTask, event);
            }
          }}
          onPointerUp={(event) => {
            if (event.target === event.currentTarget) {
              onPointerUp?.(groupTask, event);
            }
          }}
          onPointerCancel={(event) => {
            if (event.target === event.currentTarget) {
              onPointerCancel?.(groupTask, event);
            }
          }}
        >
          {filteredTasks.map((task) => {
            const isTaskDragging = draggedTaskId === task.id && !isDraggingGroup;
            return (
              <div id={`desktop-task-wrapper-${task.id}`} key={task.id} style={{ display: 'block', width: '100%', visibility: isTaskDragging ? 'hidden' : 'visible' }}>
                <button
                  id={`desktop-task-card-${task.id}`}
                  type="button"
                  className="desktop-task-group-row"
                  onMouseDown={(event) => event.stopPropagation()}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onPointerDown?.(task, event);
                  }}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    onPointerMove?.(task, event);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    onPointerUp?.(task, event);
                  }}
                  onPointerCancel={(event) => {
                    onPointerCancel?.(task, event);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenItem?.(task);
                  }}
                >
                  <TaskCardContent task={task} appearance={appearance} labels={labels} />
                </button>
              </div>
            );
          })}
        </div>
        {(collapsedHiddenTaskCount > 0 || (isExpanded && hiddenTaskCount > 0)) && (
          <button
            type="button"
            className="desktop-task-group-more-label"
            onMouseEnter={() => setIsExpanded(true)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => setIsExpanded(false)}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.preventDefault()}
          >
            {isExpanded && hiddenTaskCount > 0 
              ? (labels.scrollForMore || 'Scroll for {count} more').replace('{count}', hiddenTaskCount) 
              : (labels.plusMore || '+ {count} more').replace('{count}', collapsedHiddenTaskCount)}
          </button>
        )}
      </div>
    </div>
  );
};

export { TaskCard, GroupedTaskCard };
