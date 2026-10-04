import { DESKTOP_CANVAS_CARD_WIDTH } from '../model/canvasConstants.js';
import {
  getDesktopCanvasEntryTaskIds,
} from '../model/canvasEntries.js';

const encodeNodeIdPart = (value) => encodeURIComponent(String(value));

export const getReactFlowTaskNodeId = (taskId) => `task:${encodeNodeIdPart(taskId)}`;

export const getReactFlowPackNodeId = (groupId) => `pack:${encodeNodeIdPart(groupId)}`;

export const getPackGroupIdFromReactFlowNodeId = (nodeId) => {
  if (typeof nodeId !== 'string' || !nodeId.startsWith('pack:')) return null;

  try {
    const groupId = decodeURIComponent(nodeId.slice('pack:'.length));
    return groupId || null;
  } catch {
    return null;
  }
};

export const getSelectedTaskIdsFromReactFlowNodes = (nodes) => [...new Set(
  nodes
    .flatMap((node) => getDesktopCanvasEntryTaskIds(node.data?.entry)),
)];

export const toReactFlowNode = (entry, {
  data = {},
  measured,
  zIndex = 0,
} = {}) => {
  const isPack = entry?.type === 'group';
  const taskId = entry?.task?.id;
  const nodeId = isPack
    ? getReactFlowPackNodeId(entry.id)
    : getReactFlowTaskNodeId(taskId);
  return {
    id: nodeId,
    type: isPack ? 'intodayPack' : 'intodayTask',
    position: { x: entry.x, y: entry.y },
    measured,
    data: { entry, ...data },
    draggable: true,
    selectable: true,
    connectable: isPack,
    focusable: false,
    deletable: false,
    zIndex,
    style: {
      width: DESKTOP_CANVAS_CARD_WIDTH,
      pointerEvents: 'all',
    },
    className: 'desktop-canvas-flow-node nopan',
  };
};

export const toReactFlowEdge = (connection, data = {}) => ({
  id: connection.id,
  type: 'intodayConnection',
  source: getReactFlowPackNodeId(connection.sourceGroupId),
  sourceHandle: connection.sourceSide,
  target: getReactFlowPackNodeId(connection.targetGroupId),
  targetHandle: connection.targetSide,
  data: { connection, ...data },
  selectable: false,
  deletable: false,
  focusable: false,
  reconnectable: false,
  ariaLabel: `Connection between Packs ${connection.sourceGroupId} and ${connection.targetGroupId}`,
});

export const toReactFlowEdges = (connections, entries, data = {}) => {
  const packNodeIds = new Set(
    entries.filter((entry) => entry?.type === 'group')
      .map((entry) => getReactFlowPackNodeId(entry.id)),
  );

  return connections
    .flatMap((connection) => {
      const source = getReactFlowPackNodeId(connection.sourceGroupId);
      const target = getReactFlowPackNodeId(connection.targetGroupId);
      if (!packNodeIds.has(source) || !packNodeIds.has(target)) return [];

      return [toReactFlowEdge(connection, data)];
    });
};
