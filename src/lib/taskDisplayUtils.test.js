import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveTaskDisplayTitle } from './taskDisplayUtils.js';

test('Text cards preserve a non-empty original title', () => {
  assert.equal(
    deriveTaskDisplayTitle({ cardType: 'text', title: '毕业研究', text: 'step1: 审核材料' }),
    '毕业研究',
  );
});

test('Text cards derive a title only when the original title is empty', () => {
  assert.equal(
    deriveTaskDisplayTitle({ cardType: 'text', title: '', text: 'step1: 审核材料' }),
    'step1: 审核材料',
  );
});

test('Non-Text cards keep their existing title derivation', () => {
  assert.equal(
    deriveTaskDisplayTitle({ cardType: 'link', title: '毕业研究', text: 'https://example.com/step1-review' }),
    'Step1 Review',
  );
});