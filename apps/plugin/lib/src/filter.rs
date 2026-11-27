//! One band's filter: its type, frequency, gain, Q and slope turned into up to
//! four stages, and those stages run over samples.
//!
//! Every second-order stage is Andrew Simper's state variable filter, with
//! fundsp's coefficients; a 6 dB/oct cut is the matching one-pole. Both are
//! the bilinear transform of the analog prototypes that R. Bristow-Johnson's
//! Audio EQ Cookbook uses, so a band sounds as the graph draws it
//! (`src/graph/response.ts`): the tests hold the two together.
//!
//! The state variable form is kept for what comes next: its coefficients can
//! change while it runs without the state blowing up, as a parameter is
//! smoothed or automated.

use fundsp::svf::SvfCoefs;

/// A cut's steepest slope, 48 dB/oct, takes four second-order stages.
pub const MAX_STAGES: usize = 4;

/// The Q a cut's band setting is neutral at: the graph's rounded 1/sqrt(2).
#[allow(clippy::approx_constant)]
pub const NEUTRAL_Q: f64 = 0.7071;

/// What fraction of the sample rate a frequency is held under, as the graph
/// does, so a band set above Nyquist stays a filter rather than failing.
const NYQUIST_LIMIT: f64 = 0.49;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum FilterType {
    #[default]
    Bell,
    LowShelf,
    HighShelf,
    LowCut,
    HighCut,
    Notch,
    BandPass,
}

impl FilterType {
    /// The type at its index, in the order soundor.config declares them.
    pub fn from_index(index: u32) -> Self {
        match index {
            1 => Self::LowShelf,
            2 => Self::HighShelf,
            3 => Self::LowCut,
            4 => Self::HighCut,
            5 => Self::Notch,
            6 => Self::BandPass,
            _ => Self::Bell,
        }
    }

    pub fn is_cut(self) -> bool {
        matches!(self, Self::LowCut | Self::HighCut)
    }
}

/// A cut's slope, in dB per octave.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Slope {
    Db6,
    #[default]
    Db12,
    Db24,
    Db36,
    Db48,
}

impl Slope {
    /// The slope at its index, in the order soundor.config declares them.
    pub fn from_index(index: u32) -> Self {
        match index {
            0 => Self::Db6,
            2 => Self::Db24,
            3 => Self::Db36,
            4 => Self::Db48,
            _ => Self::Db12,
        }
    }

    /// The filter's order: one pole for each 6 dB/oct.
    fn order(self) -> usize {
        match self {
            Self::Db6 => 1,
            Self::Db12 => 2,
            Self::Db24 => 4,
            Self::Db36 => 6,
            Self::Db48 => 8,
        }
    }
}

/// Butterworth stage Qs for 2, 4, 6 and 8 poles, rounded as the graph has
/// them, so the two agree to the last digit.
#[allow(clippy::approx_constant)]
const BUTTERWORTH: [&[f64]; 4] = [
    &[0.7071],
    &[0.5412, 1.3066],
    &[0.5176, 0.7071, 1.9319],
    &[0.5098, 0.6013, 0.9, 2.5629],
];

/// A band's settings, as its parameters hold them.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Shape {
    pub filter_type: FilterType,
    /// Hz.
    pub frequency: f64,
    /// dB; only bells and shelves use it.
    pub gain: f64,
    pub q: f64,
    /// Only cuts use it.
    pub slope: Slope,
}

impl Default for Shape {
    fn default() -> Self {
        Self {
            filter_type: FilterType::Bell,
            frequency: 1000.0,
            gain: 0.0,
            q: 0.707,
            slope: Slope::Db12,
        }
    }
}

/// One stage's coefficients.
#[derive(Clone, Copy, Debug, PartialEq)]
enum Stage {
    /// A second-order state variable filter, with the `g` and `k` its
    /// coefficients were made from, which its response is computed from.
    Svf { coefs: Coefs, g: f64, k: f64 },
    /// A first-order section: `g` is the prewarped cutoff, `high` picks the
    /// highpass output over the lowpass one.
    OnePole { g: f64, high: bool },
}

/// [`SvfCoefs`], copied out so a stage is `Copy` and can be compared.
#[derive(Clone, Copy, Debug, PartialEq)]
struct Coefs {
    a1: f64,
    a2: f64,
    a3: f64,
    m0: f64,
    m1: f64,
    m2: f64,
}

impl From<SvfCoefs<f64>> for Coefs {
    fn from(c: SvfCoefs<f64>) -> Self {
        Self {
            a1: c.a1,
            a2: c.a2,
            a3: c.a3,
            m0: c.m0,
            m1: c.m1,
            m2: c.m2,
        }
    }
}

impl Stage {
    fn svf(coefs: SvfCoefs<f64>) -> Self {
        let coefs = Coefs::from(coefs);
        // a1 = 1 / (1 + g (g + k)), a2 = g a1.
        let g = coefs.a2 / coefs.a1;
        let k = (1.0 / coefs.a1 - 1.0 - g * g) / g;
        Self::Svf { coefs, g, k }
    }

