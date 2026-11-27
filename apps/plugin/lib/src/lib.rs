pub mod filter;

use filter::{Design, FilterType, Shape, Slope, State};
use soundor::prelude::*;
// The analyzer will be built on rustfft; until then only the tests use it,
// so this keeps the dependency from being unused.
use rustfft as _;

/// How many band slots soundor.config declares.
pub const BANDS: usize = 24;

/// One slot's parameters, read out of the block's [`Parameters`].
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct BandParameters {
    /// Whether the slot holds a band at all.
    pub active: bool,
    /// The band's own on/off: off, it stays in place but doesn't filter.
    pub enabled: bool,
    pub shape: Shape,
}

impl BandParameters {
    /// Whether the band filters the audio.
    pub fn audible(&self) -> bool {
        self.active && self.enabled
    }
}

/// Every slot's parameters. The generated [`Parameters`] has a field per
/// slot and setting, so the slots are listed out here.
pub fn band_parameters(p: &Parameters) -> [BandParameters; BANDS] {
    macro_rules! slots {
        ($($active:ident $enabled:ident $kind:ident $frequency:ident $gain:ident $q:ident $slope:ident;)*) => {
            [$(BandParameters {
                active: p.$active,
                enabled: p.$enabled,
                shape: Shape {
                    filter_type: FilterType::from_index(p.$kind.index()),
                    frequency: f64::from(p.$frequency),
                    gain: f64::from(p.$gain),
                    q: f64::from(p.$q),
                    slope: Slope::from_index(p.$slope.index()),
                },
            }),*]
        };
    }
    slots! {
        band1_active band1_enabled band1_type band1_frequency band1_gain band1_q band1_slope;
        band2_active band2_enabled band2_type band2_frequency band2_gain band2_q band2_slope;
        band3_active band3_enabled band3_type band3_frequency band3_gain band3_q band3_slope;
        band4_active band4_enabled band4_type band4_frequency band4_gain band4_q band4_slope;
        band5_active band5_enabled band5_type band5_frequency band5_gain band5_q band5_slope;
        band6_active band6_enabled band6_type band6_frequency band6_gain band6_q band6_slope;
        band7_active band7_enabled band7_type band7_frequency band7_gain band7_q band7_slope;
        band8_active band8_enabled band8_type band8_frequency band8_gain band8_q band8_slope;
        band9_active band9_enabled band9_type band9_frequency band9_gain band9_q band9_slope;
        band10_active band10_enabled band10_type band10_frequency band10_gain band10_q band10_slope;
        band11_active band11_enabled band11_type band11_frequency band11_gain band11_q band11_slope;
        band12_active band12_enabled band12_type band12_frequency band12_gain band12_q band12_slope;
        band13_active band13_enabled band13_type band13_frequency band13_gain band13_q band13_slope;
        band14_active band14_enabled band14_type band14_frequency band14_gain band14_q band14_slope;
        band15_active band15_enabled band15_type band15_frequency band15_gain band15_q band15_slope;
        band16_active band16_enabled band16_type band16_frequency band16_gain band16_q band16_slope;
        band17_active band17_enabled band17_type band17_frequency band17_gain band17_q band17_slope;
        band18_active band18_enabled band18_type band18_frequency band18_gain band18_q band18_slope;
        band19_active band19_enabled band19_type band19_frequency band19_gain band19_q band19_slope;
        band20_active band20_enabled band20_type band20_frequency band20_gain band20_q band20_slope;
        band21_active band21_enabled band21_type band21_frequency band21_gain band21_q band21_slope;
        band22_active band22_enabled band22_type band22_frequency band22_gain band22_q band22_slope;
        band23_active band23_enabled band23_type band23_frequency band23_gain band23_q band23_slope;
        band24_active band24_enabled band24_type band24_frequency band24_gain band24_q band24_slope;
    }
}

/// The channels Prism filters: left and right, or a mono channel alone.
const CHANNELS: usize = 2;

/// One slot's filter: its design, kept until the settings change, and each
/// channel's memory.
#[derive(Clone, Copy, Default)]
struct Band {
    shape: Option<Shape>,
    design: Option<Design>,
    states: [State; CHANNELS],
}

