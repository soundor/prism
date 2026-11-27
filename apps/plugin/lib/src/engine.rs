//! The whole equalizer: 24 bands in slot order, each on its own channel, with
//! solo, input and output gain and bypass, every change smoothed so that
//! nothing clicks.
//!
//! - Frequency, gain and Q glide to a new setting (frequency and Q on a log
//!   scale), and the band's coefficients follow every [`CONTROL_FRAMES`]
//!   samples. The state variable stages take that without a click.
//! - A change a glide can't make (a band turned on or off, its type, slope or
//!   channel changed) fades the band out, switches it, and fades it back in.
//! - Solo plays the part of the spectrum the soloed band shapes; bypass and
//!   solo crossfade too.

use crate::filter::{Design, FilterType, NEUTRAL_Q, Ramp, Shape, Slope, State};
use crate::{BANDS, BandParameters};

/// How often, in samples, glides and fades are looked at and coefficients
/// recomputed.
pub const CONTROL_FRAMES: usize = 16;
/// How fast frequency, gain and Q glide: the time constant, in seconds.
const GLIDE_SECONDS: f64 = 0.015;
/// How long a band, solo or bypass takes to fade in or out, in seconds.
const FADE_SECONDS: f64 = 0.01;

/// The part of the signal a band filters.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Channel {
    #[default]
    Stereo,
    Left,
    Right,
    /// (L + R) / 2.
    Mid,
    /// (L - R) / 2.
    Side,
}

impl Channel {
    /// The channel at its index, in the order soundor.config declares them.
    pub fn from_index(index: u32) -> Self {
        match index {
            1 => Self::Left,
            2 => Self::Right,
            3 => Self::Mid,
            4 => Self::Side,
            _ => Self::Stereo,
        }
    }
}

/// What a band is, as opposed to its settings that glide.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Kind {
    filter_type: FilterType,
    slope: Slope,
    channel: Channel,
}

/// The settings that glide, on the scales they glide on.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
struct Glide {
    log_frequency: f64,
    gain: f64,
    log_q: f64,
}

impl Glide {
    fn of(shape: &Shape) -> Self {
        Self {
            log_frequency: shape.frequency.max(1.0).log2(),
            gain: shape.gain,
            log_q: shape.q.max(1e-3).log2(),
        }
    }

    /// One step toward `target`, by `amount` of the way, or all of it once
    /// close.
    fn approach(&mut self, target: &Self, amount: f64) {
        let near = (self.log_frequency - target.log_frequency).abs() < 1e-5
            && (self.gain - target.gain).abs() < 1e-4
            && (self.log_q - target.log_q).abs() < 1e-5;
        if near {
            *self = *target;
            return;
        }
        self.log_frequency += (target.log_frequency - self.log_frequency) * amount;
        self.gain += (target.gain - self.gain) * amount;
        self.log_q += (target.log_q - self.log_q) * amount;
    }

    fn shape(&self, kind: Kind) -> Shape {
        Shape {
            filter_type: kind.filter_type,
            frequency: self.log_frequency.exp2(),
            gain: self.gain,
            q: self.log_q.exp2(),
            slope: kind.slope,
        }
    }
}

/// A linear fade between 0 (out) and 1 (in), moved a sample at a time.
#[derive(Clone, Copy, Debug, Default)]
struct Fade {
    level: f64,
    target: f64,
    step: f64,
}

impl Fade {
    fn at(level: f64, sample_rate: f64) -> Self {
        Self {
            level,
            target: level,
            step: 1.0 / (FADE_SECONDS * sample_rate),
        }
    }

    #[inline]
    fn advance(&mut self) {
        if self.level < self.target {
            self.level = (self.level + self.step).min(self.target);
        } else if self.level > self.target {
            self.level = (self.level - self.step).max(self.target);
        }
    }

    /// Faded out, and staying so.
    fn is_out(&self) -> bool {
        self.level == 0.0 && self.target == 0.0
    }

    /// Faded all the way out, whatever comes next.
    fn is_silent(&self) -> bool {
        self.level == 0.0
    }
}

