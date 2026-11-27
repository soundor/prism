<img src="assets/brand/svg/soundor-prism-logo.svg" alt="Soundor Prism" height="88" />

# Soundor Prism

Prism is a parametric equalizer built with [Soundor](https://soundor.dev), for VST3 hosts and the browser.

- Up to 24 bands: bell, low and high shelf, low and high cut (6 to 48 dB/oct), notch and band pass, from 10 Hz to 30 kHz, each on stereo, left, right, mid or side.
- Add, drag and shape bands on the response graph, select several with a rectangle and edit them together, or use the inspector below the graph. Per-band bypass and solo, global bypass, input and output gain.
- Factory presets, undo and redo, and A/B comparison saved with the project.
- A pre and post spectrum analyzer with freeze and settings, a spectrogram, a pitch keyboard and a phase view.
- One 1200 × 720 layout, scaled as a whole from 75 % to 200 %.

**Status:** the editor is complete, but the Rust processor still passes audio through unchanged, and the analyzer and meters show a simulated signal. The curves are display-only filter math for now. Sessions saved with the earlier four-band version do not load their settings.

See the [docs](apps/website/content/docs) for the controls and keyboard shortcuts.

## Develop

Use Node 24, Corepack, and Rust via `rustup` with `rustfmt` and the `wasm32-unknown-unknown` target. The VST3 targets in CI are Linux x86-64 and Windows x64.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check          # format, lint, types, UI and DSP tests, and static site build
pnpm test:e2e       # build the browser plugin and test each editor state in Chromium
pnpm dev            # Soundor browser runtime in development mode
pnpm website        # run the Fumadocs website at localhost:3000
pnpm build:vst3     # apps/plugin/.soundor/dist/vst3/Soundor Prism.vst3
```

Before running browser tests for the first time, install Chromium with
`pnpm --filter prism exec playwright install --with-deps chromium`.

For local VST3 use, copy the resulting bundle into a location your host scans for VST3 plugins, then rescan. For the browser demo, press Play for the included synth loop or select Audio file to play a local file.

- `apps/plugin`: Soundor configuration and factory presets, the React editor (feature folders under `src`: `app`, `analyzer`, `bands`, `graph`, `inspector`, `meters`, `presets`), the Rust processor, and demo input.
- `apps/website`: Fumadocs on TanStack Start, with a landing page, searchable MDX docs in `content/docs`, and the browser demo. `pnpm build` prerenders the site to `apps/website/dist/client`.
- `assets/brand`: supplied artwork and usage notes. Use either social preview image as the repository's GitHub social card.

To deploy the website, select **GitHub Actions** as the source in **Settings → Pages**, then run the **Website** workflow. The **Verify** workflow checks pull requests and builds the VST3 on Linux and Windows.

## Releases

Like Orbit, Prism uses Release Please. Conventional commits that touch `apps/plugin` drive the release PR, which updates the plugin version and changelog. `0.0.0` means unreleased; the first release is configured to be `0.1.0`.

Merging the release PR creates a draft. The **Release** workflow verifies the tag, builds the Linux x86-64 and Windows x64 ZIPs, attaches them with `SHA256SUMS`, then publishes and deploys the site from that tag. The site links directly to the matching ZIPs. If a draft needs to be finished after a failed run, rerun the failed jobs or dispatch **Release** with its tag.

If using the default GitHub token, enable **Allow GitHub Actions to create and approve pull requests** in repository settings. To trigger CI on release PRs, configure a `RELEASE_PR_TOKEN` from an app or user with permission to create the PR and release.

Source code is licensed under [AGPL-3.0-only](LICENSE). See [Branding](BRANDING.md) for guidance on using the Soundor and Prism names and logos.
