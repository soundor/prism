//! The engine: routing, solo, gains, bypass, and changes that must not click.

use prism::engine::{Channel, Engine, Settings};
use prism::filter::{Design, FilterType, NEUTRAL_Q, Shape, Slope, State};
use prism::{BANDS, BandParameters};

const RATE: f64 = 48_000.0;
const BLOCK: usize = 256;

/// What a block is processed with: the slots, bypass, and the input and
/// output gain.
#[derive(Clone, Copy)]
struct Block {
    bands: [BandParameters; BANDS],
    bypass: bool,
    input_gain: f64,
    output_gain: f64,
}

impl Default for Block {
    fn default() -> Self {
        Self {
            bands: [BandParameters::default(); BANDS],
            bypass: false,
            input_gain: 0.0,
            output_gain: 0.0,
        }
    }
}

fn band(filter_type: FilterType, frequency: f64, gain: f64, q: f64) -> BandParameters {
    BandParameters {
        active: true,
        enabled: true,
        shape: Shape {
            filter_type,
            frequency,
            gain,
            q,
            slope: Slope::Db12,
        },
        ..BandParameters::default()
    }
}

fn bell(frequency: f64, gain: f64) -> BandParameters {
    band(FilterType::Bell, frequency, gain, 1.0)
}

fn sine(frequency: f64, frames: usize, phase: f64) -> Vec<f32> {
    (0..frames)
        .map(|i| {
            (0.25 * (std::f64::consts::TAU * frequency * i as f64 / RATE + phase).sin()) as f32
        })
        .collect()
}

/// Runs `left` and `right` (or `left` alone, mono) through an engine in
/// blocks, each block's settings from `at`.
fn render(
    at: impl Fn(usize) -> Block,
    left: &[f32],
    right: Option<&[f32]>,
) -> (Vec<f32>, Vec<f32>) {
    fn settings(block: &Block) -> Settings<'_> {
        Settings {
            bands: &block.bands,
            bypass: block.bypass,
            input_gain: block.input_gain,
            output_gain: block.output_gain,
        }
    }
    let first = at(0);
    let mut engine = Engine::new(RATE, &settings(&first));
    let mut l = left.to_vec();
    let mut r = right.map(<[f32]>::to_vec);
    for (index, start) in (0..left.len()).step_by(BLOCK).enumerate() {
        let end = (start + BLOCK).min(left.len());
        let block = at(index);
        engine.process(
            &settings(&block),
            &mut l[start..end],
            r.as_mut().map(|r| &mut r[start..end]),
        );
    }
    (l, r.unwrap_or_default())
}

fn rms(samples: &[f32]) -> f64 {
    let sum: f64 = samples.iter().map(|&s| f64::from(s).powi(2)).sum();
    (sum / samples.len() as f64).sqrt()
}

/// The gain, in dB, from `input` to `output`, over their second halves.
fn gain(input: &[f32], output: &[f32]) -> f64 {
    let half = input.len() / 2;
    20.0 * (rms(&output[half..]) / rms(&input[half..])).log10()
}

fn assert_db(got: f64, expected: f64, what: &str) {
    assert!(
        (got - expected).abs() < 0.05,
        "{what}: {got:.3} dB, expected {expected:.3} dB"
    );
}

/// Steady settings, a stereo sine at `frequency` in: the gain of each
/// channel. `anti` puts the right channel out of phase with the left, so
/// the signal is all side.
fn stereo_gain(block: Block, frequency: f64, anti: bool) -> (f64, f64) {
    let left = sine(frequency, RATE as usize, 0.0);
    let right: Vec<f32> = left.iter().map(|&s| if anti { -s } else { s }).collect();
    let (l, r) = render(|_| block, &left, Some(&right));
    (gain(&left, &l), gain(&right, &r))
}

fn with(bands: &[(usize, BandParameters)]) -> Block {
    let mut block = Block::default();
    for &(slot, parameters) in bands {
        block.bands[slot] = parameters;
    }
    block
}

