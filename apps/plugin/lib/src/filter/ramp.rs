//! A design gliding to the next one a sample at a time.

use super::design::{Design, MAX_STAGES};

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
