//! The analyzer as the editor drives it: the controller hands the processor
//! the settings in state, and the processor publishes spectra.

use prism::analyzer::{GRID_POINTS, SILENCE, SPECTROGRAM_BINS};
use prism::{PluginController, PluginProcessor};
use soundor::NativeMethods;
use soundor::testing::{CountingAllocator, TestController, TestProcessor};

#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

const RATE: f64 = 48_000.0;

fn sine(frequency: f64, amplitude: f64, frames: usize) -> Vec<f32> {
    (0..frames)
        .map(|i| (amplitude * (std::f64::consts::TAU * frequency * i as f64 / RATE).sin()) as f32)
        .collect()
}

/// The grid point nearest `frequency`.
fn point(frequency: f64) -> usize {
    let position = (frequency / 10.0).ln() / 3000f64.ln() * (GRID_POINTS - 1) as f64;
    position.round() as usize
}

fn processor(parameters: &[(&str, f64)]) -> TestProcessor<PluginProcessor> {
    let mut builder = TestProcessor::<PluginProcessor>::new()
        .sample_rate(RATE)
        .block_size(256)
        .channels(2);
    for &(id, value) in parameters {
        builder = builder.parameter(id, value);
    }
    builder.build()
}

/// The editor opening with `state` (field, JSON value) set.
fn open(processor: &TestProcessor<PluginProcessor>, state: &[(&str, &str)]) {
    let controller = TestController::<PluginController>::for_processor(processor);
    for (field, json) in state {
        controller.host().set_state_json(field, json);
    }
    controller.task(|ctx| PluginController::analyze(ctx, true));
}

/// The pre and post spectra after `input` plays on both channels.
fn spectra(processor: &mut TestProcessor<PluginProcessor>, input: &[f32]) -> (Vec<f32>, Vec<f32>) {
    processor.process(&[input, input]);
    let mut spectrum = processor
        .stream_buffer::<f32>("spectrum")
        .expect("a spectrum");
    let post = spectrum.split_off(GRID_POINTS);
    (spectrum, post)
}

#[test]
fn a_full_scale_sine_reads_0_dbfs_at_its_frequency() {
    let mut processor = processor(&[]);
    open(&processor, &[("analyzerWindow", "\"flatTop\"")]);
    let (pre, post) = spectra(&mut processor, &sine(1000.0, 1.0, RATE as usize));
    let at = point(1000.0);
    for spectrum in [&pre, &post] {
        assert!(spectrum[at].abs() < 0.1, "{} dBFS", spectrum[at]);
        // Far from the tone, the flat top leaves nothing.
        assert!(spectrum[point(100.0)] < -80.0, "{}", spectrum[point(100.0)]);
    }
}

#[test]
fn every_window_and_size_finds_the_tone() {
    for window in ["hann", "blackmanHarris", "hamming", "flatTop"] {
        for size in ["fft2048", "fft4096", "fft8192", "fft16384"] {
            let mut processor = processor(&[]);
            let (window_json, size_json) = (format!("\"{window}\""), format!("\"{size}\""));
            open(
                &processor,
                &[
                    ("analyzerWindow", &window_json),
                    ("analyzerFftSize", &size_json),
                ],
            );
            let (pre, _) = spectra(&mut processor, &sine(3000.0, 0.5, RATE as usize / 2));
            let at = point(3000.0);
            // -6 dBFS, less at most a Hamming window's worst scalloping loss (1.75 dB).
            assert!(
                (-7.8..-5.9).contains(&pre[at]),
                "{window} {size}: {} dBFS",
                pre[at]
            );
            assert!(pre[at] > pre[point(300.0)] + 30.0, "{window} {size}");
        }
    }
}

#[test]
fn post_shows_the_eq_and_output_gain_and_pre_the_input_gain() {
    let mut processor = processor(&[
        ("band1Active", 1.0),
        ("band1Gain", 12.0),
        ("band1Frequency", 1000.0),
        ("inputGain", -6.0),
        ("outputGain", 3.0),
    ]);
    open(&processor, &[("analyzerWindow", "\"flatTop\"")]);
    let (pre, post) = spectra(&mut processor, &sine(1000.0, 0.5, RATE as usize));
    let at = point(1000.0);
    assert!((pre[at] - -12.0).abs() < 0.2, "pre {}", pre[at]);
    assert!((post[at] - pre[at] - 15.0).abs() < 0.2, "post {}", post[at]);
}

#[test]
fn nothing_is_analyzed_until_the_editor_asks() {
    let mut processor = processor(&[]);
    processor.process(&[sine(1000.0, 0.5, 9600), sine(1000.0, 0.5, 9600)]);
    assert!(processor.stream_buffer::<f32>("spectrum").is_none());
}

