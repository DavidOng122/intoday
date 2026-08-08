import React from 'react';
import { DESKTOP_CANVAS_CARD_WIDTH, DESKTOP_MAIN_CONTENT_MAX_WIDTH } from '../model/canvasConstants';

const DesktopCanvas = ({
  entries,
  canvasHeight,
  appearance,
  labels,
  onTaskClick,
  onGroupOpenFullView,
  onTaskPointerDown,
  onTaskPointerMove,
  onTaskPointerUp,
  onTaskPointerCancel,
  draggedTaskId,
  isGroupDragActive,
  selectedTaskIds,
  selectionRect,
  dragOverlapTargetId,
  TaskCardComponent: TaskCardView,
  GroupedTaskCardComponent: GroupedTaskCardView,
  layoutWidth = DESKTOP_MAIN_CONTENT_MAX_WIDTH,
}) => {
  // Keep explicit references for ESLint configurations that do not count JSX tags as usage.
  void TaskCardView;
  void GroupedTaskCardView;
  return (
  <div style={{ width: layoutWidth, minHeight: canvasHeight, height: canvasHeight, margin: '0 auto', position: 'relative' }}>
    {entries.length > 0 ? entries.map((entry) => {
      const dragTask = entry.type === 'group'
        ? { ...entry.task, groupTaskIds: entry.tasks.map((task) => task.id), groupSize: entry.tasks.length }
        : entry.task;
      const entryIdentity = entry.type === 'group' ? entry.id : entry.task.id;
      const isGroupReady = dragOverlapTargetId === entryIdentity;
      const isDragging = entry.type === 'group'
        ? draggedTaskId === dragTask.id && isGroupDragActive
        : draggedTaskId === entry.task.id && !isGroupDragActive;

      return (
        <div key={entry.type === 'group' ? `group-${entry.id}` : entry.task.id} id={`desktop-canvas-entry-${dragTask.id}`} data-desktop-layout-id={`task-${dragTask.id}`} className="desktop-canvas-card-node" style={{ left: entry.x, top: entry.y, width: DESKTOP_CANVAS_CARD_WIDTH }}>
          <div className={`desktop-canvas-card-shell ${isGroupReady ? 'desktop-canvas-card-shell--group-ready' : ''} ${isDragging ? 'is-dragging' : ''}`}>
            {entry.type === 'group' ? (
              <GroupedTaskCardView
                tasks={entry.tasks}
                appearance={appearance}
                labels={labels}
                isDragging={isDragging}
                isGroupDragActive={isGroupDragActive}
                isSelected={entry.tasks.every((task) => selectedTaskIds.includes(task.id))}
                isGroupReady={isGroupReady}
                draggedTaskId={draggedTaskId}
                onOpenItem={onTaskClick}
                onOpenFullView={(event) => onGroupOpenFullView(entry.tasks, event)}
                onPointerDown={onTaskPointerDown}
                onPointerMove={onTaskPointerMove}
                onPointerUp={onTaskPointerUp}
                onPointerCancel={onTaskPointerCancel}
              />
            ) : (
              <TaskCardView
                task={entry.task}
                appearance={appearance}
                labels={labels}
                isDragging={isDragging}
                isSelected={selectedTaskIds.includes(entry.task.id)}
                isGroupReady={isGroupReady}
                draggedTaskId={draggedTaskId}
                onClick={(event) => onTaskClick(entry.task, event)}
                onPointerDown={(event) => onTaskPointerDown(entry.task, event)}
                onPointerMove={(event) => onTaskPointerMove(entry.task, event)}
                onPointerUp={(event) => onTaskPointerUp(entry.task, event)}
                onPointerCancel={(event) => onTaskPointerCancel(entry.task, event)}
              />
            )}
          </div>
        </div>
      );
    }) : (
      <div
        aria-hidden="true"
        style={{
          minHeight: 220,
          borderRadius: 28,
          border: appearance === 'dark' ? 'none' : '1px dashed var(--desktop-divider)',
          background: appearance === 'dark' ? 'transparent' : 'var(--desktop-section-bg)',
        }}
      />
    )}
    {selectionRect ? (
      <div
        className="desktop-canvas-selection-rect"
        aria-hidden="true"
        style={{ left: selectionRect.x, top: selectionRect.y, width: selectionRect.width, height: selectionRect.height }}
      />
    ) : null}
  </div>
  );
};

export default React.memo(DesktopCanvas);
