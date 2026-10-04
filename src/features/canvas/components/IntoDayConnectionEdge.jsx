import React, { useEffect, useRef, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
} from '@xyflow/react';

export const IntoDayConnectionLine = ({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
}) => {
  const isInvalid = connectionStatus === 'invalid';
  const strokeColor = isInvalid
    ? '#ef4444'
    : connectionStatus === 'valid'
      ? '#16a34a'
      : '#3b82f6';
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  return (
    <g className="desktop-connection-draft-group">
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isInvalid ? 3 : 2.5}
        strokeDasharray={isInvalid ? '4 4' : '5 5'}
        opacity="0.9"
      />
      <circle cx={toX} cy={toY} r="6" fill={strokeColor} />
    </g>
  );
};

IntoDayConnectionLine.displayName = 'IntoDayConnectionLine';

export const IntoDayConnectionEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hideTimerRef = useRef(null);
  const connection = data?.connection;
  const [path, midpointX, midpointY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  useEffect(() => () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
  }, []);

  const showDeleteControl = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const scheduleHideDeleteControl = () => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      setIsHovered(false);
    }, 120);
  };

  const handleEdgeMouseLeave = (event) => {
    if (
      event.relatedTarget instanceof Element
      && event.relatedTarget.closest('.desktop-connection-delete-control')
    ) return;
    scheduleHideDeleteControl();
  };

  return (
    <>
      <g onMouseEnter={showDeleteControl} onMouseLeave={handleEdgeMouseLeave}>
        <BaseEdge
          id={id}
          path={path}
          interactionWidth={20}
          className={`desktop-connection-edge-path ${isHovered ? 'is-hovered' : ''}`}
          style={{
            stroke: '#3b82f6',
            strokeWidth: isHovered ? 3.5 : 2.5,
            strokeDasharray: isHovered ? '6 4' : undefined,
          }}
        />
      </g>
      <EdgeLabelRenderer>
        {isHovered ? (
          <button
            type="button"
            className="desktop-connection-delete-control nodrag nopan"
            style={{
              position: 'absolute',
              left: midpointX,
              top: midpointY,
              pointerEvents: 'all',
            }}
            aria-label="Delete connection"
            title="Delete connection"
            onPointerEnter={showDeleteControl}
            onPointerLeave={scheduleHideDeleteControl}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.stopPropagation();
              data?.onRemoveConnection?.(connection?.id || id);
            }}
          >
            ×
          </button>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
};

IntoDayConnectionEdge.displayName = 'IntoDayConnectionEdge';