    /// The stage's response at `w` radians per sample, as a complex number
    /// `(re, im)`.
    fn response(&self, w: f64) -> (f64, f64) {
        // z^-1 and z^-2 on the unit circle.
        let z1 = (w.cos(), -w.sin());
        let z2 = ((2.0 * w).cos(), -(2.0 * w).sin());
        match *self {
            Self::Svf { coefs, g, k } => {
                // The SVF's outputs as biquads over a shared denominator:
                // band = g (1 - z^-2) / D, low = g^2 (1 + z^-1)^2 / D.
                let d = (
                    1.0 + g * k + g * g + 2.0 * (g * g - 1.0) * z1.0 + (1.0 - g * k + g * g) * z2.0,
                    2.0 * (g * g - 1.0) * z1.1 + (1.0 - g * k + g * g) * z2.1,
                );
                let band = (g * (1.0 - z2.0), -g * z2.1);
                let low = (
                    g * g * (1.0 + 2.0 * z1.0 + z2.0),
                    g * g * (2.0 * z1.1 + z2.1),
                );
                let n = (
                    coefs.m0 * d.0 + coefs.m1 * band.0 + coefs.m2 * low.0,
                    coefs.m0 * d.1 + coefs.m1 * band.1 + coefs.m2 * low.1,
                );
                divide(n, d)
            }
            Self::OnePole { g, high } => {
                let d = (1.0 + g + (g - 1.0) * z1.0, (g - 1.0) * z1.1);
                let n = if high {
                    (1.0 - z1.0, -z1.1)
                } else {
                    (g * (1.0 + z1.0), g * z1.1)
                };
                divide(n, d)
            }
        }
    }
}

impl Stage {
    /// The numbers a stage runs on, to interpolate between two designs.
    fn values(&self) -> [f64; 6] {
        match *self {
            Self::Svf { coefs: c, .. } => [c.a1, c.a2, c.a3, c.m0, c.m1, c.m2],
            Self::OnePole { g, .. } => [g, 0.0, 0.0, 0.0, 0.0, 0.0],
        }
    }

    /// Moves the numbers it runs on by `delta`. Its `g` and `k`, which only
    /// its response is computed from, stay as they were.
    #[inline]
    fn shift(&mut self, delta: &[f64; 6]) {
        match self {
            Self::Svf { coefs: c, .. } => {
                c.a1 += delta[0];
                c.a2 += delta[1];
                c.a3 += delta[2];
                c.m0 += delta[3];
                c.m1 += delta[4];
                c.m2 += delta[5];
            }
            Self::OnePole { g, .. } => *g += delta[0],
        }
    }
}

fn divide(n: (f64, f64), d: (f64, f64)) -> (f64, f64) {
    let m = d.0 * d.0 + d.1 * d.1;
    ((n.0 * d.0 + n.1 * d.1) / m, (n.1 * d.0 - n.0 * d.1) / m)
}

/// A band's stages, designed for one sample rate.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Design {
    stages: [Stage; MAX_STAGES],
    count: usize,
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
        let mut y = x;
        for (stage, s) in self.stages[..self.count].iter().zip(&mut state.0) {
            y = match *stage {
                Stage::Svf { coefs: c, .. } => {
                    // Simper, "Linear Trap Optimised 2".
                    let v3 = y - s[1];
                    let v1 = c.a1 * s[0] + c.a2 * v3;
                    let v2 = s[1] + c.a2 * s[0] + c.a3 * v3;
                    s[0] = 2.0 * v1 - s[0];
                    s[1] = 2.0 * v2 - s[1];
                    c.m0 * y + c.m1 * v1 + c.m2 * v2
                }
                Stage::OnePole { g, high } => {
                    let v = (y - s[0]) * g / (1.0 + g);
                    let low = v + s[0];
                    s[0] = low + v;
                    if high { y - low } else { low }
                }
            };
        }
        y
    }
}

/// A design that moves to the next one a sample at a time, its coefficients
/// interpolated in a straight line, so a band can glide without the steps
/// in between being heard.
#[derive(Clone, Copy, Debug)]
pub struct Ramp {
    design: Design,
    target: Design,
    delta: [[f64; 6]; MAX_STAGES],
    remaining: usize,
}

impl Ramp {
    pub fn new(design: Design) -> Self {
        Self {
            design,
            target: design,
            delta: [[0.0; 6]; MAX_STAGES],
            remaining: 0,
        }
    }

    /// The design as it is at this sample.
    pub fn design(&self) -> &Design {
        &self.design
    }

    /// Heads for `target`, to arrive in `frames` samples. A design with
    /// other stages can't be interpolated to, and takes over at once.
    pub fn set(&mut self, target: Design, frames: usize) {
        let comparable = target.count == self.design.count
            && target.stages[..target.count]
                .iter()
                .zip(&self.design.stages)
                .all(|(a, b)| std::mem::discriminant(a) == std::mem::discriminant(b));
        if !comparable || frames == 0 {
            *self = Self::new(target);
            return;
        }
        for (i, (to, from)) in target.stages[..target.count]
            .iter()
            .zip(&self.design.stages)
            .enumerate()
        {
            let (to, from) = (to.values(), from.values());
            for j in 0..6 {
                self.delta[i][j] = (to[j] - from[j]) / frames as f64;
            }
        }
        self.target = target;
        self.remaining = frames;
    }

    /// Moves one sample along.
    #[inline]
    pub fn advance(&mut self) {
        if self.remaining == 0 {
            return;
        }
        self.remaining -= 1;
        if self.remaining == 0 {
            self.design = self.target;
            return;
        }
        for (stage, delta) in self.design.stages[..self.design.count]
            .iter_mut()
            .zip(&self.delta)
        {
            stage.shift(delta);
        }
    }
}

/// One channel's memory for a band's stages.
#[derive(Clone, Copy, Debug, Default)]
pub struct State([[f64; 2]; MAX_STAGES]);

impl State {
    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
            for (frequency, gain, q) in [(40.0, 9.0, 0.5), (1000.0, -12.0, 4.0), (9000.0, 6.0, 0.9)]
            {
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
    mod fixture {
        include!("filter_fixture.rs");
    }

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
}
