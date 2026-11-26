import { copyFile, cp, mkdir, rm } from 'node:fs/promises';

const out = new URL('../dist/', import.meta.url);
const brand = new URL('../../../assets/brand/', import.meta.url);
const web = new URL('../../plugin/.soundor/dist/web/', import.meta.url);

await rm(out, { recursive: true, force: true });
await cp(new URL('../site/', import.meta.url), out, { recursive: true });
await mkdir(new URL('brand/', out), { recursive: true });
await Promise.all([
  cp(web, new URL('embed/', out), { recursive: true }),
  copyFile(new URL('svg/soundor-prism-logo-on-dark.svg', brand), new URL('brand/logo.svg', out)),
  copyFile(new URL('svg/soundor-prism-icon.svg', brand), new URL('brand/icon.svg', out)),
  copyFile(new URL('apple-touch-icon.png', brand), new URL('apple-touch-icon.png', out)),
]);
