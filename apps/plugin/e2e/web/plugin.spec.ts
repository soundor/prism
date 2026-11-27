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

test('bands outside a narrow gain range are hidden and do not affect vertical drags', async ({
  page,
}) => {
  await header(page).getByRole('button', { name: 'Next preset' }).click();
  const cut = marker(page, 'Band 2, Bell');
  const boost = marker(page, 'Band 3, Bell');
  const shelf = marker(page, 'Band 5, High shelf');
  await expect(cut).toHaveAttribute('aria-valuetext', /−3\.2 dB/);
  await expect(shelf).toHaveAttribute('aria-valuetext', /\+3\.4 dB/);
  await boost.click();
  await cut.click({ modifiers: ['Shift'] });
  await shelf.click({ modifiers: ['Shift'] });
  await expect(page.getByText('3 selected', { exact: true })).toBeVisible();

  await page.getByRole('radio', { name: '±3', exact: true }).click();
  await expect(cut).toBeHidden();
  await expect(shelf).toBeHidden();
  await expect(boost).toHaveAttribute('aria-valuetext', /\+2\.6 dB/);

  const box = (await boost.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 100, { steps: 8 });
  await page.mouse.up();
  await expect(boost).toHaveAttribute('aria-valuetext', /\+1\.[0-9] dB/);

  await page.getByRole('radio', { name: '±12', exact: true }).click();
  await expect(cut).toHaveAttribute('aria-valuetext', /−3\.2 dB/);
  await expect(shelf).toHaveAttribute('aria-valuetext', /\+3\.4 dB/);
});

test('graph coordinates stay fixed when the first marker appears', async ({ page }) => {
  const graph = page.getByLabel('Equalizer response and bands', { exact: true });
  const box = (await graph.boundingBox())!;
  const x = box.x + box.width * 0.72;
  const y = box.y + box.height * 0.3;
  await page.mouse.dblclick(x, y);
  const first = marker(page, 'Band 1, Bell');
  await expect(first).toBeVisible();
  const value = (await first.getAttribute('aria-valuetext'))!;

  await header(page).getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Add band' }).click();
  await expect(first).toBeVisible();
  await page.mouse.dblclick(x, y);
  await expect(marker(page, 'Band 2, Bell')).toHaveAttribute('aria-valuetext', value);
});

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

test('analyzer controls can hide the axis, freeze the trace and change analyzer settings', async ({
  page,
}) => {
  const view = page.getByRole('toolbar', { name: 'View', exact: true });
  const mode = view.getByRole('radiogroup', { name: 'Analyzer mode' });
  const axis = page.getByText('dBFS', { exact: true });
  const freeze = view.getByRole('button', { name: 'Freeze spectrum' });
  await expect(axis).toBeVisible();
  await mode.getByRole('radio', { name: 'Off' }).click();
  await expect(axis).toBeHidden();
  await expect(freeze).toBeDisabled();
  await mode.getByRole('radio', { name: 'Pre', exact: true }).click();
  await freeze.click();
  await expect(freeze).toHaveAttribute('aria-pressed', 'true');
  await freeze.click();
  await expect(freeze).toHaveAttribute('aria-pressed', 'false');

  const settings = view.getByRole('button', { name: 'Analyzer settings' });
  await settings.click();
  const popover = page.getByRole('dialog', { name: 'Analyzer settings' });
  const floor = popover.getByRole('radio', { name: '−120' });
  await floor.click();
  await expect(floor).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await expect(settings).toBeFocused();
  await expect(axis).toBeVisible();

  const range = view.getByRole('radiogroup', { name: 'Response display range' });
  await expect(range.getByRole('radio', { name: '±12' })).toBeChecked();
  const wide = range.getByRole('radio', { name: '±24' });
  await wide.click();
  await expect(wide).toBeChecked();
});