#[test]
fn a_band_filters_the_channel_it_is_set_to() {
    let on = |channel| {
        with(&[(
            0,
            BandParameters {
                channel,
                ..bell(1000.0, 12.0)
            },
        )])
    };
    let (l, r) = stereo_gain(on(Channel::Left), 1000.0, false);
    assert_db(l, 12.0, "left band, left");
    assert_db(r, 0.0, "left band, right");
    let (l, r) = stereo_gain(on(Channel::Right), 1000.0, false);
    assert_db(l, 0.0, "right band, left");
    assert_db(r, 12.0, "right band, right");
    // The same sine in both channels is all mid, and none of it side.
    let (l, r) = stereo_gain(on(Channel::Mid), 1000.0, false);
    assert_db(l, 12.0, "mid band, mid signal");
    assert_db(r, 12.0, "mid band, mid signal");
    let (l, r) = stereo_gain(on(Channel::Side), 1000.0, false);
    assert_db(l, 0.0, "side band, mid signal");
    assert_db(r, 0.0, "side band, mid signal");
    let (l, r) = stereo_gain(on(Channel::Side), 1000.0, true);
    assert_db(l, 12.0, "side band, side signal");
    assert_db(r, 12.0, "side band, side signal");
    let (l, r) = stereo_gain(on(Channel::Mid), 1000.0, true);
    assert_db(l, 0.0, "mid band, side signal");
    assert_db(r, 0.0, "mid band, side signal");
}

#[test]
fn a_mono_signal_is_filtered_as_both_channels_alike() {
    let input = sine(1000.0, RATE as usize, 0.0);
    for (channel, expected) in [
        (Channel::Stereo, 12.0),
        (Channel::Left, 12.0),
        (Channel::Mid, 12.0),
        // Mono has no side, and is heard as the left channel.
        (Channel::Side, 0.0),
        (Channel::Right, 0.0),
    ] {
        let block = with(&[(
            0,
            BandParameters {
                channel,
                ..bell(1000.0, 12.0)
            },
        )]);
        let (out, _) = render(|_| block, &input, None);
        assert_db(gain(&input, &out), expected, &format!("{channel:?}"));
    }
}

#[test]
fn input_and_output_gain_add_up() {
    let block = Block {
        input_gain: -6.0,
        output_gain: 9.0,
        ..with(&[(0, bell(1000.0, 4.0))])
    };
    let (l, r) = stereo_gain(block, 1000.0, false);
    assert_db(l, 7.0, "left");
    assert_db(r, 7.0, "right");
}

#[test]
fn solo_plays_the_part_a_band_shapes() {
    let soloed = |parameters: BandParameters| {
        with(&[
            (0, bell(100.0, -12.0)),
            (
                5,
                BandParameters {
                    solo: true,
                    ..parameters
                },
            ),
        ])
    };
    // A bell is heard as a band pass at its frequency and Q, at 0 dB.
    let bell = soloed(band(FilterType::Bell, 2000.0, 9.0, 4.0));
    assert_db(
        stereo_gain(bell, 2000.0, false).0,
        0.0,
        "bell, at its centre",
    );
    assert!(stereo_gain(bell, 200.0, false).0 < -24.0);
    // A low shelf is heard under its frequency, a high cut above it.
    let shelf = soloed(band(FilterType::LowShelf, 2000.0, 6.0, NEUTRAL_Q));
    assert!(stereo_gain(shelf, 200.0, false).0.abs() < 0.1);
    assert!(stereo_gain(shelf, 16_000.0, false).0 < -30.0);
    let cut = soloed(band(FilterType::HighCut, 2000.0, 0.0, NEUTRAL_Q));
    assert!(stereo_gain(cut, 16_000.0, false).0.abs() < 0.1);
    assert!(stereo_gain(cut, 200.0, false).0 < -30.0);
    // A band that is off can't be soloed.
    let off = with(&[(
        0,
        BandParameters {
            solo: true,
            enabled: false,
            ..band(FilterType::Bell, 2000.0, 9.0, 4.0)
        },
    )]);
    assert_db(
        stereo_gain(off, 200.0, false).0,
        0.0,
        "solo on a band that is off",
    );
}

