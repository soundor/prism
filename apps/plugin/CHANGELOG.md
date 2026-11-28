# Changelog

## 0.1.0 (2026-11-28)


### Features

* add a resize grip to the editor's bottom-right corner ([4446a7c](https://github.com/soundor/prism/commit/4446a7cf2c0f856ab7bbe887cc5fa6bac208ab95))
* add band context menus and global bypass controls ([d2b137e](https://github.com/soundor/prism/commit/d2b137e0f5b53a09e54d14852df7271af839bbbb))
* add drum loop, pink noise, sine sweep, tone and microphone inputs to the browser demo ([672b5b6](https://github.com/soundor/prism/commit/672b5b6082139f1797cddbe41b8114ec94b02d40))
* add factory presets, undo and redo, and A/B comparison ([a3a1d2a](https://github.com/soundor/prism/commit/a3a1d2a108b1ccbe0f6b64dcb9219d07cf9d5e27))
* add factory presets, undo and redo, and A/B comparison ([bc37eaa](https://github.com/soundor/prism/commit/bc37eaaf228c9c914fd17e081fc21d9d11fc23af))
* add simulated stereo meters and spectrum analyzer ([0defc43](https://github.com/soundor/prism/commit/0defc43f987f992b704e69013aef637170b36841))
* add simulated stereo meters and spectrum analyzer ([d4ad9e9](https://github.com/soundor/prism/commit/d4ad9e92bfb6eee42c4dab22e0fc3c6b8273c109))
* add spectrogram, pitch keyboard and phase views ([268e998](https://github.com/soundor/prism/commit/268e9983de6f66748f64eab773435cf2a41f72af))
* add spectrogram, pitch keyboard and phase views ([29eaccf](https://github.com/soundor/prism/commit/29eaccfebd283abbf12c2706780519c7727df653))
* analyze the spectrum in the processor, with rustfft ([0eebfbb](https://github.com/soundor/prism/commit/0eebfbb105517f2c17a5c954406e605fb4cb6f5f))
* band strip, inspector and selection ([1b05030](https://github.com/soundor/prism/commit/1b050302d1d85c069757b9d7fc9f0fb1d496f37f))
* declare the 24-band parameters and lay out the editor ([322f3d1](https://github.com/soundor/prism/commit/322f3d1f9f9a7a9599925ca6113a48ff046c57db))
* declare the 24-band parameters and lay out the editor ([1da696d](https://github.com/soundor/prism/commit/1da696d0edb51c0afe6b7c4bf88e82847c449c36))
* draw the response graph and band markers ([64fbdcf](https://github.com/soundor/prism/commit/64fbdcfc4df1b83a3db0fb967329f81cceef7628))
* draw the response graph and band markers from the parameters ([2f0095e](https://github.com/soundor/prism/commit/2f0095e6acf20f3a51f728678e37fb4707fc92b2))
* draw the spectrogram from the processor's own FFT frames ([288818d](https://github.com/soundor/prism/commit/288818dea51514cf7925953199d71642c57dc1a4))
* edit EQ bands directly on the graph ([056fa70](https://github.com/soundor/prism/commit/056fa70773e97ad7ace3ee6c6d3c11df0aa0d525))
* edit EQ bands directly on the graph ([244532c](https://github.com/soundor/prism/commit/244532c16281a8d531eff6b65ba64f7add5a6898))
* filter the audio with the bands, as the graph draws them ([00afc8d](https://github.com/soundor/prism/commit/00afc8db705d28251d793e589e832cc782f32215))
* meter the output in the processor, and show it ([f89a8a4](https://github.com/soundor/prism/commit/f89a8a43b83d2d42f68122a2eb85fad31f1ff2d9))
* name the EQ curve in the graph's legend ([f0ba953](https://github.com/soundor/prism/commit/f0ba95369e80627e4d071fec369fe1bcadc381ba))
* refine spectrum styling and analyzer controls ([3ef0344](https://github.com/soundor/prism/commit/3ef0344b6a95baa7a2ca10f79f2d18ef6a8131cc))
* route, solo and smooth the bands, with input and output gain ([dbcdb35](https://github.com/soundor/prism/commit/dbcdb35f7124c8f6f9488a376bbe4e2bc4cc9fcc))
* scaffold Soundor Prism equalizer ([a5ba675](https://github.com/soundor/prism/commit/a5ba67533b93a0f1544bbf8413eefd9e6511eab5))
* select bands and edit them in the strip and inspector ([c0839c9](https://github.com/soundor/prism/commit/c0839c91f65a16cd42cb4007c1fcbef0194ae084))
* select bands in the strip as files, and say Full at 24 ([4cabf18](https://github.com/soundor/prism/commit/4cabf1842be2020289192fc6f6a779662a0e5228))
* show the host's track and the sample rate in the footer ([cc10628](https://github.com/soundor/prism/commit/cc106287124d1bfb1908c7298437593cd4a04323))
* **website:** add downloads, changelog, and footer ([5b218ca](https://github.com/soundor/prism/commit/5b218cab82b7d812624874cb4a3996e8b142994f))
* wire Prism releases and versioned downloads ([1788a84](https://github.com/soundor/prism/commit/1788a84aee045f08bbc2c398be2538f7ce1e306d))


### Bug Fixes

* blend the spectrogram ramp in OKLab ([8340507](https://github.com/soundor/prism/commit/83405075f865735e3d46328c12748ed651a6a10f))
* **ci:** generate the Rust SDK before checking formatting ([7e58fee](https://github.com/soundor/prism/commit/7e58fee8dec475f4aacdbf348effd037a38a9fb7))
* colour the spectrogram over the analyzer's floor to 0 dBFS ([40205ff](https://github.com/soundor/prism/commit/40205fffc2a2be39de85632e5fd3ad0a3ef279f3))
* draw the graph to the frame with clear axis labels ([0190040](https://github.com/soundor/prism/commit/01900404430c0aead857e3789a24eb1a99e30f12))
* exclude offscreen bands from graph drags ([31f2246](https://github.com/soundor/prism/commit/31f2246907107fb58e833f2f9e53ff8f666d0a3c))
* give the spectrogram a brighter sequential purple ramp ([d44a268](https://github.com/soundor/prism/commit/d44a26883ec19b53690f06e60dd3a8bf04cca4ab))
* keep graph coordinates stable at narrow gain ranges ([8acae13](https://github.com/soundor/prism/commit/8acae13c69b5e532b9c181c0d396cff499723ce8))
* keep plot coordinates stable when markers disappear ([b45dbb8](https://github.com/soundor/prism/commit/b45dbb8e6fe4917aa43d22ebf66ec1ec602972ac))
* name the graph's keys and announce the inspector's toggles ([3dc47c8](https://github.com/soundor/prism/commit/3dc47c8b1047c25776dd767857826cb29442e7f5))


### Performance Improvements

* cut React renders and JS work in the plugin UI ([68032da](https://github.com/soundor/prism/commit/68032daf514b441f7cbfceb868cd308e7b436de4))

## Changelog

## Unreleased

- Add a four-band equalizer: a 100 Hz low shelf, bells at 400 Hz and 2 kHz, and an 8 kHz high shelf.
- Boost or cut each band by up to 12 dB and compare with the original audio without losing settings.
- Try the EQ in the browser with a synth loop or an audio file from your device.