test('the display switches to phase, and the spectrogram and pitch keyboard toggle', async ({
  page,
}) => {
  const view = page.getByRole('toolbar', { name: 'View', exact: true });
  const display = view.getByRole('radiogroup', { name: 'Display' });
  await display.getByRole('radio', { name: 'Phase' }).click();
  await expect(page.getByText('PHASE RESPONSE')).toBeVisible();
  await expect(page.getByText('DEG', { exact: true })).toBeVisible();
  await display.getByRole('radio', { name: 'Magnitude' }).click();
  await expect(page.getByText('PHASE RESPONSE')).toBeHidden();

  const spectrogram = view.getByRole('button', { name: 'Spectrogram' });
  await spectrogram.click();
  await expect(spectrogram).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: 'Spectrogram' })).toBeVisible();
  await expect(page.getByText('Pre EQ')).toBeHidden();
  await spectrogram.click();
  await expect(page.getByRole('img', { name: 'Spectrogram' })).toBeHidden();

  const keyboard = view.getByRole('button', { name: 'Pitch keyboard' });
  await keyboard.click();
  await expect(page.getByRole('img', { name: 'Musical pitch keyboard' })).toBeVisible();
  await keyboard.click();
  await expect(page.getByRole('img', { name: 'Musical pitch keyboard' })).toBeHidden();
});

test('the meter shows the output, which clips, and each clip indicator can be cleared', async ({
  page,
}) => {
  const level = page.getByRole('progressbar', { name: 'Output level, left' });
  await expect(level).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  // The demo loop peaks at about -12 dBFS.
  await expect
    .poll(async () => Number(await level.getAttribute('aria-valuenow')))
    .toBeGreaterThan(-40);
  const reset = page.getByRole('button', { name: 'Output clip, left' });
  const gain = page.getByRole('slider', { name: 'Output gain', exact: true });
  await gain.dblclick();
  const entry = page.locator('input:focus');
  await entry.fill('24');
  await entry.press('Enter');
  await expect(reset).toHaveAttribute('aria-pressed', 'true');
  await gain.dblclick();
  await entry.fill('0');
  await entry.press('Enter');
  await page.getByRole('button', { name: 'Stop' }).click();
  await reset.click();
  await expect(reset).toHaveAttribute('aria-pressed', 'false');
});

