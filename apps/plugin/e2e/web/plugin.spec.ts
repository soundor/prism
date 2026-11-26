import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('slider', { name: 'Low', exact: true })).toBeVisible();
});

test('all four gain controls start flat and respond to the keyboard', async ({ page }) => {
  for (const name of ['Low', 'Low mid', 'High mid', 'High']) {
    const knob = page.getByRole('slider', { name, exact: true });
    await expect(knob).toHaveAttribute('aria-valuetext', '0.0 dB');
    await knob.press('ArrowUp');
    await expect(knob).toBeFocused();
    await expect(knob).toHaveAttribute('aria-valuetext', /^\+[\d.]+ dB$/);
    await knob.press('Home');
    await expect(knob).toHaveAttribute('aria-valuetext', '0.0 dB');
  }
});

test('dragging a gain knob changes only that band', async ({ page }) => {
  const knob = page.getByRole('slider', { name: 'Low mid' });
  const box = await knob.boundingBox();
  if (!box) throw new Error('Low mid knob is not laid out');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 40, { steps: 8 });
  await page.mouse.up();

  await expect(knob).toHaveAttribute('aria-valuetext', /^\+[\d.]+ dB$/);
  await expect(page.getByRole('slider', { name: 'High mid' })).toHaveAttribute(
    'aria-valuetext',
    '0.0 dB',
  );
});

test('the synth loop plays and can switch between Original and Prism', async ({ page }) => {
  const host = page.getByRole('toolbar', { name: 'Host' });
  const original = page.getByRole('radio', { name: 'Original' });
  const prism = page.getByRole('radio', { name: 'Prism' });
  await expect(prism).toBeChecked();

  await host.getByRole('button', { name: 'Play', exact: true }).click();
  const pause = host.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toHaveAttribute('aria-pressed', 'true');

  await original.click();
  await expect(original).toBeChecked();
  await prism.click();
  await expect(prism).toBeChecked();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await pause.click();
  await expect(host.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});
