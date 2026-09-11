import { findDesktopDragOverlap } from './canvasGeometry.js';

// Collision selection is intentionally pure: DOM measurement is supplied by the
// caller, while this module owns the candidate/threshold decision.
export const findCanvasCollisionTarget = ({ movingRect, candidates, movingTaskIds, threshold }) => (
  findDesktopDragOverlap({ movingRect, candidates, movingTaskIds, threshold })
);
