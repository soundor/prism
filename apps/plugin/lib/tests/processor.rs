//! The processor as a host runs it, through soundor's test harness.

use prism::PluginProcessor;
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

#[test]
fn the_meter_reads_the_output_peak_of_each_channel() {
    let mut processor = TestProcessor::<PluginProcessor>::new()
        .sample_rate(RATE)
        .block_size(256)
        .channels(2)
        .parameter("outputGain", -6.0)
        .build();
    let left = vec![0.5f32; 1024];
    let right = vec![0.0f32; 1024];
    processor.process(&[&left, &right]);
    let levels = processor
        .stream_buffer::<f32>("outputLevels")
        .expect("levels published");
    // 0.5 is -6 dBFS, and the output gain takes 6 dB more.
    assert!((levels[0] - -12.0).abs() < 0.05, "{levels:?}");
    assert_eq!(levels[1], -120.0);
}

#[test]
fn a_mono_meter_shows_its_one_channel_on_both_sides() {
    let mut processor = TestProcessor::<PluginProcessor>::new()
        .sample_rate(RATE)
        .channels(1)
        .build();
    processor.process(&[&[0.25f32; 512]]);
    let levels = processor.stream_buffer::<f32>("outputLevels").unwrap();
    assert_eq!(levels[0], levels[1]);
    assert!((levels[0] - -12.04).abs() < 0.01, "{levels:?}");
}
