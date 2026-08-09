import React, { useMemo, useState } from 'react';
import { getGroupHandleCoordinates } from '../model/canvasConnections.js';
import { getDesktopCubicBezierPath } from '../model/canvasGeometry.js';

const StaticConnections = React.memo(({
  appearance,
  connections,
  entries,
  onRemoveConnection,
}) => {
  const [hoveredConnectionId, setHoveredConnectionId] = useState(null);
  const entryMap = useMemo(() => new Map(
    entries.filter((entry) => entry.type === 'group').map((entry) => [entry.id, entry]),
  ), [entries]);
  const paths = useMemo(() => connections.map((connection) => {
    const sourceEntry = entryMap.get(connection.sourceGroupId);
    const targetEntry = entryMap.get(connection.targetGroupId);
    if (!sourceEntry || !targetEntry) return null;
    const sourcePoint = getGroupHandleCoordinates(sourceEntry, connection.sourceSide);
    const targetPoint = getGroupHandleCoordinates(targetEntry, connection.targetSide);
    return {
      connection,
      path: getDesktopCubicBezierPath(sourcePoint, targetPoint, connection.sourceSide, connection.targetSide),
      midpoint: { x: (sourcePoint.x + targetPoint.x) / 2, y: (sourcePoint.y + targetPoint.y) / 2 },
    };
  }).filter(Boolean), [connections, entryMap]);
  const strokeColor = appearance === 'dark' ? '#60a5fa' : '#3b82f6';

  return paths.map(({ connection, midpoint, path }) => {
    const isHovered = hoveredConnectionId === connection.id;
    return (
      <g
        key={connection.id}
        className="desktop-connection-group"
        onPointerEnter={() => setHoveredConnectionId(connection.id)}
        onPointerLeave={() => setHoveredConnectionId(null)}
      >
        <path d={path} fill="none" stroke="transparent" strokeWidth="20" pointerEvents="stroke" />
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={isHovered ? 3.5 : 2.5}
          strokeDasharray={isHovered ? '6 4' : undefined}
          pointerEvents="none"
        />
        {isHovered ? (
          <g
            aria-label="Delete connection"
            role="button"
            tabIndex="0"
            transform={`translate(${midpoint.x}, ${midpoint.y})`}
            pointerEvents="all"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemoveConnection?.(connection.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onRemoveConnection?.(connection.id);
            }}
          >
            <circle r="20" fill="transparent" />
            <circle r="12" fill={strokeColor} pointerEvents="none" />
            <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold" pointerEvents="none">×</text>
          </g>
        ) : null}
      </g>
    );
  });
});

StaticConnections.displayName = 'StaticConnections';

const DraftConnection = React.memo(({
  appearance,
  draftConnection,
  entries,
  getCanvasPointFromClient,
}) => {
  if (!draftConnection?.currentClientPt) return null;
  const sourceEntry = entries.find((entry) => entry.type === 'group' && entry.id === draftConnection.sourceGroupId);
  if (!sourceEntry) return null;
  const sourcePoint = getGroupHandleCoordinates(sourceEntry, draftConnection.sourceSide);
  const targetPoint = getCanvasPointFromClient?.(
    draftConnection.currentClientPt.x,
    draftConnection.currentClientPt.y,
  );
  if (!targetPoint) return null;
  const strokeColor = appearance === 'dark' ? '#60a5fa' : '#3b82f6';
  const path = getDesktopCubicBezierPath(sourcePoint, targetPoint, draftConnection.sourceSide, 'left');
  return (
    <g className="desktop-connection-draft-group">
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeDasharray="5 5" opacity="0.85" />
      <circle cx={targetPoint.x} cy={targetPoint.y} r="6" fill={strokeColor} />
    </g>
  );
});

DraftConnection.displayName = 'DraftConnection';

const DesktopCanvasConnections = (props) => (
  <svg
    className="desktop-canvas-connections-layer"
    aria-hidden={props.connections.length === 0 && !props.draftConnection}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
  >
    <StaticConnections {...props} />
    <DraftConnection {...props} />
  </svg>
);

export default React.memo(DesktopCanvasConnections);
