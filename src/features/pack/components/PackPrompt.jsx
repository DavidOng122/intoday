import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { getDesktopPortalContainer } from '../../../shared/ui/desktopPortal';

const DesktopGroupPrompt = ({ prompt, groupName, setGroupName, onConfirm, onCancel }) => {
  if (!prompt) return null;

  const panelWidth = 360;
  const left = Math.min(Math.max(24, prompt.anchorX - (panelWidth / 2)), window.innerWidth - panelWidth - 24);
  const top = Math.min(Math.max(96, prompt.anchorY + 18), window.innerHeight - 220);
  const isMergePacks = prompt.mode === 'merge-packs';

  return (
    <Dialog.Root
      open={Boolean(prompt)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel?.();
      }}
    >
      <Dialog.Portal container={getDesktopPortalContainer()}>
        <Dialog.Overlay className="desktop-group-prompt-backdrop" />
        <Dialog.Content
          className="desktop-group-prompt-panel"
          style={{ left, top, width: panelWidth }}
        >
        <div className="desktop-group-prompt-eyebrow">
          <span className="desktop-group-prompt-eyebrow-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
              <path d="M6.167 5.5H4.833a2.333 2.333 0 0 0 0 4.667h1.334M9.833 5.5h1.334a2.333 2.333 0 0 1 0 4.667H9.833M5.667 8h4.666" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <Dialog.Title asChild>
            <span>
              {isMergePacks ? `Merge into “${prompt.targetGroupName || 'Group'}”?` : 'Merge into group'}
            </span>
          </Dialog.Title>
        </div>
        {!isMergePacks && (
          <input
            type="text"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onConfirm();
              }
            }}
            autoFocus
            placeholder="Group title"
            className="desktop-group-prompt-input"
          />
        )}
        <div className="desktop-group-prompt-actions">
          <Dialog.Close asChild>
            <button type="button" className="desktop-group-prompt-secondary">Keep separate</button>
          </Dialog.Close>
          <button type="button" onClick={onConfirm} className="desktop-group-prompt-primary">
            {isMergePacks ? 'Merge packs' : <>Group items <span aria-hidden="true">→</span></>}
          </button>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default DesktopGroupPrompt;
