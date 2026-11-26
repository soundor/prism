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
pnpm website        # run the Fumadocs website at localhost:3000
pnpm build:vst3     # apps/plugin/.soundor/dist/vst3/Soundor Prism.vst3
```

For local VST3 use, copy the resulting bundle into a location your host scans for VST3 plugins, then rescan. For the browser demo, press Play for the included synth loop or select Audio file to play a local file.

- `apps/plugin`: Soundor configuration, React editor, Rust DSP, and demo input.
- `apps/website`: Fumadocs on TanStack Start, with a landing page, searchable MDX docs in `content/docs`, and the browser demo. `pnpm build` prerenders the site to `apps/website/dist/client`.
- `assets/brand`: supplied artwork and usage notes. Use either social preview image as the repository's GitHub social card.

To deploy the website, select **GitHub Actions** as the source in **Settings → Pages**, then run the **Website** workflow. The **Verify** workflow checks pull requests and builds the VST3 on Linux and Windows.

## Releases

Like Orbit, Prism uses Release Please. Conventional commits that touch `apps/plugin` drive the release PR, which updates the plugin version and changelog. `0.0.0` means unreleased; the first release is configured to be `0.1.0`.

Merging the release PR creates a draft. The **Release** workflow verifies the tag, builds the Linux x86-64 and Windows x64 ZIPs, attaches them with `SHA256SUMS`, then publishes and deploys the site from that tag. The site links directly to the matching ZIPs. If a draft needs to be finished after a failed run, rerun the failed jobs or dispatch **Release** with its tag.

If using the default GitHub token, enable **Allow GitHub Actions to create and approve pull requests** in repository settings. To trigger CI on release PRs, configure a `RELEASE_PR_TOKEN` from an app or user with permission to create the PR and release.

Source code is licensed under [AGPL-3.0-only](LICENSE). See [Branding](BRANDING.md) for guidance on using the Soundor and Prism names and logos.
