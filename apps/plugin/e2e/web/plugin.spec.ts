import { expect, test, type Page } from '@playwright/test';

// Room for the editor at 100 %: the web host shrinks it to fit a smaller page.
test.use({ viewport: { width: 1600, height: 1100 } });

const header = (page: Page) => page.getByRole('toolbar', { name: 'Prism', exact: true });

async function headerWidth(page: Page) {
  const box = await header(page).boundingBox();
  if (!box) throw new Error('The header is not laid out');
  return box.width;
}

async function openHostSettings(page: Page) {
  await page
    .getByRole('toolbar', { name: 'Host' })
    .getByRole('button', { name: 'Host settings' })
    .click();
  return page.getByRole('complementary', { name: 'Host settings' });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(header(page).getByRole('img', { name: 'Soundor Prism' })).toBeVisible();
});

test('the editor opens at its 1200 × 720 reference size', async ({ page }) => {
  expect(await headerWidth(page)).toBeCloseTo(1200, 0);
  await expect(page.getByRole('toolbar', { name: 'View', exact: true })).toBeVisible();
});

test('the host lists the global parameters and 24 band slots', async ({ page }) => {
  const settings = await openHostSettings(page);

  const global = settings.getByRole('group', { name: 'Global' });
  await expect(global.getByRole('checkbox', { name: 'Bypass' })).not.toBeChecked();
  await expect(global.getByRole('slider', { name: 'Input gain' })).toBeVisible();
  await expect(global.getByRole('slider', { name: 'Output gain' })).toBeVisible();

  for (const slot of [1, 12, 24]) {
    const band = settings.getByRole('group', { name: `Band ${slot}`, exact: true });
    await expect(band.getByRole('checkbox', { name: `Band ${slot} active` })).not.toBeChecked();
    await expect(band.getByRole('checkbox', { name: `Band ${slot} on` })).toBeChecked();
    await expect(band.getByRole('combobox', { name: `Band ${slot} type` })).toHaveValue('bell');
  }
  await expect(settings.getByRole('group', { name: /^Band \d+$/ })).toHaveCount(24);
  await expect(settings.getByRole('group', { name: 'Band 1', exact: true })).toContainText(
    '1.00 kHz',
  );
});

test('the synth loop keeps playing through bypass', async ({ page }) => {
  const host = page.getByRole('toolbar', { name: 'Host' });
  await host.getByRole('button', { name: 'Play', exact: true }).click();
  const pause = host.getByRole('button', { name: 'Pause', exact: true });
  await expect(pause).toHaveAttribute('aria-pressed', 'true');

  const settings = await openHostSettings(page);
  const bypass = settings.getByRole('checkbox', { name: 'Bypass' });
  await bypass.check();
  await expect(bypass).toBeChecked();
  await bypass.uncheck();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');

  await pause.click();
  await expect(host.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});
