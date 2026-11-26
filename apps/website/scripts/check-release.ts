import { execFileSync } from 'node:child_process';

import { checksumFile, platforms, released, tag } from '../src/release.ts';

// Manual deploys can target main while Release Please's draft is still building.
if (released) {
  const release = JSON.parse(
    execFileSync('gh', ['release', 'view', tag, '--json', 'isDraft,assets'], { encoding: 'utf8' }),
  ) as { isDraft: boolean; assets: { name: string }[] };
  const files = release.assets.map(({ name }) => name);
  const missing = [...platforms.map(({ file }) => file), checksumFile].filter(
    (file) => !files.includes(file),
  );
  if (release.isDraft || missing.length) {
    throw new Error(
      `Release ${tag} must be published with both VST3 ZIPs and ${checksumFile} before the website can deploy.`,
    );
  }
}
