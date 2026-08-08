import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadDesktopConnections,
  saveDesktopConnections,
  createDesktopConnection,
} from '../model/canvasConnections.js';

export const useDesktopConnections = ({ dateKey }) => {
  const [connections, setConnections] = useState(() => loadDesktopConnections());
  const [draftConnection, setDraftConnection] = useState(null);
  const draftRef = useRef(null);
  draftRef.current = draftConnection;

  useEffect(() => {
    saveDesktopConnections(connections);
  }, [connections]);

  const removeConnection = useCallback((connectionId) => {
    setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
  }, []);

  const findGroupHandleAtPoint = useCallback((clientX, clientY) => {
    const targetElem = document.elementFromPoint(clientX, clientY);
    const targetHandle = targetElem?.closest('.desktop-group-connector-handle');
    if (targetHandle) {
      return {
        targetGroupId: targetHandle.getAttribute('data-group-id'),
        targetSide: targetHandle.getAttribute('data-connector-side') || 'left',
      };
    }

    const edgeThreshold = 24;
    const verticalMargin = 18;
    const groupNodes = Array.from(document.querySelectorAll('.desktop-canvas-card-node'));
    for (const node of groupNodes) {
      if (!node.querySelector('.desktop-group-connector-handle')) continue;
      const rect = node.getBoundingClientRect();
      if (clientY < rect.top - verticalMargin || clientY > rect.bottom + verticalMargin) continue;

      const leftDistance = Math.abs(clientX - rect.left);
      const rightDistance = Math.abs(clientX - rect.right);
      if (leftDistance <= edgeThreshold || rightDistance <= edgeThreshold) {
        return {
          targetGroupId: node.getAttribute('data-desktop-entry-id'),
          targetSide: leftDistance <= rightDistance ? 'left' : 'right',
        };
      }
    }

    return null;
  }, []);

  const finishConnectionDrag = useCallback((targetGroupId, targetSide, event) => {
    if (!draftRef.current) {
      setDraftConnection(null);
      return;
    }

    const sourceGroupId = draftRef.current.sourceGroupId;
    const sourceSide = draftRef.current.sourceSide || 'right';

    const upEvt = event;
    let resolvedTargetGroupId = targetGroupId;
    let resolvedTargetSide = targetSide;

    if (!resolvedTargetGroupId && upEvt) {
      const result = findGroupHandleAtPoint(upEvt.clientX, upEvt.clientY);
      if (result) {
        resolvedTargetGroupId = result.targetGroupId;
        resolvedTargetSide = result.targetSide;
      }
    }

    if (resolvedTargetGroupId && resolvedTargetGroupId !== sourceGroupId) {
      setConnections((prev) => {
        const exists = prev.some((conn) => (
          (conn.sourceGroupId === sourceGroupId && conn.targetGroupId === resolvedTargetGroupId)
          || (conn.sourceGroupId === resolvedTargetGroupId && conn.targetGroupId === sourceGroupId)
        ));
        if (exists) return prev;

        const newConn = createDesktopConnection({
          sourceGroupId,
          sourceSide,
          targetGroupId: resolvedTargetGroupId,
          targetSide: resolvedTargetSide || 'left',
          dateKey,
        });
        return [...prev, newConn];
      });
    }

    draftRef.current = null;
    setDraftConnection(null);
  }, [dateKey]);

  const startConnectionDrag = useCallback((groupId, side, event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget?.setPointerCapture?.(event.pointerId);

    const startPt = { x: event.clientX, y: event.clientY };
    const draft = {
      sourceGroupId: groupId,
      sourceSide: side,
      currentClientPt: startPt,
    };
    draftRef.current = draft;
    setDraftConnection(draft);

    const handlePointerMove = (moveEvt) => {
      setDraftConnection((prev) => (
        prev ? { ...prev, currentClientPt: { x: moveEvt.clientX, y: moveEvt.clientY } } : null
      ));
    };

    const handlePointerUp = (upEvt) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      finishConnectionDrag(null, null, upEvt);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [finishConnectionDrag]);

  const updateConnectionDrag = useCallback((event) => {
    if (!draftRef.current) return;
    setDraftConnection((prev) => (
      prev ? { ...prev, currentClientPt: { x: event.clientX, y: event.clientY } } : null
    ));
  }, []);

  return {
    connections,
    draftConnection,
    startConnectionDrag,
    updateConnectionDrag,
    finishConnectionDrag,
    removeConnection,
  };
};
