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

// The inspector strip also exposes the band's name, as a list option.
const marker = (page: Page, name: string) =>
  page.getByLabel(name, { exact: true }).and(page.locator(':not([role="option"])'));

test('marker actions open at a secondary click and the filter submenu works from the keyboard', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add band' }).click();
  const bell = marker(page, 'Band 1, Bell');
  const menu = page.getByRole('menu', { name: 'Band 1 actions' });

  await bell.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Bypass band' }).click();
  await expect(menu).toBeHidden();

  await bell.focus();
  await bell.press('Shift+F10');
  await expect(menu.getByRole('menuitem', { name: 'Enable band' })).toBeFocused();
  const filterTypes = menu.getByRole('menuitem', { name: 'Filter type' });
  await filterTypes.focus();
  await filterTypes.press('ArrowRight');
  const submenu = page.getByRole('menu', { name: 'Filter type' });
  await expect(submenu.getByText('Bell', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(marker(page, 'Band 1, Low shelf')).toBeFocused();
  await expect(menu).toBeHidden();
});

test('global bypass takes precedence over solo and leaves marker actions available', async ({
  page,
}) => {
  const bypass = header(page).getByRole('button', { name: 'Global bypass' });
  await page.getByRole('button', { name: 'Add band' }).click();
  const first = marker(page, 'Band 1, Bell');
  const menu = page.getByRole('menu', { name: 'Band 1 actions' });
  await first.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Solo band' }).click();
  await expect(page.getByText('SOLO · BAND 1', { exact: true })).toBeVisible();

  await bypass.click();
  await expect(bypass).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('BYPASSED', { exact: true })).toBeVisible();
  await expect(page.getByText('SOLO · BAND 1', { exact: true })).toBeHidden();

  await first.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(marker(page, 'Band 2, Bell')).toBeVisible();
  await bypass.click();
  await expect(page.getByText('SOLO · BAND 1', { exact: true })).toBeVisible();
});

test('the header browses factory presets, tracks edits, and supports undo and redo', async ({
  page,
}) => {
  const toolbar = header(page);
  const preset = toolbar.getByRole('button', { name: /^Preset menu:/ });
  await expect(preset).toHaveAccessibleName('Preset menu: Init');
  await expect(toolbar.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await toolbar.getByRole('button', { name: 'Previous preset' }).click();
  await expect(preset).toHaveAccessibleName('Preset menu: Rumble Cleanup');
  await toolbar.getByRole('button', { name: 'Next preset' }).click();
  await expect(preset).toHaveAccessibleName('Preset menu: Init');
  await preset.click();
  await page.getByRole('menuitem', { name: 'Vocal Presence' }).click();
  await expect(preset).toHaveAccessibleName('Preset menu: Vocal Presence');
  await expect(marker(page, 'Band 1, Low cut')).toBeVisible();
  const add = page.getByRole('button', { name: 'Add band' });
  await add.click();
  await expect(preset).toHaveAccessibleName('Preset menu: Vocal Presence, modified');
  await add.press('Control+z');
  await expect(preset).toHaveAccessibleName('Preset menu: Vocal Presence');
  await toolbar.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(preset).toHaveAccessibleName('Preset menu: Vocal Presence, modified');
});

test('B starts from defaults, keeps its edits independently, and can be copied to A', async ({
  page,
}) => {
  const toolbar = header(page);
  const a = toolbar.getByRole('radio', { name: 'A', exact: true });
  const b = toolbar.getByRole('radio', { name: 'B', exact: true });
  await toolbar.getByRole('button', { name: 'Next preset' }).click();
  const lowCut = marker(page, 'Band 1, Low cut');
  const bell = marker(page, 'Band 1, Bell');
  await expect(lowCut).toBeVisible();

  await b.click();
  await expect(lowCut).toBeHidden();
  await page.getByRole('button', { name: 'Add band' }).click();
  await expect(bell).toBeVisible();
  await a.click();
  await expect(lowCut).toBeVisible();
  await b.click();
  await expect(bell).toBeVisible();

  await toolbar.getByRole('button', { name: 'Copy B to A' }).click();
  await a.click();
  await expect(bell).toBeVisible();
  await expect(lowCut).toBeHidden();
});
