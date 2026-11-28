import { expect, test, type Page } from '@playwright/test';

// What you hear, through the processor: each test plays a source and reads
// the output meter, which the processor publishes from the audio it put out.

test.use({ viewport: { width: 1600, height: 1100 } });

/** The 1 kHz test tone peaks here: a sine at 0.25. */
const TONE_DBFS = -12;

const host = (page: Page) => page.getByRole('toolbar', { name: 'Host' });
const header = (page: Page) => page.getByRole('toolbar', { name: 'Prism', exact: true });

/** The left channel's output level, in dBFS. */
async function level(page: Page) {
  const meter = page.getByRole('progressbar', { name: 'Output level, left' });
  return Number(await meter.getAttribute('aria-valuenow'));
}

/** Waits for the output level to settle within `tolerance` dB of `dbfs`. */
async function expectLevel(page: Page, dbfs: number, tolerance = 0.3) {
  await expect
    .poll(async () => Math.abs((await level(page)) - dbfs), { timeout: 5000 })
    .toBeLessThan(tolerance);
}

/** Picks `input` in the host's settings, closes them and presses Play. */
async function play(page: Page, input: string) {
  const settings = host(page).getByRole('button', { name: 'Host settings' });
  await settings.click();
  await page
    .getByRole('complementary', { name: 'Host settings' })
    .getByRole('combobox', { name: 'Input' })
    .selectOption({ label: input });
  await settings.click();
  const start = host(page).getByRole('button', { name: 'Play', exact: true });
  if (await start.isVisible()) await start.click();
}

/** Types `value` into the field named `name`, as a double-click opens it. */
async function enter(page: Page, name: string, value: string) {
  await page.getByRole('slider', { name, exact: true }).dblclick();
  const entry = page.locator('input:focus');
  await entry.fill(value);
  await entry.press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(header(page).getByRole('img', { name: 'Soundor Prism' })).toBeVisible();
});

for (const input of ['Synth loop', 'Drum loop', 'Pink noise', 'Sine sweep', '1 kHz sine']) {
  test(`the ${input.toLowerCase()} plays through the processor`, async ({ page }) => {
    await play(page, input);
    await expect.poll(() => level(page), { timeout: 5000 }).toBeGreaterThan(-30);
  });
}

test('a band boosted in the editor raises the level, and bypass takes the boost away', async ({
  page,
}) => {
  await play(page, '1 kHz sine');
  await expectLevel(page, TONE_DBFS);

  // Add puts a bell at 1 kHz, flat until its gain moves.
  await page.getByRole('button', { name: 'Add band' }).click();
  await expectLevel(page, TONE_DBFS);
  await enter(page, 'Gain', '6');
  await expectLevel(page, TONE_DBFS + 6);

  const bypass = header(page).getByRole('button', { name: 'Global bypass' });
  await bypass.click();
  await expectLevel(page, TONE_DBFS);
  await bypass.click();
  await expectLevel(page, TONE_DBFS + 6);

  // The band's own switch, in the inspector.
  await page.getByLabel('Band on', { exact: true }).click();
  await expectLevel(page, TONE_DBFS);
});

test('output gain changes the level', async ({ page }) => {
  await play(page, '1 kHz sine');
  await expectLevel(page, TONE_DBFS);
  await enter(page, 'Output gain', '-6');
  await expectLevel(page, TONE_DBFS - 6);
  await enter(page, 'Input gain', '3');
  await expectLevel(page, TONE_DBFS - 3);
});

test('A and B each keep what they do to the audio', async ({ page }) => {
  await play(page, '1 kHz sine');
  await page.getByRole('button', { name: 'Add band' }).click();
  await enter(page, 'Gain', '-9');
  await expectLevel(page, TONE_DBFS - 9);

  await header(page).getByRole('radio', { name: 'B', exact: true }).click();
  await expectLevel(page, TONE_DBFS);
  await header(page).getByRole('radio', { name: 'A', exact: true }).click();
  await expectLevel(page, TONE_DBFS - 9);
});

test('undo and redo change what you hear', async ({ page }) => {
  await play(page, '1 kHz sine');
  await page.getByRole('button', { name: 'Add band' }).click();
  await enter(page, 'Gain', '6');
  await expectLevel(page, TONE_DBFS + 6);

  await header(page).getByRole('button', { name: 'Undo', exact: true }).click();
  await expectLevel(page, TONE_DBFS);
  await header(page).getByRole('button', { name: 'Redo', exact: true }).click();
  await expectLevel(page, TONE_DBFS + 6);
});
