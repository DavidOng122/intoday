import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  applyNodeChanges,
  ConnectionMode,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  ViewportPortal,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { DESKTOP_APP_WINDOW_SCALE } from '../../../shared/config/viewportConstants.js';
import {
  DESKTOP_DRAG_START_DISTANCE,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_CANVAS_TOP_PADDING,
  DESKTOP_MAIN_CONTENT_MAX_WIDTH,
} from '../model/canvasConstants.js';
import { getDesktopCanvasEntryHeight } from '../model/canvasEntries.js';
import {
  filterCanvasFlowDragChanges,
} from '../model/canvasFlowDrag.js';
import {
  getReactFlowPackNodeId,
  getReactFlowTaskNodeId,
  getSelectedTaskIdsFromReactFlowNodes,
  toReactFlowEdges,
  toReactFlowNode,
} from '../adapters/reactFlowAdapter.js';
import { IntoDayConnectionLine } from './IntoDayConnectionEdge.jsx';
import { reactFlowEdgeTypes } from './reactFlowEdgeTypes.js';
import { reactFlowNodeTypes } from './reactFlowNodeTypes.js';

const handleFlowEdgeClick = (event) => {
  event.stopPropagation();
};

const DesktopCanvasFlow = ({
  entries,
  canvasHeight,
  canvasViewportSize,
  dragOverlay,
  flowInstanceRef,
  labels,
  onTaskClick,
  onGroupOpenFullView,
  onTaskPointerDown,
  onTaskPointerMove,
  onTaskPointerUp,
  onTaskPointerCancel,
  onFlowNodeDragStart,
  onFlowNodeDrag,
  onFlowNodeDragStop,
  draggedTaskId,
  isGroupDragActive,
  onSelectionChange,
  dragOverlapTargetId,
  layoutWidth = DESKTOP_MAIN_CONTENT_MAX_WIDTH,
  connections = [],
  onCreateConnection,
  isValidConnection,
  onRemoveConnection,
}) => {
  const reactFlow = useReactFlow();
  const projectedNodes = useMemo(() => entries.map((entry, index) => {
    const id = entry.type === 'group'
      ? getReactFlowPackNodeId(entry.id)
      : getReactFlowTaskNodeId(entry.task.id);
    const existingMeasurement = reactFlow.getInternalNode(id)?.measured;
    const measured = existingMeasurement?.width > 0 && existingMeasurement?.height > 0
      ? existingMeasurement
      : {
        width: DESKTOP_CANVAS_CARD_WIDTH,
        height: getDesktopCanvasEntryHeight(entry),
      };
    const nodeData = {
      labels,
      draggedTaskId,
      isGroupDragActive,
      dragOverlapTargetId,
      onTaskClick,
      onGroupOpenFullView,
      onTaskPointerDown,
      onTaskPointerMove,
      onTaskPointerUp,
      onTaskPointerCancel,
    };

    return toReactFlowNode(entry, {
      data: nodeData,
      measured,
      zIndex: index,
    });
  }), [
    draggedTaskId,
    dragOverlapTargetId,
    entries,
    isGroupDragActive,
    labels,
    onGroupOpenFullView,
    onTaskClick,
    onTaskPointerCancel,
    onTaskPointerDown,
    onTaskPointerMove,
    onTaskPointerUp,
    reactFlow,
  ]);
  const [nodes, setNodes] = useNodesState(projectedNodes);
  const domainPositionsRef = useRef(new Map());
  const activeNodeDragIdRef = useRef(null);

  useEffect(() => {
    const nextDomainPositions = new Map(projectedNodes.map((node) => [
      node.id,
      node.position,
    ]));
    setNodes((currentNodes) => {
      const currentById = new Map(currentNodes.map((node) => [node.id, node]));
      return projectedNodes.map((node) => {
        const previous = currentById.get(node.id);
        const previousDomainPosition = domainPositionsRef.current.get(node.id);
        const domainPositionChanged = !previousDomainPosition
          || previousDomainPosition.x !== node.position.x
          || previousDomainPosition.y !== node.position.y;
        return {
          ...node,
          selected: previous?.selected ?? false,
          position: previous && !domainPositionChanged
            ? previous.position
            : node.position,
        };
      });
    });
    domainPositionsRef.current = nextDomainPositions;
  }, [projectedNodes, setNodes]);

  const handleNodeDragStart = useCallback((event, node) => {
    activeNodeDragIdRef.current = node.id;
    onFlowNodeDragStart?.(event, node);
  }, [onFlowNodeDragStart]);
  const handleNodeDrag = useCallback((event, node) => {
    onFlowNodeDrag?.(event, node);
  }, [onFlowNodeDrag]);
  const handleNodeDragStop = useCallback((event, node) => {
    try {
      onFlowNodeDragStop?.(event, node);
    } finally {
      activeNodeDragIdRef.current = null;
    }
  }, [onFlowNodeDragStop]);
  const handleNodesChange = useCallback((changes) => {
    setNodes((currentNodes) => applyNodeChanges(
      filterCanvasFlowDragChanges(changes, activeNodeDragIdRef.current),
      currentNodes,
    ));
  }, [setNodes]);

  const edges = useMemo(() => toReactFlowEdges(connections, entries, {
    onRemoveConnection,
  }), [connections, entries, onRemoveConnection]);
  const connectionLineComponent = useMemo(() => {
    const FlowConnectionLine = (lineProps) => (
      <IntoDayConnectionLine
        {...lineProps}
      />
    );
    return FlowConnectionLine;
  }, []);

  const handleFlowInit = useCallback((instance) => {
    if (flowInstanceRef) flowInstanceRef.current = instance;
  }, [flowInstanceRef]);

  useEffect(() => () => {
    if (flowInstanceRef) flowInstanceRef.current = null;
  }, [flowInstanceRef]);

  const handleConnect = useCallback((connection) => {
    onCreateConnection?.(connection);
  }, [onCreateConnection]);
  const handleFlowSelectionChange = useCallback(({ nodes: selectedNodes }) => {
    onSelectionChange?.(getSelectedTaskIdsFromReactFlowNodes(selectedNodes));
  }, [onSelectionChange]);

  return (
    <div
      className="desktop-canvas-flow"
      style={{
        position: 'absolute',
        left: 0,
        top: DESKTOP_CANVAS_TOP_PADDING,
        width: canvasViewportSize.width,
        height: canvasViewportSize.height,
        transform: `scale(${1 / DESKTOP_APP_WINDOW_SCALE})`,
        transformOrigin: '0 0',
        zIndex: 1,
      }}
    >
      <ReactFlow
        onInit={handleFlowInit}
        aria-label="IntoDay Canvas"
        className="desktop-canvas-react-flow"
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onSelectionChange={handleFlowSelectionChange}
        nodeTypes={reactFlowNodeTypes}
        edgeTypes={reactFlowEdgeTypes}
        nodeOrigin={[0, 0]}
        nodeExtent={[[0, 0], [layoutWidth, canvasHeight]]}
        nodeDragThreshold={DESKTOP_DRAG_START_DISTANCE}
        defaultViewport={{ x: 0, y: 0, zoom: DESKTOP_APP_WINDOW_SCALE }}
        minZoom={0.5}
        maxZoom={1.5}
        fitView={false}
        translateExtent={[[0, 0], [layoutWidth, canvasHeight]]}
        nodesDraggable
        nodesConnectable
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable
        elevateNodesOnSelect={false}
        selectNodesOnDrag={false}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        selectionKeyCode={null}
        multiSelectionKeyCode={['Meta', 'Control']}
        panOnDrag={[1]}
        panOnScroll={false}
        zoomOnScroll
        zoomActivationKeyCode="Control"
        zoomOnPinch
        zoomOnDoubleClick={false}
        autoPanOnConnect={false}
        autoPanOnNodeDrag={false}
        autoPanOnNodeFocus={false}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={30}
        connectionLineComponent={connectionLineComponent}
        isValidConnection={isValidConnection}
        onConnect={handleConnect}
        onNodeDragStart={handleNodeDragStart}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onEdgeClick={handleFlowEdgeClick}
        deleteKeyCode={null}
      />
      <ViewportPortal>
        {entries.length === 0 ? (
          <div
            aria-hidden="true"
            className="desktop-canvas-empty-state"
            style={{
              width: layoutWidth,
              height: 220,
              borderRadius: 28,
              border: '1px dashed var(--desktop-divider)',
              background: 'var(--desktop-section-bg)',
            }}
          />
        ) : null}
        {dragOverlay}
      </ViewportPortal>
    </div>
  );
};

const DesktopCanvas = (props) => (
  <ReactFlowProvider>
    <DesktopCanvasFlow {...props} />
  </ReactFlowProvider>
);

export default React.memo(DesktopCanvas);
