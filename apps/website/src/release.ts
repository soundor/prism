import plugin from '../../plugin/package.json' with { type: 'json' };

export const repository = 'https://github.com/soundor/prism';
export const releases = `${repository}/releases`;
export const version = plugin.version;
// Release Please changes the version from 0.0.0 with the first release PR.
export const released = version !== '0.0.0';
export const tag = `v${version}`;
const download = `${releases}/download/${tag}`;

export const platforms = [
  { id: 'linux', name: 'Linux', arch: 'x86_64', suffix: 'linux-x86_64', folder: '~/.vst3' },
  {
    id: 'windows',
    name: 'Windows',
    arch: 'x64',
    suffix: 'windows-x64',
    folder: 'C:\\Program Files\\Common Files\\VST3',
  },
].map((platform) => {
  const file = `Soundor-Prism-${version}-${platform.suffix}.zip`;
  return { ...platform, file, url: `${download}/${file}` };
});

export const checksumFile = 'SHA256SUMS';
export const checksums = `${download}/${checksumFile}`;
