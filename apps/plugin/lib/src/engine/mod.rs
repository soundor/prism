//! The whole equalizer: 24 bands in slot order, each on its own channel, with
//! solo, input and output gain and bypass, every change smoothed so that
//! nothing clicks.
//!
//! - Frequency, gain and Q glide to a new setting (frequency and Q on a log
//!   scale), and the band's coefficients follow every [`CONTROL_FRAMES`]
//!   samples, interpolated per sample in between.
//! - A change a glide can't make (a band turned on or off, its type, slope or
//!   channel changed) fades the band out, switches it, and fades it back in.
//! - Solo plays the part of the spectrum the soloed band shapes; bypass and
//!   solo crossfade too.
//!
//! [`Engine`] runs the chain; `channel` routes a filter to its part of the
//! signal, `band` plays one slot, `solo` the soloed one, and `smoothing`
//! holds the fades and gains they move with.

mod band;
mod channel;
mod smoothing;
mod solo;

pub use channel::Channel;

use crate::{BANDS, BandParameters};
use band::Band;
use smoothing::{Fade, Gain};
use solo::{Solo, soloed};

/// How often, in samples, glides and fades are looked at and coefficients
/// recomputed.
pub const CONTROL_FRAMES: usize = 16;
/// How fast frequency, gain and Q glide: the time constant, in seconds.
const GLIDE_SECONDS: f64 = 0.015;
/// How long a band, solo or bypass takes to fade in or out, in seconds.
const FADE_SECONDS: f64 = 0.01;

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
            *band = Band::settled(*target, sample_rate);
        }
        self.solo = Solo::settled(settings.bands, &self.bands, sample_rate);
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
