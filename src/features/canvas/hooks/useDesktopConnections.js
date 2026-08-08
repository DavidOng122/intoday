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

  const startConnectionDrag = useCallback((groupId, side, event) => {
    if (!event.isPrimary || event.button !== 0) return;
    event.stopPropagation();

    const startPt = { x: event.clientX, y: event.clientY };
    const draft = {
      sourceGroupId: groupId,
      sourceSide: side,
      currentClientPt: startPt,
      targetGroupId: null,
      targetSide: null,
    };
    setDraftConnection(draft);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const updateConnectionDrag = useCallback((event) => {
    if (!draftRef.current) return;
    setDraftConnection((prev) => (
      prev ? { ...prev, currentClientPt: { x: event.clientX, y: event.clientY } } : null
    ));
  }, []);

  const finishConnectionDrag = useCallback((targetGroupId, targetSide, event) => {
    const draft = draftRef.current;
    if (!draft) return;
    event?.stopPropagation?.();

    if (targetGroupId && targetGroupId !== draft.sourceGroupId) {
      setConnections((prev) => {
        const exists = prev.some((conn) => (
          (conn.sourceGroupId === draft.sourceGroupId && conn.targetGroupId === targetGroupId)
          || (conn.sourceGroupId === targetGroupId && conn.targetGroupId === draft.sourceGroupId)
        ));
        if (exists) return prev;
        const newConn = createDesktopConnection({
          sourceGroupId: draft.sourceGroupId,
          sourceSide: draft.sourceSide,
          targetGroupId,
          targetSide: targetSide || (draft.sourceSide === 'right' ? 'left' : 'right'),
          dateKey,
        });
        return [...prev, newConn];
      });
    }

    setDraftConnection(null);
  }, [dateKey]);

  const removeConnection = useCallback((connectionId) => {
    setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
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
