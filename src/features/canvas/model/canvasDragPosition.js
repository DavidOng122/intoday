import {
  DESKTOP_CANVAS_CARD_HEIGHT,
  DESKTOP_CANVAS_CARD_WIDTH,
  DESKTOP_MAIN_CONTENT_MAX_WIDTH,
} from './canvasConstants.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const getClampedCanvasDragPosition = ({
  rawPosition,
  anchorPosition,
  originPositions,
  canvasBounds,
  height = DESKTOP_CANVAS_CARD_HEIGHT,
}) => {
  const positions = originPositions.length > 0 ? originPositions : [anchorPosition];
  const rawDelta = {
    x: rawPosition.x - anchorPosition.x,
    y: rawPosition.y - anchorPosition.y,
  };
  const minX = Math.min(...positions.map((position) => position.x));
  const maxX = Math.max(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxY = Math.max(...positions.map((position) => position.y));
  const canvasMaxX = Math.max(0, (canvasBounds?.width || DESKTOP_MAIN_CONTENT_MAX_WIDTH) - DESKTOP_CANVAS_CARD_WIDTH);
  const canvasMaxY = Math.max(0, (canvasBounds?.height || height) - height);
  const delta = {
    x: clamp(rawDelta.x, -minX, canvasMaxX - maxX),
    y: clamp(rawDelta.y, -minY, canvasMaxY - maxY),
  };

  return {
    position: {
      x: clamp(anchorPosition.x + delta.x, 0, canvasMaxX),
      y: clamp(anchorPosition.y + delta.y, 0, canvasMaxY),
    },
    delta,
  };
};
