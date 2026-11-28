/// <reference lib="dom" />

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type Page } from 'playwright';

// The home page's gallery: screenshots of the web demo that sync-public copied
// into public/embed, taken in Chromium at every dev and build, so they always
// show the interface as it is. Each shot is saved twice, as WebP from the
// browser's own encoder: the whole 16:9 window, and a 4:3 crop of the part
// that matters, which a phone shows instead. Each is saved at a few widths, so
// a page picks one near the size it shows it at: shrunk a long way, and tilted
// on top, thin lines break into steps. They are taken again only when the demo
// or this script changes.
const embed = new URL('../public/embed/', import.meta.url);
const out = new URL('../src/assets/gallery/', import.meta.url);
/** The hero is 16:9: the window the demo is shown in, in CSS pixels, taken at twice that. */
const WIDTH = 1280;
const HEIGHT = 720;
/** The widths each image is saved at, in pixels, besides its own. */
const WIDTHS = [480, 800, 1280, 1920];

type Box = { x: number; y: number; width: number; height: number };

interface Shot {
  readonly id: string;
  readonly title: string;
  /** What it shows, for a visitor who cannot see it. */
  readonly alt: string;
  readonly input?: string;
  /** Puts the demo in the state to show, after the common setup. */
  readonly setup?: (page: Page) => Promise<void>;
  /** The part a phone shows; the graph around the selected band by default. */
  readonly detail?: (page: Page) => Promise<Box>;
}

// In the order the gallery shows them; it opens on the middle one, the
// response graph, with a shot either side.
const shots: Shot[] = [
  {
    id: 'phase',
    title: 'Phase',
    alt: 'The graph showing the combined phase of the Vocal Presence bands.',
    setup: (page) => page.getByRole('radio', { name: 'Phase', exact: true }).click(),
  },
  {
    id: 'spectrogram',
    title: 'Spectrogram',
    alt: 'The graph over a spectrogram of the last seconds of a synth loop.',
    input: 'Synth loop',
    setup: async (page) => {
      await page.getByRole('button', { name: 'Spectrogram' }).click();
      await page.waitForTimeout(4000);
    },
  },
  {
    id: 'graph',
    title: 'Response graph',
    alt: 'Prism with the Vocal Presence preset: five bands on the response graph over the spectrum of pink noise, band 3 selected in the inspector.',
  },
  {
    id: 'keyboard',
    title: 'Pitch keyboard',
    alt: 'A piano keyboard along the bottom of the graph, under the spectrum of a synth loop.',
    input: 'Synth loop',
    setup: (page) => page.getByRole('button', { name: 'Pitch keyboard' }).click(),
  },
  {
    id: 'presets',
    title: 'Factory presets',
    alt: 'The preset menu open over the graph, listing the factory presets.',
    setup: async (page) => {
      await page.getByRole('button', { name: /^Preset menu/ }).click();
      await page.waitForTimeout(300);
    },
    detail: async (page) => {
      const menu = await page.getByRole('menu', { name: 'Factory presets' }).boundingBox();
      const button = await page.getByRole('button', { name: /^Preset menu/ }).boundingBox();
      const top = Math.min(menu!.y, button!.y) - 12;
      const height = Math.max(menu!.y + menu!.height, button!.y + button!.height) + 12 - top;
      return around(
        { x: 0, y: 0, width: WIDTH, height: HEIGHT },
        {
          x: button!.x + button!.width / 2,
          y: top + height / 2,
        },
        Math.max(height, menu!.width * 0.75) * 1.5,
      );
    },
  },
];

/** A 4:3 box `height` tall centred on `focus`, kept inside `bounds`. */
function around(bounds: Box, focus: { x: number; y: number }, height: number): Box {
  const h = Math.min(height, bounds.height, (bounds.width * 3) / 4);
  const w = (h * 4) / 3;
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  return {
    x: clamp(focus.x - w / 2, bounds.x, bounds.x + bounds.width - w),
    y: clamp(focus.y - h / 2, bounds.y, bounds.y + bounds.height - h),
    width: w,
    height: h,
  };
}

