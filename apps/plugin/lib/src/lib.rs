pub mod engine;
pub mod filter;

use engine::{Channel, Engine, Settings};
use filter::{FilterType, Shape, Slope};
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
    pub channel: Channel,
    pub solo: bool,
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
        ($($active:ident $enabled:ident $kind:ident $frequency:ident $gain:ident $q:ident $slope:ident $channel:ident $solo:ident;)*) => {
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
                channel: Channel::from_index(p.$channel.index()),
                solo: p.$solo,
            }),*]
        };
    }
    slots! {
        band1_active band1_enabled band1_type band1_frequency band1_gain band1_q band1_slope band1_channel band1_solo;
        band2_active band2_enabled band2_type band2_frequency band2_gain band2_q band2_slope band2_channel band2_solo;
        band3_active band3_enabled band3_type band3_frequency band3_gain band3_q band3_slope band3_channel band3_solo;
        band4_active band4_enabled band4_type band4_frequency band4_gain band4_q band4_slope band4_channel band4_solo;
        band5_active band5_enabled band5_type band5_frequency band5_gain band5_q band5_slope band5_channel band5_solo;
        band6_active band6_enabled band6_type band6_frequency band6_gain band6_q band6_slope band6_channel band6_solo;
        band7_active band7_enabled band7_type band7_frequency band7_gain band7_q band7_slope band7_channel band7_solo;
        band8_active band8_enabled band8_type band8_frequency band8_gain band8_q band8_slope band8_channel band8_solo;
        band9_active band9_enabled band9_type band9_frequency band9_gain band9_q band9_slope band9_channel band9_solo;
        band10_active band10_enabled band10_type band10_frequency band10_gain band10_q band10_slope band10_channel band10_solo;
        band11_active band11_enabled band11_type band11_frequency band11_gain band11_q band11_slope band11_channel band11_solo;
        band12_active band12_enabled band12_type band12_frequency band12_gain band12_q band12_slope band12_channel band12_solo;
        band13_active band13_enabled band13_type band13_frequency band13_gain band13_q band13_slope band13_channel band13_solo;
        band14_active band14_enabled band14_type band14_frequency band14_gain band14_q band14_slope band14_channel band14_solo;
        band15_active band15_enabled band15_type band15_frequency band15_gain band15_q band15_slope band15_channel band15_solo;
        band16_active band16_enabled band16_type band16_frequency band16_gain band16_q band16_slope band16_channel band16_solo;
        band17_active band17_enabled band17_type band17_frequency band17_gain band17_q band17_slope band17_channel band17_solo;
        band18_active band18_enabled band18_type band18_frequency band18_gain band18_q band18_slope band18_channel band18_solo;
        band19_active band19_enabled band19_type band19_frequency band19_gain band19_q band19_slope band19_channel band19_solo;
        band20_active band20_enabled band20_type band20_frequency band20_gain band20_q band20_slope band20_channel band20_solo;
        band21_active band21_enabled band21_type band21_frequency band21_gain band21_q band21_slope band21_channel band21_solo;
        band22_active band22_enabled band22_type band22_frequency band22_gain band22_q band22_slope band22_channel band22_solo;
        band23_active band23_enabled band23_type band23_frequency band23_gain band23_q band23_slope band23_channel band23_solo;
        band24_active band24_enabled band24_type band24_frequency band24_gain band24_q band24_slope band24_channel band24_solo;
    }
}

fn settings<'a>(p: &Parameters, bands: &'a [BandParameters; BANDS]) -> Settings<'a> {
    Settings {
        bands,
        bypass: p.bypass,
        input_gain: f64::from(p.input_gain),
        output_gain: f64::from(p.output_gain),
    }
}

/// Prism's processor: the [`Engine`] over the main bus's first two channels,
/// or its only one.
#[derive(Default)]
pub struct PluginProcessor {
    engine: Option<Engine>,
}

impl Processor for PluginProcessor {
    fn prepare(&mut self, ctx: &PrepareContext) {
        let bands = band_parameters(ctx.params);
        self.engine = Some(Engine::new(ctx.sample_rate, &settings(ctx.params, &bands)));
    }

    fn process(&mut self, ctx: &mut ProcessContext) {
        let Some(engine) = &mut self.engine else {
            return;
        };
        let bands = band_parameters(ctx.params);
        let settings = settings(ctx.params, &bands);
        let mut channels = ctx.audio.channels();
        if let Some(left) = channels.next() {
            engine.process(&settings, left, channels.next());
        }
    }

    fn reset(&mut self) {
        if let Some(engine) = &mut self.engine {
            engine.reset();
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
    fn input_and_output_gain_apply() {
        let gains = [("inputGain", -6.0), ("outputGain", 2.5)];
        assert_close(&gain_at(&gains, 440.0), -3.5, 0.01);
    }

    #[test]
    fn a_mono_bus_is_filtered() {
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .sample_rate(RATE)
            .block_size(256)
            .channels(1)
            .parameter("band1Active", 1.0)
            .parameter("band1Gain", -12.0)
            .build();
        let input = sine(1000.0, RATE as usize);
        let output = processor.process(&[&input]);
        let half = input.len() / 2;
        let gain = 20.0 * (rms(&output[0][half..]) / rms(&input[half..])).log10();
        assert!((gain + 12.0).abs() < 0.05, "{gain:.3} dB");
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
