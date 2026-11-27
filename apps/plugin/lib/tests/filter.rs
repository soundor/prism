//! The band filters, against their own responses and the graph's.

use prism::filter::{Design, FilterType, Shape, Slope, State};

const RATES: [f64; 4] = [44_100.0, 48_000.0, 96_000.0, 192_000.0];

fn shapes() -> Vec<Shape> {
    let mut shapes = Vec::new();
    for filter_type in [
        FilterType::Bell,
        FilterType::LowShelf,
        FilterType::HighShelf,
        FilterType::Notch,
        FilterType::BandPass,
    ] {
        for (frequency, gain, q) in [(40.0, 9.0, 0.5), (1000.0, -12.0, 4.0), (9000.0, 6.0, 0.9)] {
            shapes.push(Shape {
                filter_type,
                frequency,
                gain,
                q,
                ..Shape::default()
            });
        }
    }
    for filter_type in [FilterType::LowCut, FilterType::HighCut] {
        for slope in [
            Slope::Db6,
            Slope::Db12,
            Slope::Db24,
            Slope::Db36,
            Slope::Db48,
        ] {
            shapes.push(Shape {
                filter_type,
                frequency: 300.0,
                q: 1.4,
                slope,
                ..Shape::default()
            });
        }
    }
    shapes
}

/// The response measured from the impulse response, by the DFT at
/// `frequency`.
fn measured(design: &Design, frequency: f64, sample_rate: f64) -> f64 {
    let mut state = State::default();
    let w = std::f64::consts::TAU * frequency / sample_rate;
    let (mut re, mut im) = (0.0, 0.0);
    for n in 0..(sample_rate as usize) {
        let h = design.tick(&mut state, if n == 0 { 1.0 } else { 0.0 });
        re += h * (w * n as f64).cos();
        im -= h * (w * n as f64).sin();
    }
    10.0 * (re * re + im * im).log10()
}

#[test]
fn the_filter_runs_as_its_response_says() {
    for shape in shapes() {
        for rate in [44_100.0, 96_000.0] {
            let design = Design::new(&shape, rate);
            for frequency in [30.0, 300.0, 1000.0, 5000.0, 15_000.0] {
                let expected = design.response(frequency, rate).0;
                if expected < -80.0 {
                    continue;
                }
                let got = measured(&design, frequency, rate);
                assert!(
                    (got - expected).abs() < 0.01,
                    "{shape:?} at {rate} Hz, {frequency} Hz: ran {got:.3} dB, response {expected:.3} dB"
                );
            }
        }
    }
}

/// The graph's own numbers, computed by `src/graph/response.ts` at its
/// 96 kHz; `src/graph/__tests__/response-fixture.spec.ts` writes them.
#[rustfmt::skip] // Written by the spec, and compared as written.
#[path = "fixtures/filter_response.rs"]
mod fixture;

#[test]
fn a_band_sounds_as_the_graph_draws_it() {
    for case in fixture::CASES {
        let shape = Shape {
            filter_type: FilterType::from_index(case.filter_type),
            frequency: case.frequency,
            gain: case.gain,
            q: case.q,
            slope: Slope::from_index(case.slope),
        };
        let design = Design::new(&shape, fixture::SAMPLE_RATE);
        for (frequency, expected) in fixture::FREQUENCIES.iter().zip(case.decibels) {
            let got = design.response(*frequency, fixture::SAMPLE_RATE).0;
            if *expected < -100.0 {
                assert!(got < -99.0, "{shape:?} at {frequency} Hz: {got:.3} dB");
                continue;
            }
            assert!(
                (got - expected).abs() < 0.005,
                "{shape:?} at {frequency} Hz: {got:.4} dB, the graph draws {expected:.4} dB"
            );
        }
    }
}

#[test]
fn a_cut_falls_at_its_slope() {
    for (slope, decibels) in [
        (Slope::Db6, 6.0),
        (Slope::Db12, 12.0),
        (Slope::Db24, 24.0),
        (Slope::Db36, 36.0),
        (Slope::Db48, 48.0),
    ] {
        let shape = Shape {
            filter_type: FilterType::LowCut,
            frequency: 2000.0,
            slope,
            ..Shape::default()
        };
        let design = Design::new(&shape, 96_000.0);
        let fall = design.response(200.0, 96_000.0).0 - design.response(100.0, 96_000.0).0;
        assert!((fall - decibels).abs() < 0.2, "{slope:?}: {fall:.2} dB/oct");
    }
}

#[test]
fn a_band_above_nyquist_stays_stable() {
    for rate in RATES {
        for shape in shapes() {
            let shape = Shape {
                frequency: 30_000.0,
                ..shape
            };
            let design = Design::new(&shape, rate);
            let mut state = State::default();
            let peak = (0..rate as usize)
                .map(|n| design.tick(&mut state, if n % 64 == 0 { 1.0 } else { 0.0 }))
                .fold(0.0f64, |m, y| m.max(y.abs()));
            assert!(
                peak.is_finite() && peak < 100.0,
                "{shape:?} at {rate}: {peak}"
            );
        }
    }
}
