import {
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_CANVAS_TOP_PADDING,
  DesktopCanvas,
  GroupedTaskCard,
  TaskCard,
} from '../../features/canvas';

function DesktopCanvasArea({
  appearance,
  canvasBounds,
  connections,
  desktopDragOverlapTargetId,
  desktopDragOverlayActive,
  desktopDragOverlayNodeRef,
  desktopDragOverlaySnapshot,
  desktopSelectionRect,
  draftConnection,
  dragSession,
  draggedTaskId,
  getCanvasPointFromClient,
  handleCanvasFileDragEnter,
  handleCanvasFileDragLeave,
  handleCanvasFileDragOver,
  handleCanvasFileDrop,
  handleDesktopCanvasPointerDown,
  handleDesktopCanvasPointerEnd,
  handleDesktopCanvasPointerMove,
  handleGroupCardOpen,
  handleTaskClick,
  handleTaskPointerCancel,
  handleTaskPointerDown,
  handleTaskPointerMove,
  handleTaskPointerUp,
  isCanvasFileDragActive,
  isGroupDragActive,
  removeConnection,
  selectedDayEntries,
  selectedTaskIds,
  startConnectionDrag,
  t,
  viewport,
  viewportContainerRef,
}) {
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
            onPointerDownCapture={handleDesktopCanvasPointerDown}
            onPointerMove={(event) => {
              handleDesktopCanvasPointerMove(event);
            }}
            onPointerUp={(event) => {
              handleDesktopCanvasPointerEnd(event);
            }}
            onPointerCancel={handleDesktopCanvasPointerEnd}
            onDragEnter={handleCanvasFileDragEnter}
            onDragOver={handleCanvasFileDragOver}
            onDragLeave={handleCanvasFileDragLeave}
            onDrop={handleCanvasFileDrop}
            style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', background: 'var(--desktop-root-bg)' }}
          >
            <div
              className="desktop-canvas-content"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: canvasBounds.width,
                transformOrigin: '0 0',
                transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
                paddingTop: DESKTOP_CANVAS_TOP_PADDING,
              }}
            >
              <DesktopCanvas
                entries={selectedDayEntries}
                canvasHeight={canvasBounds.height}
                appearance={appearance}
                labels={t}
                onTaskClick={handleTaskClick}
                onGroupOpenFullView={handleGroupCardOpen}
                onTaskPointerDown={handleTaskPointerDown}
                onTaskPointerMove={handleTaskPointerMove}
                onTaskPointerUp={handleTaskPointerUp}
                onTaskPointerCancel={handleTaskPointerCancel}
                draggedTaskId={draggedTaskId}
                isGroupDragActive={isGroupDragActive}
                dragSession={dragSession}
                selectedTaskIds={selectedTaskIds}
                selectionRect={desktopSelectionRect}
                dragOverlapTargetId={desktopDragOverlapTargetId}
                TaskCardComponent={TaskCard}
                GroupedTaskCardComponent={GroupedTaskCard}
                layoutWidth={canvasBounds.width}
                connections={connections}
                draftConnection={draftConnection}
                getCanvasPointFromClient={getCanvasPointFromClient}
                onStartConnectionDrag={startConnectionDrag}
                onRemoveConnection={removeConnection}
              />
              {desktopDragOverlayActive && desktopDragOverlaySnapshot ? (
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
                          appearance={appearance}
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
                          appearance={appearance}
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
              ) : null}
              {isCanvasFileDragActive ? (
                <div className="desktop-canvas-file-drop-indicator">
                  <span>{draggedTaskId ? 'Drop to place task' : 'Drop file to create card'}</span>
                </div>
              ) : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default DesktopCanvasArea;