test('an empty setup shows how to add a band, and the hint goes with the first band', async ({
  page,
}) => {
  const hint = page.getByText('Double-click anywhere on the graph to add a band');
  await expect(hint).toBeVisible();
  await expect(page.getByText('Add a band to start')).toBeVisible();
  await expect(page.getByText('None yet', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add band' }).click();
  await expect(hint).toBeHidden();
  await expect(page.getByText('1/24', { exact: true })).toBeVisible();
});

test('a marker moves with the arrow keys and Delete removes it', async ({ page }) => {
  await page.getByRole('button', { name: 'Add band' }).click();
  const bell = marker(page, 'Band 1, Bell');
  await expect(bell).toHaveAttribute('aria-valuetext', '1.00 kHz, 0.0 dB, Q 0.707');
  await expect(bell).toHaveAttribute('aria-description', /up and down the gain/);

  await bell.focus();
  await bell.press('ArrowUp');
  await expect(bell).toHaveAttribute('aria-valuetext', /^1\.00 kHz, \+0\.[1-9] dB/);
  await bell.press('ArrowRight');
  await expect(bell).not.toHaveAttribute('aria-valuetext', /^1\.00 kHz/);
  await bell.press('Delete');
  await expect(bell).toBeHidden();
  await expect(page.getByText('Add a band to start')).toBeVisible();
});

test('a dragged rectangle selects the markers inside it', async ({ page }) => {
  await header(page).getByRole('button', { name: 'Next preset' }).click();
  const cut = (await marker(page, 'Band 2, Bell').boundingBox())!;
  const boost = (await marker(page, 'Band 3, Bell').boundingBox())!;
  const top = Math.min(cut.y, boost.y) - 20;
  const bottom = Math.max(cut.y + cut.height, boost.y + boost.height) + 20;
  await page.mouse.move(cut.x - 20, top);
  await page.mouse.down();
  await page.mouse.move(boost.x + boost.width + 20, bottom, { steps: 10 });
  await page.mouse.up();

  await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
  await expect(page.getByText('Bands 2, 3', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Select a band to edit it')).toBeVisible();
});

test('several bands show their shared values and "Mixed" for the rest', async ({ page }) => {
  await header(page).getByRole('button', { name: 'Next preset' }).click();
  await marker(page, 'Band 2, Bell').click();
  await marker(page, 'Band 4, Notch').click({ modifiers: ['Shift'] });

  await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter type' })).toContainText('Mixed');
  await expect(page.getByRole('slider', { name: 'Frequency offset', exact: true })).toBeVisible();
  await expect(page.getByText('Not used by some', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Solo band' })).toBeDisabled();
  await page.getByRole('button', { name: 'Delete 2 bands' }).click();
  await expect(marker(page, 'Band 2, Bell')).toBeHidden();
  await expect(marker(page, 'Band 4, Notch')).toBeHidden();
  await expect(page.getByText('3/24', { exact: true })).toBeVisible();
});

test('the band strip selects as a file manager does, and is one Tab stop', async ({ page }) => {
  await header(page).getByRole('button', { name: 'Next preset' }).click();
  const strip = page.getByRole('listbox', { name: 'Bands' });
  const chip = (slot: number) => strip.getByRole('option', { name: new RegExp(`^Band ${slot},`) });
  const selected = strip.getByRole('option', { selected: true });
  const toggle = process.platform === 'darwin' ? 'Meta' : 'Control';

  await chip(2).click();
  await expect(selected).toHaveText(['2']);
  await chip(4).click({ modifiers: ['Shift'] });
  await expect(selected).toHaveText(['2', '3', '4']);
  await chip(3).click({ modifiers: [toggle] });
  await expect(selected).toHaveText(['2', '4']);
  await chip(3).click();
  await expect(selected).toHaveText(['3']);

  // Arrows move focus along the strip; Tab leaves it for the next control.
  await page.keyboard.press('ArrowRight');
  await expect(chip(4)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add band' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(chip(4)).toBeFocused();
});

test('all 24 slots can be filled, then Add gives way to "Full" and the chips fit', async ({
  page,
}) => {
  const add = page.getByRole('button', { name: 'Add band' });
  for (let i = 0; i < 24; i++) await add.click();
  const count = page.getByText('24/24', { exact: true });
  await expect(count).toBeVisible();
  await expect(add).toBeHidden();
  await expect(page.getByText('Full', { exact: true })).toBeVisible();
  const chips = page.getByRole('listbox', { name: 'Bands' }).getByRole('option');
  await expect(chips).toHaveCount(24);
  const last = (await chips.last().boundingBox())!;
  expect(last.x + last.width).toBeLessThan((await count.boundingBox())!.x);
  await expect(marker(page, 'Band 24, Bell')).toBeVisible();
});

test('a bypassed band says so on its marker, its tooltip and in the inspector', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Add band' }).click();
  const bell = marker(page, 'Band 1, Bell');
  await bell.click({ button: 'right' });
  await page
    .getByRole('menu', { name: 'Band 1 actions' })
    .getByRole('menuitem', { name: 'Bypass band' })
    .click();
  await expect(bell).toHaveAttribute('aria-valuetext', /bypassed$/);

  await bell.click();
  await expect(page.getByText('Bypassed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Band on' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  const box = (await bell.boundingBox())!;
  await page.mouse.move(box.x - 30, box.y - 30);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  // Over a marker, Alt shows every setting.
  await page.keyboard.down('Alt');
  await expect(page.getByText(/^1 · Bell .* Bypassed$/)).toBeVisible();
  await page.keyboard.up('Alt');
});

for (const zoom of [0.75, 1.25, 1.5, 2]) {
  test(`the editor scales as a whole to ${zoom * 100} %`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 1200 * zoom, height: 720 * zoom } });
    await page.goto('/?embed');
    await expect(header(page).getByRole('img', { name: 'Soundor Prism' })).toBeVisible();
    expect(await headerWidth(page)).toBeCloseTo(1200 * zoom, 0);

    // The footer's last control still ends inside the editor.
    const wide = page.getByRole('radio', { name: '±30', exact: true });
    const box = (await wide.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(720 * zoom);
    expect(box.height).toBeGreaterThan(16 * zoom);
    await page.close();
  });
}
