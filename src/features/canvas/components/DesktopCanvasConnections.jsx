import React, { useState } from 'react';
import { getGroupHandleCoordinates } from '../model/canvasConnections.js';
import { getDesktopCubicBezierPath } from '../model/canvasGeometry.js';

const DesktopCanvasConnections = ({
  connections = [],
  draftConnection,
  entries = [],
  getCanvasPointFromClient,
  onRemoveConnection,
  appearance,
}) => {
  const [hoveredConnId, setHoveredConnId] = useState(null);

  const entryMap = new Map();
  entries.forEach((entry) => {
    if (entry.type === 'group') {
      entryMap.set(entry.id, entry);
    }
  });

  const isDark = appearance === 'dark';
  const strokeColor = isDark ? '#60a5fa' : '#3b82f6';
  const activeGlow = isDark ? 'rgba(96, 165, 250, 0.4)' : 'rgba(59, 130, 246, 0.35)';

  return (
    <svg
      className="desktop-canvas-connections-layer"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        zIndex: 0,
      }}
    >
      <defs>
        <filter id="connection-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {connections.map((conn) => {
        const sourceEntry = entryMap.get(conn.sourceGroupId);
        const targetEntry = entryMap.get(conn.targetGroupId);
        if (!sourceEntry || !targetEntry) return null;

        const sourcePt = getGroupHandleCoordinates(sourceEntry, conn.sourceSide || 'right');
        const targetPt = getGroupHandleCoordinates(targetEntry, conn.targetSide || 'left');
        const pathData = getDesktopCubicBezierPath(sourcePt, targetPt, conn.sourceSide || 'right', conn.targetSide || 'left');
        const midPt = { x: (sourcePt.x + targetPt.x) / 2, y: (sourcePt.y + targetPt.y) / 2 };
        const isHovered = hoveredConnId === conn.id;

        return (
          <g
            key={conn.id}
            className="desktop-connection-group"
            style={{ pointerEvents: 'auto' }}
            onPointerEnter={() => setHoveredConnId(conn.id)}
            onPointerLeave={() => setHoveredConnId(null)}
          >
            {/* Invisible wide hit area for hover detection */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth="20"
              pointerEvents="stroke"
              style={{ cursor: 'pointer' }}
            />
            {/* Main visible connection curve */}
            <path
              d={pathData}
              fill="none"
              stroke={strokeColor}
              strokeWidth={isHovered ? '3.5' : '2.5'}
              strokeDasharray={isHovered ? '6 4' : 'none'}
              filter={isHovered ? 'url(#connection-glow)' : 'none'}
              style={{ transition: 'stroke-width 150ms, stroke 150ms' }}
            />
            {/* Delete handle on hover */}
            {isHovered ? (
              <g
                transform={`translate(${midPt.x}, ${midPt.y})`}
                pointerEvents="all"
                style={{ cursor: 'pointer' }}
              >
                <circle
                  r="20"
                  fill="white"
                  fillOpacity="0"
                  stroke="none"
                  pointerEvents="all"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onRemoveConnection?.(conn.id);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    onRemoveConnection?.(conn.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveConnection?.(conn.id);
                  }}
                />
                <circle r="12" fill={strokeColor} pointerEvents="none" />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="bold"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  ✕
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {/* Live draft connection line while dragging */}
      {draftConnection ? (() => {
        const sourceEntry = entryMap.get(draftConnection.sourceGroupId);
        if (!sourceEntry || !draftConnection.currentClientPt) return null;
        const sourcePt = getGroupHandleCoordinates(sourceEntry, draftConnection.sourceSide || 'right');
        const targetPt = getCanvasPointFromClient
          ? getCanvasPointFromClient(draftConnection.currentClientPt.x, draftConnection.currentClientPt.y)
          : draftConnection.currentClientPt;
        const draftPath = getDesktopCubicBezierPath(sourcePt, targetPt, draftConnection.sourceSide || 'right', 'left');

        return (
          <g className="desktop-connection-draft-group">
            <path
              d={draftPath}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeDasharray="5 5"
              opacity="0.85"
            />
            <circle cx={targetPt.x} cy={targetPt.y} r="6" fill={strokeColor} />
          </g>
        );
      })() : null}
    </svg>
  );
};

export default React.memo(DesktopCanvasConnections);
