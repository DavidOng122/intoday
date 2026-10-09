import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';

const buttonStyle = {
  border: '1px solid #d6d3d1',
  borderRadius: 8,
  padding: '9px 12px',
  background: '#fff',
  color: '#292524',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};

const TaskSyncConflictDialog = ({ activeWorkspaceId, conflict, onResolve, workspaces = [] }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [targetWorkspaceId, setTargetWorkspaceId] = useState(
    activeWorkspaceId || workspaces[0]?.id || '',
  );

  if (!conflict) return null;

  const resolve = async (choice) => {
    setBusy(true);
    setError('');
    try {
      const freshId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      await onResolve(conflict.todoId, choice, freshId, targetWorkspaceId);
    } catch (resolveError) {
      setError(resolveError?.message || 'Unable to resolve this Task conflict.');
      setBusy(false);
    }
  };
  const localLabel = conflict.localTodo?.title || conflict.localTodo?.text || 'your unsaved version';
  const serverLabel = conflict.currentTodo?.title || conflict.currentTodo?.text || 'the server version';

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal container={getDesktopPortalContainer()}>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120000,
            background: 'rgba(15, 23, 42, 0.55)',
          }}
        />
        <Dialog.Content
          aria-describedby={`task-sync-conflict-description-${conflict.todoId}`}
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          style={{
            position: 'fixed',
            zIndex: 120001,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(440px, calc(100vw - 32px))',
            borderRadius: 16,
            padding: 24,
            background: '#fff',
            color: '#292524',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            outline: 'none',
          }}
        >
          <Dialog.Title style={{ margin: '0 0 10px', fontSize: 19 }}>
            {conflict.workspaceInvalid
              ? 'Workspace no longer available'
              : conflict.deleted
                ? 'Task deleted on another device'
                : 'Task changed on another device'}
          </Dialog.Title>
          <Dialog.Description
            id={`task-sync-conflict-description-${conflict.todoId}`}
            style={{ margin: '0 0 16px', color: '#57534e', fontSize: 14, lineHeight: 1.5 }}
          >
            {conflict.workspaceInvalid
              ? 'Your Task draft is preserved. Choose an active Workspace to save it as a new Task.'
              : `Your unsaved changes are preserved. Choose how to resolve Task ${conflict.todoId}.`}
          </Dialog.Description>
          <div style={{ display: 'grid', gap: 8, marginBottom: 16, fontSize: 13 }}>
            {conflict.localTodo ? <div><strong>Local:</strong> {localLabel}</div> : null}
            {conflict.currentTodo
              ? <div><strong>Server:</strong> {serverLabel}</div>
              : conflict.workspaceInvalid
                ? <div><strong>Workspace:</strong> unavailable</div>
                : <div><strong>Server:</strong> deleted</div>}
          </div>
          {error ? <p role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{error}</p> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
            {conflict.currentTodo && conflict.deleteRequested ? (
              <button type="button" disabled={busy} style={buttonStyle} onClick={() => void resolve('delete')}>
                Delete using current version
              </button>
            ) : null}
            {conflict.currentTodo && conflict.localTodo && !conflict.deleteRequested ? (
              <button type="button" disabled={busy} style={buttonStyle} onClick={() => void resolve('local')}>
                Keep my version
              </button>
            ) : null}
            {!conflict.currentTodo && conflict.localTodo ? (
              <>
                <label style={{ display: 'grid', gap: 5, width: '100%', marginBottom: 8, fontSize: 13 }}>
                  Save in Workspace
                  <select
                    value={targetWorkspaceId}
                    onChange={(event) => setTargetWorkspaceId(event.target.value)}
                    disabled={busy || workspaces.length === 0}
                    style={{ padding: 8, borderRadius: 6 }}
                  >
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !workspaces.some((workspace) => workspace.id === targetWorkspaceId)}
                  style={buttonStyle}
                  onClick={() => void resolve('save_as_new')}
                >
                  Save as new Task
                </button>
              </>
            ) : null}
            {!conflict.workspaceInvalid ? (
              <button type="button" disabled={busy} style={buttonStyle} onClick={() => void resolve('server')}>
                {conflict.currentTodo ? 'Use server version' : 'Acknowledge deletion'}
              </button>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default TaskSyncConflictDialog;