#[test]
fn nothing_is_analyzed_with_the_analyzer_off() {
    let mut processor = processor(&[]);
    open(&processor, &[("analyzerMode", "\"off\"")]);
    processor.process(&[sine(1000.0, 0.5, 9600), sine(1000.0, 0.5, 9600)]);
    assert!(processor.stream_buffer::<f32>("spectrum").is_none());
}

/// The spectrogram bin nearest `frequency`.
fn bin(frequency: f64) -> usize {
    ((frequency - 10.0) / (30_000.0 - 10.0) * (SPECTROGRAM_BINS - 1) as f64).round() as usize
}

#[test]
fn the_spectrogram_alone_is_measured_with_the_analyzer_off() {
    let mut processor = processor(&[]);
    open(
        &processor,
        &[("analyzerMode", "\"off\""), ("showSpectrogram", "true")],
    );
    let input = sine(1000.0, 0.5, 9600);
    processor.process(&[&input, &input]);
    assert!(processor.stream_buffer::<f32>("spectrum").is_none());
    let frame = processor
        .stream_buffer::<f32>("spectrogram")
        .expect("a frame");
    assert_eq!(frame.len(), SPECTROGRAM_BINS);
    let at = bin(1000.0);
    let level = frame[at - 1..=at + 1]
        .iter()
        .copied()
        .fold(SILENCE, f32::max);
    assert!(level > -8.0, "{level}");
    assert!(frame[bin(5000.0)] < -60.0, "{}", frame[bin(5000.0)]);
}

#[test]
fn the_spectrogram_has_the_ffts_resolution() {
    let mut processor = processor(&[]);
    open(
        &processor,
        &[
            ("showSpectrogram", "true"),
            ("analyzerFftSize", "\"fft16384\""),
        ],
    );
    // Two tones 30 Hz apart, at 5 kHz: one grid point of the spectrum
    // spans 125 Hz there, but a 16k FFT's bins are 2.9 Hz apart.
    let input: Vec<f32> = sine(5000.0, 0.25, 24_000)
        .iter()
        .zip(sine(5030.0, 0.25, 24_000))
        .map(|(a, b)| a + b)
        .collect();
    processor.process(&[&input, &input]);
    let frame = processor.stream_buffer::<f32>("spectrogram").unwrap();
    let (low, middle, high) = (frame[bin(5000.0)], frame[bin(5015.0)], frame[bin(5030.0)]);
    assert!(
        middle < low - 10.0 && middle < high - 10.0,
        "{low} {middle} {high}"
    );
}

#[test]
fn the_spectrogram_is_not_measured_while_hidden() {
    let mut processor = processor(&[]);
    open(&processor, &[]);
    let input = sine(1000.0, 0.5, 9600);
    processor.process(&[&input, &input]);
    assert!(processor.stream_buffer::<f32>("spectrum").is_some());
    assert!(processor.stream_buffer::<f32>("spectrogram").is_none());
}

#[test]
fn closing_the_editor_stops_the_analyzer() {
    let mut processor = processor(&[]);
    let controller = TestController::<PluginController>::for_processor(&processor);
    controller.task(|ctx| PluginController::analyze(ctx, true));
    let input = sine(1000.0, 0.5, 9600);
    processor.process(&[&input, &input]);
    let open = processor.stream_buffer::<f32>("spectrum");
    controller.task(|ctx| PluginController::analyze(ctx, false));
    processor.process(&[&input, &input]);
    assert_eq!(processor.stream_buffer::<f32>("spectrum"), open);
}

#[test]
fn silence_reads_as_silence() {
    let mut processor = processor(&[]);
    open(&processor, &[]);
    let (pre, post) = spectra(&mut processor, &vec![0.0; 9600]);
    assert!(pre.iter().chain(&post).all(|&db| db == SILENCE));
}

#[test]
fn spectra_come_about_60_times_a_second() {
    let mut processor = processor(&[]);
    open(&processor, &[]);
    let input = sine(440.0, 0.5, 256);
    let mut published = 0;
    let mut last = None;
    for _ in 0..(RATE as usize / 256) {
        processor.process(&[&input, &input]);
        let spectrum = processor.stream_buffer::<f32>("spectrum");
        if spectrum.is_some() && spectrum != last {
            published += 1;
            last = spectrum;
        }
    }
    assert!((55..=62).contains(&published), "{published}");
}

#[test]
fn analyzing_and_changing_its_settings_do_not_allocate() {
    let mut processor = processor(&[]);
    let controller = TestController::<PluginController>::for_processor(&processor);
    controller.task(|ctx| PluginController::analyze(ctx, true));
    let input = sine(440.0, 0.5, 4800);
    processor.process(&[&input, &input]);
    controller
        .host()
        .set_state_json("analyzerFftSize", "\"fft16384\"");
    controller
        .host()
        .set_state_json("analyzerWindow", "\"hamming\"");
    controller.task(|ctx| PluginController::analyze(ctx, true));
    let before = processor.allocations();
    processor.process(&[&input, &input]);
    assert_eq!(processor.allocations(), before);
}
