import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../../plugin/CHANGELOG.md', import.meta.url);
const output = new URL('../content/docs/changelog.mdx', import.meta.url);

// Escape MDX syntax in release notes, leaving fenced and inline code intact.
const history = readFileSync(source, 'utf8')
  .replace(/^# [^\n]+\n+/, '')
  .split(/(```[\s\S]*?```|`[^`]*`)/g)
  .map((part, index) =>
    index % 2
      ? part
      : part.replaceAll('{', '&#123;').replaceAll('}', '&#125;').replaceAll('<', '&lt;'),
  )
  .join('');

writeFileSync(
  output,
  `---\ntitle: Changelog\ndescription: What changed in Soundor Prism.\n---\n\n${history}`,
);