/// Runs `design` over the part of `(left, right)` that `channel` names, and
/// mixes the result in by `amount`. A mono signal comes as `left == right`.
#[inline]
fn route(
    design: &Design,
    states: &mut [State; 2],
    channel: Channel,
    amount: f64,
    replace: bool,
    (left, right): (f64, f64),
) -> (f64, f64) {
    // With `replace` (solo), what the band doesn't filter is silent; without
    // it, it is left as it was.
    let keep = if replace { 0.0 } else { 1.0 };
    let mix = |dry: f64, wet: f64| dry + amount * (wet - dry);
    match channel {
        Channel::Stereo => (
            mix(left, design.tick(&mut states[0], left)),
            mix(right, design.tick(&mut states[1], right)),
        ),
        Channel::Left => (
            mix(left, design.tick(&mut states[0], left)),
            mix(right, keep * right),
        ),
        Channel::Right => (
            mix(left, keep * left),
            mix(right, design.tick(&mut states[1], right)),
        ),
        Channel::Mid | Channel::Side => {
            let mid = 0.5 * (left + right);
            let side = 0.5 * (left - right);
            let (mid, side) = if channel == Channel::Mid {
                (
                    mix(mid, design.tick(&mut states[0], mid)),
                    mix(side, keep * side),
                )
            } else {
                (
                    mix(mid, keep * mid),
                    mix(side, design.tick(&mut states[0], side)),
                )
            };
            (mid + side, mid - side)
        }
    }
}

/// One slot as it plays.
#[derive(Clone, Copy, Default)]
struct Band {
    /// What the slot's parameters ask for.
    target: BandParameters,
    /// What the filter is, while it plays or fades.
    kind: Option<Kind>,
    glide: Glide,
    design: Option<Ramp>,
    states: [State; 2],
    fade: Fade,
}

impl Band {
    fn target_kind(&self) -> Kind {
        Kind {
            filter_type: self.target.shape.filter_type,
            slope: self.target.shape.slope,
            channel: self.target.channel,
        }
    }

    /// Starts afresh at the target settings, faded in to `level`.
    fn start(&mut self, sample_rate: f64, level: f64) {
        let kind = self.target_kind();
        self.kind = Some(kind);
        self.glide = Glide::of(&self.target.shape);
        self.design = Some(Ramp::new(Design::new(&self.glide.shape(kind), sample_rate)));
        self.states = Default::default();
        self.fade.level = level;
        self.fade.target = 1.0;
    }

    /// The control step: fades toward what the parameters ask for, glides
    /// toward their settings, and recomputes the coefficients if they moved.
    fn control(&mut self, sample_rate: f64, glide: f64) {
        let audible = self.target.audible();
        if self.fade.is_silent() {
            if audible {
                self.start(sample_rate, 0.0);
            } else {
                self.kind = None;
                self.design = None;
                self.fade.target = 0.0;
            }
            return;
        }
        if !audible || self.kind != Some(self.target_kind()) {
            // Out first; switched once silent.
            self.fade.target = 0.0;
            return;
        }
        self.fade.target = 1.0;
        let target = Glide::of(&self.target.shape);
        if self.glide != target {
            self.glide.approach(&target, glide);
            if let (Some(kind), Some(ramp)) = (self.kind, &mut self.design) {
                ramp.set(
                    Design::new(&self.glide.shape(kind), sample_rate),
                    CONTROL_FRAMES,
                );
            }
        }
    }

    #[inline]
    fn run(&mut self, signal: (f64, f64)) -> (f64, f64) {
        let (Some(ramp), Some(kind)) = (&mut self.design, self.kind) else {
            return signal;
        };
        let level = self.fade.level;
        self.fade.advance();
        let out = route(
            ramp.design(),
            &mut self.states,
            kind.channel,
            level,
            false,
            signal,
        );
        ramp.advance();
        out
    }
}

