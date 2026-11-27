//! A band's stages, designed for one sample rate, and the memory they run
//! with.

use fundsp::svf::SvfCoefs;

use super::shape::{FilterType, Shape};
use super::stage::Stage;

/// A cut's steepest slope, 48 dB/oct, takes four second-order stages.
pub const MAX_STAGES: usize = 4;

/// The Q a cut's band setting is neutral at: the graph's rounded 1/sqrt(2).
#[allow(clippy::approx_constant)]
pub const NEUTRAL_Q: f64 = 0.7071;

/// What fraction of the sample rate a frequency is held under, as the graph
/// does, so a band set above Nyquist stays a filter rather than failing.
const NYQUIST_LIMIT: f64 = 0.49;

/// Butterworth stage Qs for 2, 4, 6 and 8 poles, rounded as the graph has
/// them, so the two agree to the last digit.
#[allow(clippy::approx_constant)]
const BUTTERWORTH: [&[f64]; 4] = [
    &[0.7071],
    &[0.5412, 1.3066],
    &[0.5176, 0.7071, 1.9319],
    &[0.5098, 0.6013, 0.9, 2.5629],
];

/// A band's stages, designed for one sample rate.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Design {
    pub(super) stages: [Stage; MAX_STAGES],
    pub(super) count: usize,
}

impl Design {
    /// Designs `shape` for `sample_rate`.
    pub fn new(shape: &Shape, sample_rate: f64) -> Self {
        let f = shape.frequency.clamp(1.0, sample_rate * NYQUIST_LIMIT);
        let q = shape.q.max(1e-3);
        let amplitude = 10f64.powf(shape.gain / 20.0);
        let mut design = Self {
            stages: [Stage::OnePole {
                g: 0.0,
                high: false,
            }; MAX_STAGES],
            count: 0,
        };
        let mut push = |stage| {
            design.stages[design.count] = stage;
            design.count += 1;
        };
        match shape.filter_type {
            FilterType::Bell => push(Stage::svf(SvfCoefs::bell(sample_rate, f, q, amplitude))),
            FilterType::LowShelf => {
                push(Stage::svf(SvfCoefs::lowshelf(sample_rate, f, q, amplitude)))
            }
            FilterType::HighShelf => push(Stage::svf(SvfCoefs::highshelf(
                sample_rate,
                f,
                q,
                amplitude,
            ))),
            FilterType::Notch => push(Stage::svf(SvfCoefs::notch(sample_rate, f, q))),
            FilterType::BandPass => {
                // fundsp's band pass peaks at Q; the graph's peaks at 0 dB.
                let mut coefs = SvfCoefs::bandpass(sample_rate, f, q);
                coefs.m1 /= q;
                push(Stage::svf(coefs));
            }
            cut @ (FilterType::LowCut | FilterType::HighCut) => {
                let high = cut == FilterType::LowCut;
                let order = shape.slope.order();
                if order == 1 {
                    let g = (std::f64::consts::PI * f / sample_rate).tan();
                    push(Stage::OnePole { g, high });
                } else {
                    let stages = BUTTERWORTH[order / 2 - 1];
                    for (i, &stage_q) in stages.iter().enumerate() {
                        // The band's Q scales the last, most resonant stage.
                        let q = if i == stages.len() - 1 {
                            stage_q * q / NEUTRAL_Q
                        } else {
                            stage_q
                        };
                        let coefs = if high {
                            SvfCoefs::highpass(sample_rate, f, q)
                        } else {
                            SvfCoefs::lowpass(sample_rate, f, q)
                        };
                        push(Stage::svf(coefs));
                    }
                }
            }
        }
        design
    }

    /// The response at `frequency` Hz, for `sample_rate`: (dB, radians).
    pub fn response(&self, frequency: f64, sample_rate: f64) -> (f64, f64) {
        let w = std::f64::consts::TAU * frequency / sample_rate;
        let (mut decibels, mut phase) = (0.0, 0.0);
        for stage in &self.stages[..self.count] {
            let (re, im) = stage.response(w);
            decibels += 10.0 * (re * re + im * im).max(1e-18).log10();
            phase += im.atan2(re);
        }
        (decibels, phase)
    }

    /// Runs one sample through the stages, with `state` as their memory.
    #[inline]
    pub fn tick(&self, state: &mut State, x: f64) -> f64 {
        self.stages[..self.count]
            .iter()
            .zip(&mut state.0)
            .fold(x, |y, (stage, memory)| stage.tick(memory, y))
    }
}

/// Below this, a value in a filter's memory is taken as silence: -300 dB,
/// far under anything audible, and far above where floats turn denormal.
const QUIET: f64 = 1e-15;

/// One channel's memory for a band's stages.
#[derive(Clone, Copy, Debug, Default)]
pub struct State([[f64; 2]; MAX_STAGES]);

impl State {
    pub fn reset(&mut self) {
        *self = Self::default();
    }

    /// Keeps the memory sound: clears it when a NaN or an infinity got in
    /// from the input, which would otherwise stay in it for good, and
    /// flushes values too small to hear to zero, before a decay into
    /// silence makes them denormal (slow on some CPUs).
    pub fn sanitize(&mut self) {
        let values = self.0.as_flattened_mut();
        if values.iter().any(|v| !v.is_finite()) {
            values.fill(0.0);
            return;
        }
        for v in values {
            if v.abs() < QUIET {
                *v = 0.0;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizing_clears_a_nan_and_flushes_what_is_too_quiet() {
        let mut state = State([[0.5, 1e-20], [-1e-16, 2e-15], [0.0; 2], [0.0; 2]]);
        state.sanitize();
        assert_eq!(state.0, [[0.5, 0.0], [0.0, 2e-15], [0.0; 2], [0.0; 2]]);
        state.0[3][1] = f64::NAN;
        state.sanitize();
        assert_eq!(state.0, [[0.0; 2]; MAX_STAGES]);
    }
}
