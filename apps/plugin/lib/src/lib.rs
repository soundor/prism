use soundor::prelude::*;
// The filters will be built on fundsp and the analyzer on rustfft; until then
// only the tests use them, so this keeps the dependencies from being unused.
use fundsp as _;
use rustfft as _;

/// Prism's processor. The band, bypass and gain parameters are declared, but
/// the audio is not processed yet: every block passes through unchanged.
#[derive(Default)]
pub struct PluginProcessor;

impl Processor for PluginProcessor {
    fn prepare(&mut self, _ctx: &PrepareContext) {}

    fn process(&mut self, _ctx: &mut ProcessContext) {}

    fn reset(&mut self) {}
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
    use soundor::testing::TestProcessor;

    fn signal(frames: usize, phase: f32) -> Vec<f32> {
        (0..frames)
            .map(|i| (i as f32 * 0.05 + phase).sin() * 0.5)
            .collect()
    }

    #[test]
    fn passes_audio_through_unchanged() {
        let input = [signal(1024, 0.0), signal(1024, 1.0)];
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .sample_rate(48_000.0)
            .block_size(256)
            .channels(2)
            .parameter("band1Active", 1.0)
            .parameter("band1Gain", 12.0)
            .parameter("inputGain", -6.0)
            .build();
        assert_eq!(processor.process(&input), input);
    }

    #[test]
    fn bypass_passes_audio_through_unchanged() {
        let input = [signal(512, 0.3), signal(512, 2.0)];
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .channels(2)
            .parameter("bypass", 1.0)
            .build();
        assert_eq!(processor.process(&input), input);
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
