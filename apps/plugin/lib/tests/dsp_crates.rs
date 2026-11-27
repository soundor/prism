//! The two DSP crates the processor builds on, used together.

use fundsp::prelude32::bell_hz;
use rustfft::{FftPlanner, num_complex::Complex32};

/// The two DSP crates the filters and the analyzer will build on, used
/// together: a fundsp bell at +6 dB lifts a sine at its centre, as
/// rustfft measures it.
#[test]
fn fundsp_bell_lifts_a_sine_rustfft_measures() {
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