/// The filter solo plays a band through: the part of the spectrum it shapes.
fn audition(shape: &Shape) -> Shape {
    let (filter_type, q) = match shape.filter_type {
        FilterType::Bell | FilterType::Notch | FilterType::BandPass => {
            (FilterType::BandPass, shape.q)
        }
        // What a low shelf lifts or a low cut removes is under its frequency.
        FilterType::LowShelf | FilterType::LowCut => (FilterType::HighCut, NEUTRAL_Q),
        FilterType::HighShelf | FilterType::HighCut => (FilterType::LowCut, NEUTRAL_Q),
    };
    Shape {
        filter_type,
        frequency: shape.frequency,
        gain: 0.0,
        q,
        slope: Slope::Db12,
    }
}

/// Solo: which band is heard alone, through its audition filter.
#[derive(Clone, Copy, Default)]
struct Solo {
    /// The soloed slot the parameters ask for.
    target: Option<usize>,
    /// The slot playing, while it plays or fades.
    band: Option<usize>,
    channel: Channel,
    /// The audition filter's shape, while it plays.
    shape: Option<Shape>,
    design: Option<Ramp>,
    states: [State; 2],
    fade: Fade,
}

impl Solo {
    fn control(&mut self, bands: &[Band; BANDS], sample_rate: f64) {
        if self.fade.is_silent() {
            self.band = self.target;
            self.states = Default::default();
            if self.band.is_none() {
                self.shape = None;
                self.design = None;
                self.fade.target = 0.0;
                return;
            }
        } else if self.band != self.target {
            self.fade.target = 0.0;
            return;
        }
        let Some(band) = self.band.map(|slot| &bands[slot]) else {
            return;
        };
        let Some(kind) = band.kind else {
            // Faded out to change kind: silent until it is back.
            return;
        };
        self.fade.target = 1.0;
        self.channel = kind.channel;
        let shape = audition(&band.glide.shape(kind));
        if self.shape != Some(shape) {
            let design = Design::new(&shape, sample_rate);
            match &mut self.design {
                Some(ramp) if self.shape.is_some() => ramp.set(design, CONTROL_FRAMES),
                _ => self.design = Some(Ramp::new(design)),
            }
            self.shape = Some(shape);
        }
    }

    #[inline]
    fn run(&mut self, eq: (f64, f64), input: (f64, f64)) -> (f64, f64) {
        let Some(ramp) = &mut self.design else {
            return eq;
        };
        let level = self.fade.level;
        self.fade.advance();
        let heard = route(
            ramp.design(),
            &mut self.states,
            self.channel,
            1.0,
            true,
            input,
        );
        ramp.advance();
        (
            eq.0 + level * (heard.0 - eq.0),
            eq.1 + level * (heard.1 - eq.1),
        )
    }
}

/// A gain that glides to its target, a sample at a time.
#[derive(Clone, Copy, Default)]
struct Gain {
    value: f64,
    target: f64,
    amount: f64,
}

impl Gain {
    fn at(decibels: f64, sample_rate: f64) -> Self {
        let value = 10f64.powf(decibels / 20.0);
        Self {
            value,
            target: value,
            amount: 1.0 - (-1.0 / (GLIDE_SECONDS * sample_rate)).exp(),
        }
    }

    fn set(&mut self, decibels: f64) {
        self.target = 10f64.powf(decibels / 20.0);
    }

    #[inline]
    fn next(&mut self) -> f64 {
        if self.value != self.target {
            self.value += (self.target - self.value) * self.amount;
            if (self.value - self.target).abs() < 1e-7 {
                self.value = self.target;
            }
        }
        self.value
    }
}

/// What the engine is asked to do for a block.
pub struct Settings<'a> {
    pub bands: &'a [BandParameters; BANDS],
    pub bypass: bool,
    /// dB.
    pub input_gain: f64,
    /// dB.
    pub output_gain: f64,
}

pub struct Engine {
    sample_rate: f64,
    bands: [Band; BANDS],
    solo: Solo,
    input_gain: Gain,
    output_gain: Gain,
    /// 1 while processing, 0 while bypassed.
    active: Fade,
    /// Samples until the next control step.
    countdown: usize,
    /// How far a glide moves in one control step.
    glide: f64,
}