/// Prism's processor: every band that is in use and on filters both
/// channels, in slot order. Global bypass leaves the audio as it came.
///
/// Settings take effect at the start of each block, without smoothing, and
/// the channel, solo and input and output gain parameters are not applied
/// yet.
#[derive(Default)]
pub struct PluginProcessor {
    sample_rate: f64,
    bands: [Band; BANDS],
}

impl Processor for PluginProcessor {
    fn prepare(&mut self, ctx: &PrepareContext) {
        self.sample_rate = ctx.sample_rate;
        self.bands = Default::default();
    }

    fn process(&mut self, ctx: &mut ProcessContext) {
        if ctx.params.bypass {
            return;
        }
        let parameters = band_parameters(ctx.params);
        for (band, parameters) in self.bands.iter_mut().zip(&parameters) {
            if !parameters.audible() {
                // Started afresh when it's heard again.
                band.shape = None;
                band.design = None;
                continue;
            }
            if band.shape != Some(parameters.shape) {
                if band.shape.is_none() {
                    band.states = Default::default();
                }
                band.shape = Some(parameters.shape);
                band.design = Some(Design::new(&parameters.shape, self.sample_rate));
            }
        }
        for (channel, samples) in ctx.audio.channels().take(CHANNELS).enumerate() {
            for band in &mut self.bands {
                let (Some(design), state) = (&band.design, &mut band.states[channel]) else {
                    continue;
                };
                for sample in samples.iter_mut() {
                    *sample = design.tick(state, f64::from(*sample)) as f32;
                }
            }
        }
    }

    fn reset(&mut self) {
        for band in &mut self.bands {
            band.states = Default::default();
        }
    }
}

pub struct PluginController;

impl Controller for PluginController {
    type Local = ();
    type Shared = ();
}

soundor::export!(PluginProcessor, PluginController);

#[cfg(test)]
mod tests {
    use super::PluginProcessor;
    use soundor::testing::{CountingAllocator, TestProcessor};

    #[global_allocator]
    static ALLOCATOR: CountingAllocator = CountingAllocator;

    const RATE: f64 = 48_000.0;

    fn signal(frames: usize, phase: f32) -> Vec<f32> {
        (0..frames)
            .map(|i| (i as f32 * 0.05 + phase).sin() * 0.5)
            .collect()
    }

    fn sine(frequency: f64, frames: usize) -> Vec<f32> {
        (0..frames)
            .map(|i| (0.25 * (std::f64::consts::TAU * frequency * i as f64 / RATE).sin()) as f32)
            .collect()
    }

    fn rms(samples: &[f32]) -> f64 {
        let sum: f64 = samples.iter().map(|&s| f64::from(s) * f64::from(s)).sum();
        (sum / samples.len() as f64).sqrt()
    }

    /// The gain, in dB, a sine at `frequency` comes out with in each
    /// channel, measured over the second half of a second, once the filters
    /// have settled.
    fn gain_at(parameters: &[(&str, f64)], frequency: f64) -> Vec<f64> {
        let mut builder = TestProcessor::<PluginProcessor>::new()
            .sample_rate(RATE)
            .block_size(256)
            .channels(2);
        for &(id, value) in parameters {
            builder = builder.parameter(id, value);
        }
        let input = sine(frequency, RATE as usize);
        let output = builder.build().process(&[&input, &input]);
        let half = input.len() / 2;
        output
            .iter()
            .map(|channel| 20.0 * (rms(&channel[half..]) / rms(&input[half..])).log10())
            .collect()
    }

    fn assert_close(got: &[f64], expected: f64, tolerance: f64) {
        for (channel, gain) in got.iter().enumerate() {
            assert!(
                (gain - expected).abs() < tolerance,
                "channel {channel}: {gain:.3} dB, expected {expected:.3} dB"
            );
        }
    }

    #[test]
    fn passes_audio_through_unchanged_with_no_band_in_use() {
        let input = [signal(1024, 0.0), signal(1024, 1.0)];
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .sample_rate(RATE)
            .block_size(256)
            .channels(2)
            // A slot's settings without the slot in use.
            .parameter("band1Gain", 12.0)
            .build();
        assert_eq!(processor.process(&input), input);
    }

