//! What a host may throw at the processor: another sample rate, blocks of
//! any size, a broken sample, long silence, and automation of everything at
//! once.

use prism::PluginProcessor;
use soundor::testing::TestProcessor;

const RATE: f64 = 48_000.0;

fn sine(frequency: f64, rate: f64, frames: usize) -> Vec<f32> {
    (0..frames)
        .map(|i| (0.25 * (std::f64::consts::TAU * frequency * i as f64 / rate).sin()) as f32)
        .collect()
}

fn rms(samples: &[f32]) -> f64 {
    let sum: f64 = samples.iter().map(|&s| f64::from(s).powi(2)).sum();
    (sum / samples.len() as f64).sqrt()
}

/// A small, repeatable random number generator: xorshift64*.
struct Random(u64);

impl Random {
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        (self.0.wrapping_mul(0x2545_f491_4f6c_dd1d) >> 11) as f64 / (1u64 << 53) as f64
    }

    fn below(&mut self, n: usize) -> f64 {
        (self.next() * n as f64).floor()
    }
}

fn bell() -> TestProcessor<PluginProcessor> {
    TestProcessor::<PluginProcessor>::new()
        .sample_rate(RATE)
        .block_size(512)
        .channels(2)
        .parameter("band1Active", 1.0)
        .parameter("band1Gain", 12.0)
        .parameter("band1Frequency", 1000.0)
        .build()
}

#[test]
fn a_bell_keeps_its_gain_at_every_sample_rate_it_is_prepared_for() {
    let mut processor = bell();
    for rate in [44_100.0, 96_000.0, 192_000.0, 22_050.0] {
        processor.prepare(rate, 512);
        let input = sine(1000.0, rate, rate as usize / 2);
        let output = processor.process(&[&input, &input]);
        let half = input.len() / 2;
        let gain = 20.0 * (rms(&output[0][half..]) / rms(&input[half..])).log10();
        assert!((gain - 12.0).abs() < 0.05, "{rate} Hz: {gain:.3} dB");
    }
}

#[test]
fn the_output_does_not_depend_on_the_block_size() {
    let input = sine(440.0, RATE, 9_000);
    let mut outputs = Vec::new();
    for block in [1, 7, 64, 333, 4096] {
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .sample_rate(RATE)
            .block_size(block)
            .channels(2)
            .parameter("band1Active", 1.0)
            .parameter("band1Gain", -9.0)
            .parameter("band2Active", 1.0)
            .parameter("band2Type", 3.0) // low cut
            .parameter("band2Slope", 4.0) // 48 dB/oct
            .parameter("band2Frequency", 300.0)
            .build();
        outputs.push(processor.process(&[&input, &input]));
    }
    for output in &outputs[1..] {
        assert_eq!(output, &outputs[0]);
    }
}

#[test]
fn an_empty_block_is_fine() {
    let mut processor = bell();
    let empty: [&[f32]; 2] = [&[], &[]];
    assert_eq!(processor.process(&empty), vec![Vec::<f32>::new(); 2]);
    assert!(!processor.has_failed());
}

#[test]
fn a_broken_sample_does_not_silence_the_bands_for_good() {
    let mut processor = bell();
    let mut input = sine(1000.0, RATE, 4800);
    input[100] = f32::NAN;
    input[200] = f32::INFINITY;
    processor.process(&[&input, &input]);
    let input = sine(1000.0, RATE, RATE as usize / 2);
    let output = processor.process(&[&input, &input]);
    assert!(output.iter().flatten().all(|s| s.is_finite()));
    let half = input.len() / 2;
    let gain = 20.0 * (rms(&output[0][half..]) / rms(&input[half..])).log10();
    assert!((gain - 12.0).abs() < 0.05, "{gain:.3} dB");
}

#[test]
fn silence_after_a_signal_decays_to_exact_zeros() {
    // Steep, resonant filters ring the longest.
    let mut processor = TestProcessor::<PluginProcessor>::new()
        .sample_rate(RATE)
        .block_size(512)
        .channels(2)
        .parameter("band1Active", 1.0)
        .parameter("band1Type", 4.0) // high cut
        .parameter("band1Slope", 4.0) // 48 dB/oct
        .parameter("band1Q", 10.0)
        .parameter("band2Active", 1.0)
        .parameter("band2Gain", 24.0)
        .parameter("band2Q", 30.0)
        .build();
    let input = sine(1000.0, RATE, 4800);
    processor.process(&[&input, &input]);
    let silence = vec![0.0f32; RATE as usize * 2];
    let output = processor.process(&[&silence, &silence]);
    let tail = &output[0][output[0].len() - 4800..];
    assert!(tail.iter().all(|&s| s == 0.0), "{:?}", &tail[..8]);
}

#[test]
fn automating_everything_at_once_stays_finite_and_bounded() {
    let mut processor = TestProcessor::<PluginProcessor>::new()
        .sample_rate(RATE)
        .block_size(128)
        .channels(2)
        .build();
    let mut random = Random(0x9e37_79b9_7f4a_7c15);
    let input = sine(220.0, RATE, 128);
    let mut peak = 0.0f32;
    for _ in 0..(RATE as usize * 5 / 128) {
        // A few changes a block, anywhere.
        for _ in 0..4 {
            let slot = 1 + random.below(24) as usize;
            let (field, value) = match random.below(10) as usize {
                0 => ("Active", random.below(2)),
                1 => ("Enabled", random.below(2)),
                2 => ("Type", random.below(7)),
                3 => ("Frequency", 10.0 * 3000f64.powf(random.next())),
                4 => ("Gain", 60.0 * random.next() - 30.0),
                5 => ("Q", 0.025 * 1600f64.powf(random.next())),
                6 => ("Slope", random.below(5)),
                7 => ("Channel", random.below(5)),
                8 => ("Solo", random.below(2)),
                _ => ("Gain", 0.0),
            };
            processor.set_parameter(&format!("band{slot}{field}"), value);
        }
        match random.below(40) as usize {
            0 => processor.set_parameter("bypass", random.below(2)),
            1 => processor.set_parameter("inputGain", 48.0 * random.next() - 24.0),
            2 => processor.set_parameter("outputGain", 48.0 * random.next() - 24.0),
            _ => {}
        }
        let output = processor.process(&[&input, &input]);
        for sample in output.iter().flatten() {
            assert!(sample.is_finite());
            peak = peak.max(sample.abs());
        }
    }
    assert!(!processor.has_failed());
    // 24 bands of up to +30 dB could in theory reach far higher; this guards
    // against a filter blowing up, not against loud settings.
    assert!(peak < 1e4, "peak {peak}");
}
