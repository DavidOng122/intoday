import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const fixture = JSON.parse(await readFile(
  path.resolve('.playwright', 'synthetic-user.json'),
  'utf8',
));

const createAdminClient = () => createClient(
  process.env.E2E_SUPABASE_URL || 'http://127.0.0.1:54321',
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const login = async (page) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.locator('input[type="email"]').fill(fixture.email);
  await page.locator('input[type="password"]').fill(fixture.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('.desktop-app')).toBeVisible();
  const readOnlyStatus = page.getByRole('status').filter({ hasText: 'read-only' });
  if (await readOnlyStatus.isVisible().catch(() => false)) {
    await page.evaluate(() => globalThis.dispatchEvent(new globalThis.Event('online')));
  }
  await expect(readOnlyStatus).toHaveCount(0, { timeout: 15_000 });
};

const readJournal = (page) => page.evaluate((userId) => new Promise((resolve, reject) => {
  const request = globalThis.indexedDB.open('intoday-task-mutation-journal', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const transaction = request.result.transaction('mutations', 'readonly');
    const records = transaction.objectStore('mutations').index('userId').getAll(userId);
    records.onsuccess = () => resolve(records.result);
    records.onerror = () => reject(records.error);
  };
}), fixture.userId);

test('local authenticated release journeys preserve behavior and durable writes', async ({ page, context }) => {
  const admin = createAdminClient();
  await login(page);
  await expect(page.getByRole('button', { name: /Inbox/ })).toBeVisible();
  await expect(page.locator(`#desktop-task-card-${fixture.taskIds[2]}`))
    .toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Inbox/ }).click();
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();

  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByRole('menuitem', { name: 'Text' }).click();
  await page.locator('.desktop-text-capture-modal textarea').fill('Release E2E Inbox item');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('.desktop-inbox-item-title'))
    .toHaveText('Release E2E Inbox item');
  await expect.poll(async () => {
    const { data, error } = await admin.from('todos').select('payload').eq('user_id', fixture.userId);
    if (error) throw error;
    return data.some(({ payload }) => payload?.text === 'Release E2E Inbox item');
  }).toBe(true);
  await page.locator('.desktop-inbox-close-btn').click();

  const secondWorkspaceMenu = page.locator('.desktop-workspace-menu');
  await page.locator('.desktop-workspace-name-button').click();
  await secondWorkspaceMenu.locator('.desktop-workspace-add-button').click();
  await page.locator('.desktop-workspace-name-button').click();
  await expect(secondWorkspaceMenu.locator('.desktop-workspace-menu-select')).toHaveCount(2);
  await secondWorkspaceMenu.locator('.desktop-workspace-menu-select')
    .filter({ hasText: 'Release E2E Workspace' }).click();

  await page.locator('#desktop-group-card-' + fixture.taskIds[0])
    .getByRole('button', { name: 'Open full view' }).click();
  const packTitle = page.locator('#desktop-group-full-view-title');
  await expect(packTitle).toHaveText('Release E2E Pack');
  await packTitle.click();
  await page.locator('.desktop-pack-page-title-input').fill('Release E2E Pack Renamed');
  await page.locator('.desktop-pack-page-title-input').press('Enter');
  await expect(page.locator('#desktop-group-full-view-title')).toHaveText('Release E2E Pack Renamed');
  await expect.poll(async () => {
    const { data, error } = await admin.from('todos').select('payload').eq('user_id', fixture.userId);
    if (error) throw error;
    return data.some(({ payload }) => payload?.desktopGroupName === 'Release E2E Pack Renamed');
  }).toBe(true);
  await page.locator('.desktop-pack-page-close').click();

  await page.locator(`#desktop-task-card-${fixture.taskIds[2]}`).click();
  const detailEditor = page.getByRole('textbox', { name: 'Edit text' });
  await expect(detailEditor).toBeVisible();
  await detailEditor.fill('Edited in Task Detail');
  await detailEditor.blur();
  await expect.poll(async () => {
    const { data, error } = await admin.from('todos')
      .select('payload')
      .eq('user_id', fixture.userId)
      .eq('todo_id', fixture.taskIds[2])
      .single();
    if (error) throw error;
    return data.payload.text;
  }).toBe('Edited in Task Detail');

  await page.keyboard.press('Escape');
  await expect(page.locator('.desktop-text-detail-backdrop')).toBeHidden();
  await page.locator('.desktop-topbar-actions button').first().click();
  const search = page.getByPlaceholder('Search');
  await search.fill('Edited in Task Detail');
  await expect(page.getByRole('button', { name: 'text Release E2E Detail' })).toBeVisible();
  await page.locator('.desktop-search-dialog-content button[aria-label="Close"]').click();

  await page.getByRole('button', { name: /Inbox/ }).click();
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByRole('menuitem', { name: 'Image' }).click();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'release-e2e.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p2sAAAAASUVORK5CYII=', 'base64'),
  });
  let uploadedStoragePath;
  await expect.poll(async () => {
    const { data, error } = await admin.from('todos').select('payload').eq('user_id', fixture.userId);
    if (error) throw error;
    uploadedStoragePath = data.find(({ payload }) => (
      payload?.uploadedOriginalFileName === 'release-e2e.png'
    ))
      ?.payload?.uploadedFileStoragePath;
    return typeof uploadedStoragePath === 'string';
  }, { timeout: 30_000 }).toBe(true);
  await expect.poll(async () => {
    const { data: uploadedObject, error: uploadReadError } = await admin.storage
      .from('uploads')
      .download(uploadedStoragePath);
    if (uploadReadError) return 0;
    return uploadedObject?.size || 0;
  }, { timeout: 30_000 }).toBeGreaterThan(0);

  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'read-only' })).toBeVisible();
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByRole('menuitem', { name: 'Text' }).click();
  await page.locator('.desktop-text-capture-modal textarea').fill('Must not persist offline');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Unable to save' })).toBeVisible();
  await expect.poll(async () => {
    const { data, error } = await admin.from('todos').select('payload').eq('user_id', fixture.userId);
    if (error) throw error;
    return data.filter(({ payload }) => payload?.text === 'Must not persist offline').length;
  }).toBe(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: 'read-only' })).toHaveCount(0);
  await page.unroute('**/rest/v1/rpc/apply_todo_mutation');
  await page.route('**/rest/v1/rpc/apply_todo_mutation', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByRole('menuitem', { name: 'Text' }).click();
  await page.locator('.desktop-text-capture-modal textarea').fill('Pending Journal Recovery');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect.poll(async () => (await readJournal(page)).some((record) => (
    record.payload?.text === 'Pending Journal Recovery'
  ))).toBe(true);
  await page.reload();
  await expect(page.locator('.desktop-app')).toBeVisible();
  await expect.poll(async () => (await readJournal(page)).some((record) => (
    record.payload?.text === 'Pending Journal Recovery'
  ))).toBe(true);
  await page.unroute('**/rest/v1/rpc/apply_todo_mutation');
  await expect.poll(async () => (await readJournal(page)).some((record) => (
    record.payload?.text === 'Pending Journal Recovery'
  ))).toBe(false, { timeout: 30_000 });
  await expect.poll(async () => {
    const { data, error } = await admin.from('todos')
      .select('payload')
      .eq('user_id', fixture.userId);
    if (error) throw error;
    return data.filter(({ payload }) => payload?.text === 'Pending Journal Recovery').length;
  }).toBe(1);
});
