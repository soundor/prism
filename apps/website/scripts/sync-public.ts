import { copyFile, cp, mkdir, rm } from 'node:fs/promises';

const publicDir = new URL('../public/', import.meta.url);
const embed = new URL('embed/', publicDir);
const brand = new URL('../../../assets/brand/', import.meta.url);
const web = new URL('../../plugin/.soundor/dist/web/', import.meta.url);

await mkdir(publicDir, { recursive: true });
await rm(embed, { recursive: true, force: true });
await Promise.all([
  cp(web, embed, { recursive: true }),
  copyFile(new URL('svg/soundor-prism-icon.svg', brand), new URL('icon.svg', publicDir)),
  copyFile(new URL('favicon.ico', brand), new URL('favicon.ico', publicDir)),
  copyFile(new URL('apple-touch-icon.png', brand), new URL('apple-touch-icon.png', publicDir)),
  copyFile(
    new URL('social/social-preview-dark.png', brand),
    new URL('social-preview.png', publicDir),
  ),
]);
