//! How much of one CPU core Prism takes at its heaviest: 24 steep bands, all
//! gliding, at 192 kHz in stereo, with the analyzer and the spectrogram at
//! the largest FFT. Ignored by default; run it optimized:
//!
//! ```sh
//! pnpm bench:rust
//! ```

use std::time::Instant;

use prism::{PluginController, PluginProcessor};
use soundor::NativeMethods;
use soundor::testing::{TestController, TestProcessor};

const RATE: f64 = 192_000.0;
const BLOCK: usize = 256;
const SECONDS: usize = 10;

#[test]
#[ignore = "a benchmark: run with `pnpm bench:rust`"]
fn heaviest_load() {
    let mut processor = TestProcessor::<PluginProcessor>::new()
        .sample_rate(RATE)
        .block_size(BLOCK)
        .channels(2)
        .build();
    for slot in 1..=24 {
        let band = |field: &str| format!("band{slot}{field}");
        processor.set_parameter(&band("Active"), 1.0);
        processor.set_parameter(&band("Type"), (slot % 7) as f64);
        processor.set_parameter(&band("Slope"), 4.0); // 48 dB/oct
        processor.set_parameter(&band("Channel"), (slot % 5) as f64);
        processor.set_parameter(&band("Gain"), 3.0);
    }
    let controller = TestController::<PluginController>::for_processor(&processor);
    for (field, json) in [
        ("analyzerFftSize", "\"fft16384\""),
        ("showSpectrogram", "true"),
    ] {
        controller.host().set_state_json(field, json);
    }
    controller.task(|ctx| PluginController::analyze(ctx, true));

    let input: Vec<f32> = (0..BLOCK)
        .map(|i| ((i as f32) * 0.37).sin() * 0.3)
        .collect();
    let blocks = SECONDS * RATE as usize / BLOCK;
    let start = Instant::now();
    for block in 0..blocks {
        // Every band always on its way somewhere: glides never settle.
        if block % 8 == 0 {
            for slot in 1..=24 {
                let t = (block + slot * 37) as f64 * 0.01;
                let frequency = 1000.0 * 8f64.powf(t.sin());
                processor.set_parameter(&format!("band{slot}Frequency"), frequency);
            }
        }
        processor.process(&[&input, &input]);
    }
    let elapsed = start.elapsed().as_secs_f64();
    let load = elapsed / SECONDS as f64;
    println!(
        "{SECONDS} s of 192 kHz stereo in {elapsed:.3} s: {:.1} % of one core",
        load * 100.0
    );
    assert!(load < 0.5, "{:.1} % of one core", load * 100.0);
}
