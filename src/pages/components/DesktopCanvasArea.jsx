import {
  DESKTOP_CANVAS_CARD_WIDTH,
  DesktopCanvas,
  GroupedTaskCard,
  TaskCard,
} from '../../features/canvas';

function DesktopCanvasArea({
  canvasBounds,
  canvasViewportSize,
  connections,
  desktopDragOverlapTargetId,
  desktopDragOverlayActive,
  desktopDragOverlayNodeRef,
  desktopDragOverlaySnapshot,
  flowInstanceRef,
  dragSession,
  draggedTaskId,
  handleCanvasFileDragEnter,
  handleCanvasFileDragLeave,
  handleCanvasFileDragOver,
  handleCanvasFileDrop,
  handleGroupCardOpen,
  handleTaskClick,
  handleTaskPointerCancel,
  handleTaskPointerDown,
  handleTaskPointerMove,
  handleTaskPointerUp,
  handleFlowNodeDragStart,
  handleFlowNodeDrag,
  handleFlowNodeDragStop,
  handleSelectionChange,
  isCanvasFileDragActive,
  isGroupDragActive,
  removeConnection,
  canvasEntries,
  selectedTaskIds,
  createConnectionFromFlow,
  isValidConnection,
  t,
  viewportContainerRef,
}) {
  const dragOverlay = desktopDragOverlayActive && desktopDragOverlaySnapshot ? (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <div
        ref={desktopDragOverlayNodeRef}
        className="desktop-canvas-card-node"
        style={{
          left: dragSession?.previewPositions?.[desktopDragOverlaySnapshot.taskId]?.x ?? desktopDragOverlaySnapshot.baseX,
          top: dragSession?.previewPositions?.[desktopDragOverlaySnapshot.taskId]?.y ?? desktopDragOverlaySnapshot.baseY,
          width: DESKTOP_CANVAS_CARD_WIDTH,
        }}
      >
        <div className="desktop-canvas-card-shell is-dragging">
          {desktopDragOverlaySnapshot.type === 'group' && Array.isArray(desktopDragOverlaySnapshot.tasks) ? (
            <GroupedTaskCard
              tasks={desktopDragOverlaySnapshot.tasks}
              labels={t}
              isDragging={true}
              isGroupDragActive={true}
              isSelected={false}
              isGroupReady={false}
              draggedTaskId={desktopDragOverlaySnapshot.taskId}
              onOpenItem={null}
              onOpenFullView={null}
              onPointerDown={null}
              onPointerMove={null}
              onPointerUp={null}
              onPointerCancel={null}
            />
          ) : desktopDragOverlaySnapshot.type === 'task' && desktopDragOverlaySnapshot.task ? (
            <TaskCard
              task={desktopDragOverlaySnapshot.task}
              labels={t}
              isDragging={true}
              isSelected={false}
              isGroupReady={false}
              draggedTaskId={desktopDragOverlaySnapshot.taskId}
              onClick={null}
              onPointerDown={null}
              onPointerMove={null}
              onPointerUp={null}
              onPointerCancel={null}
            />
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div
        className="desktop-main-stage"
        style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative', overflow: 'hidden' }}
      >
        <div className="desktop-main-stage-inner" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--desktop-main-gradient)' }}>

          <main
            ref={viewportContainerRef}
            className={`desktop-canvas-scroll ${isCanvasFileDragActive ? 'is-file-drag-active' : ''}`}
            onDragEnter={handleCanvasFileDragEnter}
            onDragOver={handleCanvasFileDragOver}
            onDragLeave={handleCanvasFileDragLeave}
            onDrop={handleCanvasFileDrop}
            style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', background: 'var(--desktop-root-bg)' }}
          >
            <DesktopCanvas
              entries={canvasEntries}
              canvasHeight={canvasBounds.height}
              canvasViewportSize={canvasViewportSize}
              dragOverlay={dragOverlay}
              flowInstanceRef={flowInstanceRef}
              labels={t}
              onTaskClick={handleTaskClick}
              onGroupOpenFullView={handleGroupCardOpen}
              onTaskPointerDown={handleTaskPointerDown}
              onTaskPointerMove={handleTaskPointerMove}
              onTaskPointerUp={handleTaskPointerUp}
              onTaskPointerCancel={handleTaskPointerCancel}
              onFlowNodeDragStart={handleFlowNodeDragStart}
              onFlowNodeDrag={handleFlowNodeDrag}
              onFlowNodeDragStop={handleFlowNodeDragStop}
              draggedTaskId={draggedTaskId}
              isGroupDragActive={isGroupDragActive}
              selectedTaskIds={selectedTaskIds}
              onSelectionChange={handleSelectionChange}
              dragOverlapTargetId={desktopDragOverlapTargetId}
              layoutWidth={canvasBounds.width}
              connections={connections}
              onCreateConnection={createConnectionFromFlow}
              isValidConnection={isValidConnection}
              onRemoveConnection={removeConnection}
            />
            {isCanvasFileDragActive ? (
              <div className="desktop-canvas-file-drop-indicator">
                <span>{draggedTaskId ? 'Drop to place task' : 'Drop file to create card'}</span>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}

export default DesktopCanvasArea;
