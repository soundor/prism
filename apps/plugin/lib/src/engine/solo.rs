//! Solo: one band heard alone, through a filter that plays the part of the
//! spectrum it shapes.

use super::CONTROL_FRAMES;
use super::band::Band;
use super::channel::{Channel, route};
use super::smoothing::Fade;
use crate::filter::{Design, FilterType, NEUTRAL_Q, Ramp, Shape, Slope, State};
use crate::{BANDS, BandParameters};

/// The first band in use, on and soloed. The editor lets one band solo at a
/// time; automation could ask for more.
pub(super) fn soloed(bands: &[BandParameters; BANDS]) -> Option<usize> {
    bands.iter().position(|band| band.solo && band.audible())
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

/// Which band is heard alone, through its audition filter.
#[derive(Clone, Copy, Default)]
pub(super) struct Solo {
    /// The soloed slot the parameters ask for.
    pub(super) target: Option<usize>,
    /// The slot playing, while it plays or fades.
    band: Option<usize>,
    channel: Channel,
    /// The audition filter's shape, while it plays.
    shape: Option<Shape>,
    design: Option<Ramp>,
    pub(super) states: [State; 2],
    pub(super) fade: Fade,
}

impl Solo {
    /// Solo at `bands`' soloed slot, already playing if there is one.
    pub(super) fn settled(
        parameters: &[BandParameters; BANDS],
        bands: &[Band; BANDS],
        sample_rate: f64,
    ) -> Self {
        let mut solo = Self {
            target: soloed(parameters),
            fade: Fade::at(0.0, sample_rate),
            ..Self::default()
        };
        solo.control(bands, sample_rate);
        solo.fade.level = solo.fade.target;
        solo
    }

    /// The control step: fades toward the soloed slot, and follows its band
    /// as it glides.
    pub(super) fn control(&mut self, bands: &[Band; BANDS], sample_rate: f64) {
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

    /// Mixes the soloed band, heard from `input`, over the equalizer's
    /// output `eq`, as far as solo has faded in.
    #[inline]
    pub(super) fn run(&mut self, eq: (f64, f64), input: (f64, f64)) -> (f64, f64) {
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
