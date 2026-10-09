import test from 'node:test';
import assert from 'node:assert/strict';
import { getClipboardImageFile, isEditableClipboardTarget } from './clipboardUtils.js';
import { createUploadedFileStorageKey } from './uploadUtils.js';
import { createUploadedFilePath } from './uploadStorage.js';

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

test('uploaded file keys are scoped by account', () => {
  const firstAccountKey = createUploadedFileStorageKey('report.pdf', 'account-1');
  const secondAccountKey = createUploadedFileStorageKey('report.pdf', 'account-2');

  assert.match(firstAccountKey, /^upload:account-1:/);
  assert.match(secondAccountKey, /^upload:account-2:/);
  assert.notEqual(firstAccountKey, secondAccountKey);
});

test('remote upload paths are bound to the owning account and Task', () => {
  const storagePath = createUploadedFilePath('account-1', 42, 'Quarterly Report.pdf');
  const segments = storagePath.split('/');

  assert.equal(segments[0], 'account-1');
  assert.equal(segments[1], '42');
  assert.match(segments[2], /quarterly-report\.pdf$/);
  assert.throws(() => createUploadedFilePath('account-1', 'not-a-task', 'report.pdf'));
});