import React from 'react';

const DesktopGroupPrompt = ({ prompt, groupName, setGroupName, onConfirm, onCancel }) => {
  if (!prompt) return null;

  const panelWidth = 320;
  const left = Math.min(Math.max(24, prompt.anchorX - (panelWidth / 2)), window.innerWidth - panelWidth - 24);
  const top = Math.min(Math.max(96, prompt.anchorY + 18), window.innerHeight - 220);

  return (
    <div role="presentation" onClick={onCancel} className="desktop-group-prompt-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desktop-group-prompt-title"
        onClick={(event) => event.stopPropagation()}
        className="desktop-group-prompt-panel"
        style={{ left, top, width: 360 }}
      >
        <div className="desktop-group-prompt-eyebrow">
          <span className="desktop-group-prompt-eyebrow-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" style={{ width: 14, height: 14 }}>
              <path d="M6.167 5.5H4.833a2.333 2.333 0 0 0 0 4.667h1.334M9.833 5.5h1.334a2.333 2.333 0 0 1 0 4.667H9.833M5.667 8h4.666" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Merge into group</span>
        </div>
        <input
          type="text"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onConfirm();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
          autoFocus
          placeholder="Group title"
          className="desktop-group-prompt-input"
        />
        <div className="desktop-group-prompt-actions">
          <button type="button" onClick={onCancel} className="desktop-group-prompt-secondary">
            Keep separate
          </button>
          <button type="button" onClick={onConfirm} className="desktop-group-prompt-primary">
            Group items <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesktopGroupPrompt;