/** The graph's full height, across from the selected band. */
async function graphDetail(page: Page) {
  const graph = (await page.getByRole('group', { name: 'Equalizer graph' }).boundingBox())!;
  const band = (await page.getByRole('slider', { name: /^Band 3,/ }).boundingBox())!;
  return around(graph, { x: band.x + band.width / 2, y: graph.y + graph.height / 2 }, graph.height);
}

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

const root = fileURLToPath(embed);
const hash = createHash('sha256');
hash.update(await readFile(fileURLToPath(import.meta.url)));
for (const file of await files(root))
  hash.update(file.slice(root.length)).update(await readFile(file));
const key = hash.digest('hex');
const stamp = new URL('.hash', out);
if (existsSync(stamp) && (await readFile(stamp, 'utf8')) === key) {
  console.log('screenshots: up to date');
  process.exit(0);
}

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const path = fileURLToPath(new URL(`.${pathname === '/' ? '/index.html' : pathname}`, embed));
  try {
    if (!path.startsWith(root)) throw new Error('outside');
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  // Written over in place, not emptied first: a dev server watching the
  // folder would lose it.
  await mkdir(out, { recursive: true });
  const written = new Set(['gallery.json', '.hash']);
  const manifest: { id: string; title: string; alt: string; full: number[]; detail: number[] }[] =
    [];
  for (const shot of shots) {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.getByRole('img', { name: 'Soundor Prism' }).first().waitFor();

    // Vocal Presence over a source, analyzed at 3 dB/oct so pink noise reads
    // flat and the post trace follows the curve, band 3 selected.
    const settings = page.getByRole('button', { name: 'Host settings' });
    await settings.click();
    await page
      .getByRole('complementary', { name: 'Host settings' })
      .getByRole('combobox', { name: 'Input' })
      .selectOption({ label: shot.input ?? 'Pink noise' });
    await settings.click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByRole('button', { name: 'Next preset' }).click();
    await page.getByRole('button', { name: 'Analyzer settings' }).click();
    await page
      .getByRole('radiogroup', { name: /Tilt/ })
      .getByRole('radio', { name: '3', exact: true })
      .click();
    await page.keyboard.press('Escape');
    await page.getByRole('slider', { name: /^Band 3,/ }).click();
    // The analyzer settles.
    await page.waitForTimeout(2500);
    await shot.setup?.(page);
    await page.mouse.move(WIDTH - 1, HEIGHT - 1);
    await page.evaluate(() => {
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.getAttribute('role') !== 'menuitem') focused?.blur();
    });
    await page.waitForTimeout(300);

    const detail = await (shot.detail ?? graphDetail)(page);
    const sizes: Record<string, number[]> = {};
    for (const [name, png] of [
      ['full', await page.screenshot()],
      ['detail', await page.screenshot({ clip: detail })],
    ] as const) {
      const encoded = await page.evaluate(
        async ({ data, widths }) => {
          const source = await (await fetch(`data:image/png;base64,${data}`)).blob();
          const { width } = await createImageBitmap(source);
          const out: [number, number[]][] = [];
          for (const w of [...widths.filter((w) => w < width), width]) {
            const bitmap = await createImageBitmap(source, {
              resizeWidth: w,
              resizeQuality: 'high',
            });
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
            const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.86 });
            out.push([w, [...new Uint8Array(await blob.arrayBuffer())]]);
          }
          return out;
        },
        { data: png.toString('base64'), widths: WIDTHS },
      );
      sizes[name] = encoded.map(([w]) => w);
      for (const [w, webp] of encoded) {
        const file = `${shot.id}${name === 'detail' ? '-detail' : ''}-${w}.webp`;
        await writeFile(new URL(file, out), Uint8Array.from(webp));
        written.add(file);
      }
    }
    manifest.push({
      id: shot.id,
      title: shot.title,
      alt: shot.alt,
      full: sizes.full!,
      detail: sizes.detail!,
    });
    await page.close();
    console.log(`screenshots: ${shot.id}`);
  }
  await writeFile(new URL('gallery.json', out), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(stamp, key);
  for (const name of await readdir(out)) {
    if (!written.has(name)) await rm(new URL(name, out), { force: true });
  }
} finally {
  await browser.close();
  server.close();
}
