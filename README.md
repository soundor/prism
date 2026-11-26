<img src="assets/brand/svg/soundor-prism-logo.svg" alt="Soundor Prism" height="88" />

# Soundor Prism

Prism is a four-band equalizer built with [Soundor](https://soundor.dev). The same Rust processor runs in a VST3 host and in the browser.

| Band     | Filter | Frequency |
| -------- | ------ | --------: |
| Low      | Shelf  |    100 Hz |
| Low mid  | Bell   |    400 Hz |
| High mid | Bell   |     2 kHz |
| High     | Shelf  |     8 kHz |

Each band cuts or boosts up to 12 dB. Drag a knob or use the arrow keys; Home resets it to 0 dB. Switch to **Original** to hear the unprocessed signal and back to **Prism** to hear the EQ. The display shows each band's gain setting, not the combined response.

## Develop

Use Node 24, Corepack, and Rust via `rustup` with `rustfmt` and the `wasm32-unknown-unknown` target. The VST3 targets in CI are Linux x86-64 and Windows x64.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check          # format, lint, types, DSP tests, and static site build
pnpm dev            # Soundor browser runtime in development mode
pnpm website        # build and preview the landing page at localhost:4173
pnpm build:vst3     # apps/plugin/.soundor/dist/vst3/Soundor Prism.vst3
```

For local VST3 use, copy the resulting bundle into a location your host scans for VST3 plugins, then rescan. For the browser demo, press Play for the included synth loop or select Audio file to play a local file.

- `apps/plugin`: Soundor configuration, React editor, Rust DSP, and demo input.
- `apps/website`: static landing page and browser demo. `pnpm build` writes the site to `apps/website/dist`.
- `assets/brand`: supplied artwork and usage notes. Use either social preview image as the repository's GitHub social card.

To deploy the website, select **GitHub Actions** as the source in **Settings → Pages**, then run the **Website** workflow. The **Verify** workflow checks pull requests and builds the VST3 on Linux and Windows.

Source code is licensed under [AGPL-3.0-only](LICENSE).