#[test]
fn a_soloed_left_band_leaves_the_right_channel_silent() {
    let block = with(&[(
        0,
        BandParameters {
            solo: true,
            channel: Channel::Left,
            ..bell(1000.0, 6.0)
        },
    )]);
    let (l, r) = stereo_gain(block, 1000.0, false);
    assert_db(l, 0.0, "left");
    assert!(r < -100.0, "right: {r:.1} dB");
}

#[test]
fn bypass_takes_precedence_over_solo_and_gain() {
    let block = Block {
        bypass: true,
        input_gain: 6.0,
        ..with(&[(
            0,
            BandParameters {
                solo: true,
                ..bell(1000.0, 6.0)
            },
        )])
    };
    let input = sine(300.0, 4096, 0.0);
    let (l, r) = render(|_| block, &input, Some(&input));
    assert_eq!(l, input);
    assert_eq!(r, input);
}

/// The loudest high-frequency content in `samples` from `from` on: a
/// click shows up there, a low sine does not.
fn click(samples: &[f32], from: usize) -> f64 {
    let shape = Shape {
        filter_type: FilterType::LowCut,
        frequency: 8000.0,
        slope: Slope::Db48,
        ..Shape::default()
    };
    let design = Design::new(&shape, RATE);
    let mut state = State::default();
    samples
        .iter()
        .enumerate()
        .map(|(i, &s)| (i, design.tick(&mut state, f64::from(s))))
        .filter(|&(i, _)| i >= from)
        .fold(0.0, |peak, (_, y)| peak.max(y.abs()))
}

/// A 150 Hz sine, `before` for the first 40 blocks and `after` from then
/// on: how loud a click the change makes, in dBFS.
fn change(before: Block, after: Block) -> f64 {
    let input = sine(150.0, 80 * BLOCK, 0.3);
    let (l, r) = render(
        |i| if i < 40 { before } else { after },
        &input,
        Some(&input),
    );
    let from = 30 * BLOCK;
    20.0 * click(&l, from).max(click(&r, from)).max(1e-12).log10()
}

#[test]
fn changes_do_not_click() {
    let base = bell(150.0, 12.0);
    let cases: [(&str, Block, Block); 10] = [
        ("gain", with(&[(0, base)]), with(&[(0, bell(150.0, -12.0))])),
        (
            "frequency",
            with(&[(0, base)]),
            with(&[(0, bell(600.0, 12.0))]),
        ),
        (
            "Q",
            with(&[(0, base)]),
            with(&[(0, band(FilterType::Bell, 150.0, 12.0, 8.0))]),
        ),
        (
            "on/off",
            with(&[(0, base)]),
            with(&[(
                0,
                BandParameters {
                    enabled: false,
                    ..base
                },
            )]),
        ),
        ("added", Block::default(), with(&[(0, base)])),
        (
            "type",
            with(&[(0, base)]),
            with(&[(0, band(FilterType::LowShelf, 150.0, 12.0, 1.0))]),
        ),
        (
            "channel",
            with(&[(0, base)]),
            with(&[(
                0,
                BandParameters {
                    channel: Channel::Side,
                    ..base
                },
            )]),
        ),
        (
            "solo",
            with(&[(0, base)]),
            with(&[(0, BandParameters { solo: true, ..base })]),
        ),
        (
            "bypass",
            with(&[(0, base)]),
            Block {
                bypass: true,
                ..with(&[(0, base)])
            },
        ),
        (
            "output gain",
            with(&[(0, base)]),
            Block {
                output_gain: -18.0,
                ..with(&[(0, base)])
            },
        ),
    ];
    // The sine is at -12 dBFS. Made at once, the changes put -20 to
    // -63 dBFS above 8 kHz (a jump in frequency alone, around -71 dBFS:
    // the state variable form rides it out); smoothed, all of them stay
    // under -75 dBFS.
    for (what, before, after) in cases {
        let click = change(before, after);
        assert!(click < -70.0, "{what}: a click at {click:.1} dBFS");
    }
}