    #[test]
    fn a_bell_lifts_both_channels_by_its_gain() {
        let bell = [
            ("band1Active", 1.0),
            ("band1Gain", 12.0),
            ("band1Frequency", 1000.0),
        ];
        assert_close(&gain_at(&bell, 1000.0), 12.0, 0.05);
        assert_close(&gain_at(&bell, 50.0), 0.0, 0.1);
    }

    #[test]
    fn a_band_that_is_off_does_not_filter() {
        let off = [
            ("band1Active", 1.0),
            ("band1Enabled", 0.0),
            ("band1Gain", 12.0),
        ];
        assert_close(&gain_at(&off, 1000.0), 0.0, 1e-6);
    }

    #[test]
    fn bands_add_in_series() {
        let two = [
            ("band1Active", 1.0),
            ("band1Gain", 6.0),
            ("band7Active", 1.0),
            ("band7Gain", -9.0),
            ("band7Frequency", 1000.0),
            ("band7Type", 2.0), // high shelf
            ("band7Q", 0.707),
        ];
        // At its centre the shelf is half its gain.
        assert_close(&gain_at(&two, 1000.0), 6.0 - 4.5, 0.05);
    }

    #[test]
    fn a_steep_low_cut_removes_what_is_under_it() {
        let cut = [
            ("band3Active", 1.0),
            ("band3Type", 3.0), // low cut
            ("band3Frequency", 1000.0),
            ("band3Slope", 4.0), // 48 dB/oct
        ];
        assert_close(&gain_at(&cut, 10_000.0), 0.0, 0.05);
        assert!(gain_at(&cut, 250.0).iter().all(|&gain| gain < -90.0));
    }

    #[test]
    fn bypass_passes_audio_through_unchanged() {
        let input = [signal(512, 0.3), signal(512, 2.0)];
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .channels(2)
            .parameter("band1Active", 1.0)
            .parameter("band1Gain", 12.0)
            .parameter("bypass", 1.0)
            .build();
        assert_eq!(processor.process(&input), input);
    }

    #[test]
    fn processing_does_not_allocate() {
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .sample_rate(RATE)
            .block_size(256)
            .channels(2)
            .parameters(|p| {
                p.band1_active = true;
                p.band1_gain = 6.0;
                p.band2_active = true;
                p.band2_frequency = 200.0;
            })
            .build();
        let input = [signal(1024, 0.0), signal(1024, 1.0)];
        processor.process(&input);
        processor.parameters_mut().band1_frequency = 3000.0;
        processor.parameters_mut().band2_active = false;
        processor.process(&input);
        assert_eq!(processor.allocations(), 0);
    }

    /// The two DSP crates the filters and the analyzer will build on, used
    /// together: a fundsp bell at +6 dB lifts a sine at its centre, as
    /// rustfft measures it.
    #[test]
    fn fundsp_bell_lifts_a_sine_rustfft_measures() {
        use fundsp::prelude32::bell_hz;
        use rustfft::{FftPlanner, num_complex::Complex32};

        const SAMPLE_RATE: f32 = 48_000.0;
        const SIZE: usize = 4096;
        // On a bin exactly, so the unwindowed FFT puts the sine in it alone.
        const BIN: usize = 85;
        let frequency = BIN as f32 * SAMPLE_RATE / SIZE as f32;

        let mut bell = bell_hz(frequency, 1.0, 2.0);
        bell.set_sample_rate(SAMPLE_RATE as f64);
        let sine = |i: usize| (std::f32::consts::TAU * frequency * i as f32 / SAMPLE_RATE).sin();
        // One block to settle the filter, then the one that is measured.
        let mut buffer: Vec<Complex32> = (0..2 * SIZE)
            .map(|i| Complex32::new(bell.filter_mono(sine(i)), 0.0))
            .skip(SIZE)
            .collect();

        FftPlanner::new()
            .plan_fft_forward(SIZE)
            .process(&mut buffer);
        let amplitude = buffer[BIN].norm() * 2.0 / SIZE as f32;
        assert!((amplitude - 2.0).abs() < 0.01, "amplitude {amplitude}");
    }
}
