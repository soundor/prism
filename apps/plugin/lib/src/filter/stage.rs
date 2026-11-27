//! One section of a band's filter: a second-order state variable filter, or
//! a first-order one for 6 dB/oct cuts. Its coefficients, how it runs a
//! sample, and its response.

use fundsp::svf::SvfCoefs;

/// One stage's coefficients.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum Stage {
    /// A second-order state variable filter, with the `g` and `k` its
    /// coefficients were made from, which its response is computed from.
    Svf { coefs: Coefs, g: f64, k: f64 },
    /// A first-order section: `g` is the prewarped cutoff, `high` picks the
    /// highpass output over the lowpass one.
    OnePole { g: f64, high: bool },
}

/// [`SvfCoefs`], copied out so a stage is `Copy` and can be compared.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) struct Coefs {
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
    pub(super) fn svf(coefs: SvfCoefs<f64>) -> Self {
        let coefs = Coefs::from(coefs);
        // a1 = 1 / (1 + g (g + k)), a2 = g a1.
        let g = coefs.a2 / coefs.a1;
        let k = (1.0 / coefs.a1 - 1.0 - g * g) / g;
        Self::Svf { coefs, g, k }
    }

    /// Runs one sample through the stage, with `s` as its memory.
    #[inline]
    pub(super) fn tick(&self, s: &mut [f64; 2], x: f64) -> f64 {
        match *self {
            Self::Svf { coefs: c, .. } => {
                // Simper, "Linear Trap Optimised 2".
                let v3 = x - s[1];
                let v1 = c.a1 * s[0] + c.a2 * v3;
                let v2 = s[1] + c.a2 * s[0] + c.a3 * v3;
                s[0] = 2.0 * v1 - s[0];
                s[1] = 2.0 * v2 - s[1];
                c.m0 * x + c.m1 * v1 + c.m2 * v2
            }
            Self::OnePole { g, high } => {
                let v = (x - s[0]) * g / (1.0 + g);
                let low = v + s[0];
                s[0] = low + v;
                if high { x - low } else { low }
            }
        }
    }

    /// The stage's response at `w` radians per sample, as a complex number
    /// `(re, im)`.
    pub(super) fn response(&self, w: f64) -> (f64, f64) {
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

    /// The numbers a stage runs on, to interpolate between two designs.
    pub(super) fn values(&self) -> [f64; 6] {
        match *self {
            Self::Svf { coefs: c, .. } => [c.a1, c.a2, c.a3, c.m0, c.m1, c.m2],
            Self::OnePole { g, .. } => [g, 0.0, 0.0, 0.0, 0.0, 0.0],
        }
    }

    /// Moves the numbers it runs on by `delta`. Its `g` and `k`, which only
    /// its response is computed from, stay as they were.
    #[inline]
    pub(super) fn shift(&mut self, delta: &[f64; 6]) {
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

/// Complex division, `n / d`.
fn divide(n: (f64, f64), d: (f64, f64)) -> (f64, f64) {
    let m = d.0 * d.0 + d.1 * d.1;
    ((n.0 * d.0 + n.1 * d.1) / m, (n.1 * d.0 - n.0 * d.1) / m)
}
