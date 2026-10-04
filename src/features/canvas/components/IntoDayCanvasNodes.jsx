import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { DESKTOP_CANVAS_CARD_WIDTH } from '../model/canvasConstants.js';
import { getCanvasEntryIdentity } from '../model/canvasEntryIdentity.js';
import { GroupedTaskCard, TaskCard } from './TaskCards.jsx';

const CanvasNodeContent = ({ data, isPack }) => {
  const {
    entry,
    labels,
    draggedTaskId,
    isGroupDragActive,
    isFlowSelected,
    dragOverlapTargetId,
    onTaskClick,
    onGroupOpenFullView,
    onTaskPointerDown,
    onTaskPointerMove,
    onTaskPointerUp,
    onTaskPointerCancel,
  } = data;
  const dragTask = isPack
    ? { ...entry.task, groupTaskIds: entry.tasks.map((task) => task.id), groupSize: entry.tasks.length }
    : entry.task;
  const entryIdentity = getCanvasEntryIdentity(entry);
  const isGroupReady = dragOverlapTargetId === entryIdentity;
  const isDragging = isPack
    ? draggedTaskId === dragTask.id && isGroupDragActive
    : draggedTaskId === entry.task.id && !isGroupDragActive;
  return (
    <div
      id={`desktop-canvas-entry-${dragTask.id}`}
      data-desktop-entry-id={String(entryIdentity)}
      data-desktop-layout-id={`task-${dragTask.id}`}
      className="desktop-canvas-card-node"
      style={{ width: DESKTOP_CANVAS_CARD_WIDTH }}
    >
      <div className={`desktop-canvas-card-shell ${isGroupReady ? 'desktop-canvas-card-shell--group-ready' : ''} ${isDragging ? 'is-dragging' : ''}`}>
        {isPack ? (
          <GroupedTaskCard
            tasks={entry.tasks}
            labels={labels}
            isDragging={isDragging}
            isGroupDragActive={isGroupDragActive}
            isSelected={isFlowSelected}
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
          <TaskCard
            task={entry.task}
            labels={labels}
            isDragging={isDragging}
            isSelected={isFlowSelected}
            isGroupReady={isGroupReady}
            draggedTaskId={draggedTaskId}
            onClick={(event) => onTaskClick(entry.task, event)}
          />
        )}
      </div>
    </div>
  );
};

const stopHandleClick = (event) => {
  event.stopPropagation();
};

export const IntoDayTaskNode = React.memo(({ data }) => (
  <CanvasNodeContent data={data} isPack={false} />
));

IntoDayTaskNode.displayName = 'IntoDayTaskNode';

export const IntoDayPackNode = React.memo(({ data, isConnectable }) => (
  <>
    <Handle
      id="left"
      type="source"
      position={Position.Left}
      isConnectable={isConnectable}
      aria-label="Connect Left"
      title="Connect Left"
      role="button"
      tabIndex={-1}
      className="desktop-group-connector-handle is-left nodrag"
      onClick={stopHandleClick}
    />
    <CanvasNodeContent data={data} isPack />
    <Handle
      id="right"
      type="source"
      position={Position.Right}
      isConnectable={isConnectable}
      aria-label="Connect Right"
      title="Connect Right"
      role="button"
      tabIndex={-1}
      className="desktop-group-connector-handle is-right nodrag"
      onClick={stopHandleClick}
    />
  </>
));

IntoDayPackNode.displayName = 'IntoDayPackNode';
