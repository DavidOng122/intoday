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

  const startConnectionDrag = useCallback((groupId, side, event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();

    const startPt = { x: event.clientX, y: event.clientY };
    const draft = {
      sourceGroupId: groupId,
      sourceSide: side,
      currentClientPt: startPt,
    };
    setDraftConnection(draft);

    const handlePointerMove = (moveEvt) => {
      setDraftConnection((prev) => (
        prev ? { ...prev, currentClientPt: { x: moveEvt.clientX, y: moveEvt.clientY } } : null
      ));
    };

    const handlePointerUp = (upEvt) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      const targetElem = document.elementFromPoint(upEvt.clientX, upEvt.clientY);
      const targetHandle = targetElem?.closest('.desktop-group-connector-handle');
      if (targetHandle) {
        const targetGroupId = targetHandle.getAttribute('data-group-id');
        const targetSide = targetHandle.getAttribute('data-connector-side') || 'left';

        if (targetGroupId && targetGroupId !== groupId) {
          setConnections((prev) => {
            const exists = prev.some((conn) => (
              (conn.sourceGroupId === groupId && conn.targetGroupId === targetGroupId)
              || (conn.sourceGroupId === targetGroupId && conn.targetGroupId === groupId)
            ));
            if (exists) return prev;

            const newConn = createDesktopConnection({
              sourceGroupId: groupId,
              sourceSide: side,
              targetGroupId,
              targetSide,
              dateKey,
            });
            return [...prev, newConn];
          });
        }
      }

      setDraftConnection(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [dateKey]);

  return {
    connections,
    draftConnection,
    startConnectionDrag,
    removeConnection,
  };
};
