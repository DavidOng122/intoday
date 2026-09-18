import test from 'node:test';
import assert from 'node:assert/strict';
import { getClipboardImageFile, isEditableClipboardTarget } from './clipboardUtils.js';

test('getClipboardImageFile returns the first clipboard image file', () => {
  const imageFile = { name: 'capture.png', type: 'image/png' };
  const items = [
    { type: 'text/plain', getAsFile: () => null },
    { type: 'image/png', getAsFile: () => imageFile },
  ];

  assert.equal(getClipboardImageFile(items), imageFile);
});

test('getClipboardImageFile ignores clipboard text', () => {
  assert.equal(getClipboardImageFile([{ type: 'text/plain', getAsFile: () => null }]), null);
});

test('getClipboardImageFile returns null when the image item has no file', () => {
  assert.equal(getClipboardImageFile([{ type: 'image/png', getAsFile: () => null }]), null);
});

test('isEditableClipboardTarget ignores input, textarea, and contenteditable targets', () => {
  assert.equal(isEditableClipboardTarget({ tagName: 'input' }), true);
  assert.equal(isEditableClipboardTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isEditableClipboardTarget({ isContentEditable: true }), true);
  assert.equal(isEditableClipboardTarget({ tagName: 'main' }), false);
});