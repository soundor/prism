//! One slot as it plays: gliding to new settings, and fading out and back in
//! for a change a glide can't make.

use super::CONTROL_FRAMES;
use super::channel::{Channel, route};
use super::smoothing::Fade;
use crate::BandParameters;
use crate::filter::{Design, FilterType, Ramp, Shape, Slope, State};

/// What a band is, as opposed to its settings that glide.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) struct Kind {
    filter_type: FilterType,
    slope: Slope,
    pub(super) channel: Channel,
}

/// The settings that glide, on the scales they glide on.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub(super) struct Glide {
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

    pub(super) fn shape(&self, kind: Kind) -> Shape {
        Shape {
            filter_type: kind.filter_type,
            frequency: self.log_frequency.exp2(),
            gain: self.gain,
            q: self.log_q.exp2(),
            slope: kind.slope,
        }
    }
}

/// One slot as it plays.
#[derive(Clone, Copy, Default)]
pub(super) struct Band {
    /// What the slot's parameters ask for.
    pub(super) target: BandParameters,
    /// What the filter is, while it plays or fades.
    pub(super) kind: Option<Kind>,
    pub(super) glide: Glide,
    design: Option<Ramp>,
    pub(super) states: [State; 2],
    pub(super) fade: Fade,
}

impl Band {
    /// A slot at `target`, already playing if it is audible.
    pub(super) fn settled(target: BandParameters, sample_rate: f64) -> Self {
        let mut band = Self {
            target,
            fade: Fade::at(0.0, sample_rate),
            ..Self::default()
        };
        if target.audible() {
            band.start(sample_rate, 1.0);
        }
        band
    }

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
    pub(super) fn control(&mut self, sample_rate: f64, glide: f64) {
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
    pub(super) fn run(&mut self, signal: (f64, f64)) -> (f64, f64) {
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