impl Engine {
    /// An engine at `sample_rate`, already at `settings`, with nothing
    /// fading or gliding in.
    pub fn new(sample_rate: f64, settings: &Settings) -> Self {
        let mut engine = Self {
            sample_rate,
            bands: Default::default(),
            solo: Solo::default(),
            input_gain: Gain::at(settings.input_gain, sample_rate),
            output_gain: Gain::at(settings.output_gain, sample_rate),
            active: Fade::at(if settings.bypass { 0.0 } else { 1.0 }, sample_rate),
            countdown: 0,
            glide: 1.0 - (-(CONTROL_FRAMES as f64) / (GLIDE_SECONDS * sample_rate)).exp(),
        };
        engine.settle(settings);
        engine
    }

    /// Puts every band and the solo at `settings` at once, as after a
    /// bypass, rather than gliding there from settings long gone.
    fn settle(&mut self, settings: &Settings) {
        let sample_rate = self.sample_rate;
        for (band, target) in self.bands.iter_mut().zip(settings.bands) {
            *band = Band {
                target: *target,
                fade: Fade::at(0.0, sample_rate),
                ..Band::default()
            };
            if target.audible() {
                band.start(sample_rate, 1.0);
            }
        }
        self.solo = Solo {
            target: soloed(settings.bands),
            fade: Fade::at(0.0, sample_rate),
            ..Solo::default()
        };
        self.solo.control(&self.bands, sample_rate);
        self.solo.fade.level = self.solo.fade.target;
        self.countdown = 0;
    }

    /// Clears the filters' memory, as after a stop.
    pub fn reset(&mut self) {
        for band in &mut self.bands {
            band.states = Default::default();
        }
        self.solo.states = Default::default();
    }

    /// Processes a block in place: `right` is `None` for a mono signal.
    pub fn process(&mut self, settings: &Settings, left: &mut [f32], right: Option<&mut [f32]>) {
        let was_bypassed = self.active.is_out();
        self.active.target = if settings.bypass { 0.0 } else { 1.0 };
        if self.active.is_out() {
            return;
        }
        if was_bypassed {
            // Back from bypass: start from the settings as they are now.
            self.settle(settings);
        }
        for (band, target) in self.bands.iter_mut().zip(settings.bands) {
            band.target = *target;
        }
        self.solo.target = soloed(settings.bands);
        self.input_gain.set(settings.input_gain);
        self.output_gain.set(settings.output_gain);

        let mut right = right;
        for i in 0..left.len() {
            if self.countdown == 0 {
                self.control();
                self.countdown = CONTROL_FRAMES;
            }
            self.countdown -= 1;

            let dry = (
                f64::from(left[i]),
                f64::from(right.as_deref().map_or(left[i], |r| r[i])),
            );
            let gain = self.input_gain.next();
            let input = (dry.0 * gain, dry.1 * gain);
            let mut signal = input;
            for band in &mut self.bands {
                if !band.fade.is_out() {
                    signal = band.run(signal);
                }
            }
            if !self.solo.fade.is_out() {
                signal = self.solo.run(signal, input);
            }
            let gain = self.output_gain.next();
            let wet = (signal.0 * gain, signal.1 * gain);
            let active = self.active.level;
            self.active.advance();
            left[i] = (dry.0 + active * (wet.0 - dry.0)) as f32;
            if let Some(right) = right.as_deref_mut() {
                right[i] = (dry.1 + active * (wet.1 - dry.1)) as f32;
            }
        }
    }

    fn control(&mut self) {
        for band in &mut self.bands {
            band.control(self.sample_rate, self.glide);
        }
        self.solo.control(&self.bands, self.sample_rate);
    }
}

/// The first band in use, on and soloed. The editor lets one band solo at a
/// time; automation could ask for more.
fn soloed(bands: &[BandParameters; BANDS]) -> Option<usize> {
    bands.iter().position(|band| band.solo && band.audible())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::filter::NEUTRAL_Q;

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
}
