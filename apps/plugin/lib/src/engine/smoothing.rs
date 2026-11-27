//! Values that move a sample at a time: fades in and out, and gains.

use super::{FADE_SECONDS, GLIDE_SECONDS};

/// A linear fade between 0 (out) and 1 (in), moved a sample at a time.
#[derive(Clone, Copy, Debug, Default)]
pub(super) struct Fade {
    pub(super) level: f64,
    pub(super) target: f64,
    step: f64,
}

impl Fade {
    pub(super) fn at(level: f64, sample_rate: f64) -> Self {
        Self {
            level,
            target: level,
            step: 1.0 / (FADE_SECONDS * sample_rate),
        }
    }

    #[inline]
    pub(super) fn advance(&mut self) {
        if self.level < self.target {
            self.level = (self.level + self.step).min(self.target);
        } else if self.level > self.target {
            self.level = (self.level - self.step).max(self.target);
        }
    }

    /// Faded out, and staying so.
    pub(super) fn is_out(&self) -> bool {
        self.level == 0.0 && self.target == 0.0
    }

    /// Faded all the way out, whatever comes next.
    pub(super) fn is_silent(&self) -> bool {
        self.level == 0.0
    }
}

/// A gain that glides to its target, a sample at a time.
#[derive(Clone, Copy, Default)]
pub(super) struct Gain {
    value: f64,
    target: f64,
    amount: f64,
}

impl Gain {
    pub(super) fn at(decibels: f64, sample_rate: f64) -> Self {
        let value = 10f64.powf(decibels / 20.0);
        Self {
            value,
            target: value,
            amount: 1.0 - (-1.0 / (GLIDE_SECONDS * sample_rate)).exp(),
        }
    }

    pub(super) fn set(&mut self, decibels: f64) {
        self.target = 10f64.powf(decibels / 20.0);
    }

    #[inline]
    pub(super) fn next(&mut self) -> f64 {
        if self.value != self.target {
            self.value += (self.target - self.value) * self.amount;
            if (self.value - self.target).abs() < 1e-7 {
                self.value = self.target;
            }
        }
        self.value
    }
}
