//! The spectrum analyzer: what goes into the EQ and what comes out, measured
//! with an FFT about 60 times a second and read at the graph's grid
//! frequencies.
//!
//! Both signals are mixed to mono and kept in rings as long as the largest
//! FFT. Every hop, the latest stretch of each is windowed and transformed;
//! each grid point reads the bins around it (`grid`), and its power is
//! averaged over time at the speed the settings ask for. A full-scale sine
//! reads 0 dBFS.
//!
//! What the editor does to the spectrum for display (octave smoothing,
//! tilt, the floor, peak hold, freezing) it does itself.
//!
//! - `window`: the windows a frame is shaped with.
//! - `grid`: the grid frequencies, and where each reads the bins.

mod grid;
mod window;

use std::sync::Arc;

use rustfft::num_complex::Complex;
use rustfft::{Fft, FftPlanner};

pub use grid::GRID_POINTS;
use grid::Reading;
pub use window::Window;

/// The FFT sizes the settings offer, by option index of `AnalyzerFftSize`.
pub const SIZES: [usize; 4] = [2048, 4096, 8192, 16384];
/// The largest FFT, and how much of each signal is kept.
pub const MAX_SIZE: usize = 16384;
/// How many spectra a second the analyzer measures.
const FRAMES_PER_SECOND: f64 = 60.0;
/// The time constants, in seconds, of the slow, medium and fast speeds.
const SPEEDS: [f64; 3] = [0.26, 0.093, 0.036];
/// The level of silence, in dBFS: below anything the editor draws.
pub const SILENCE: f32 = -120.0;
/// Values in a published spectrum: the pre spectrum, then the post one.
pub const SPECTRUM_LENGTH: usize = 2 * GRID_POINTS;

/// What the editor asks for, as the controller hands it over: each setting
/// its option index.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Settings {
    pub size: usize,
    pub window: Window,
    /// The time constant of the averaging, in seconds.
    pub speed: f64,
}

impl Settings {
    /// The settings in the `analyzer` resource: FFT size, window and speed,
    /// then 1 to analyze; `None` while there is nothing to analyze for.
    pub fn decode(resource: Option<&[u32]>) -> Option<Self> {
        let &[size, window, speed, enabled] = resource? else {
            return None;
        };
        (enabled != 0).then(|| Self {
            size: SIZES[(size as usize).min(SIZES.len() - 1)],
            window: Window::from_index(window),
            speed: SPEEDS[(speed as usize).min(SPEEDS.len() - 1)],
        })
    }
}

pub struct Analyzer {
    sample_rate: f64,
    /// One plan per size in [`SIZES`].
    plans: [Arc<dyn Fft<f64>>; 4],
    scratch: Vec<Complex<f64>>,
    frame: Vec<Complex<f64>>,
    /// The window for the current size, and its sum.
    window: Vec<f64>,
    window_sum: f64,
    /// The pre and post signals, mixed to mono, [`MAX_SIZE`] samples each.
    rings: [Vec<f32>; 2],
    /// Where the next sample goes in each ring.
    write: usize,
    /// Samples since the last frame.
    since: usize,
    hop: usize,
    settings: Option<Settings>,
    readings: [Reading; GRID_POINTS],
    /// The pre and post power at each grid point, averaged.
    levels: [[f64; GRID_POINTS]; 2],
    /// How far an average moves toward a new frame.
    smoothing: f64,
}

impl Analyzer {
    /// An analyzer at `sample_rate`, with everything it will need
    /// allocated, analyzing nothing yet.
    pub fn new(sample_rate: f64) -> Self {
        let mut planner = FftPlanner::new();
        let plans = SIZES.map(|size| planner.plan_fft_forward(size));
        let scratch = plans
            .iter()
            .map(|plan| plan.get_inplace_scratch_len())
            .max()
            .unwrap_or(0);
        Self {
            sample_rate,
            plans,
            scratch: vec![Complex::default(); scratch],
            frame: vec![Complex::default(); MAX_SIZE],
            window: vec![0.0; MAX_SIZE],
            window_sum: 1.0,
            rings: [vec![0.0; MAX_SIZE], vec![0.0; MAX_SIZE]],
            write: 0,
            since: 0,
            hop: (sample_rate / FRAMES_PER_SECOND).round().max(1.0) as usize,
            settings: None,
            readings: [Reading::Beyond; GRID_POINTS],
            levels: [[0.0; GRID_POINTS]; 2],
            smoothing: 1.0,
        }
    }

    /// Forgets what it heard, as after a stop.
    pub fn reset(&mut self) {
        self.rings.iter_mut().for_each(|ring| ring.fill(0.0));
        self.levels = [[0.0; GRID_POINTS]; 2];
        self.since = 0;
    }

    /// Takes the settings for this block; `None` stops analyzing. A change
    /// of size or window takes effect at once; it never allocates.
    pub fn configure(&mut self, settings: Option<Settings>) {
        if settings == self.settings {
            return;
        }
        if let Some(new) = settings {
            let old = self.settings;
            if old.is_none_or(|old| old.size != new.size || old.window != new.window) {
                self.window_sum = new.window.fill(&mut self.window[..new.size]);
                grid::readings(new.size, self.sample_rate, &mut self.readings);
            }
            if old.is_none() {
                // Start from what is heard now, rather than rising from silence.
                self.smoothing = 1.0;
            }
        }
        self.settings = settings;
    }

    /// Takes in the block the EQ is about to process, times `gain`; `right`
    /// is `None` for a mono signal. Call before [`capture_post`](Self::capture_post).
    pub fn capture_pre(&mut self, left: &[f32], right: Option<&[f32]>, gain: f32) {
        let mut at = self.write;
        for i in 0..left.len() {
            self.rings[0][at] = gain * mono(left, right, i);
            at = (at + 1) % MAX_SIZE;
        }
    }

    /// Takes in the block the EQ put out, and measures a spectrum if one is
    /// due: returns whether there is a new one to publish.
    pub fn capture_post(&mut self, left: &[f32], right: Option<&[f32]>) -> bool {
        for i in 0..left.len() {
            self.rings[1][self.write] = mono(left, right, i);
            self.write = (self.write + 1) % MAX_SIZE;
        }
        self.since += left.len();
        if self.since < self.hop {
            return false;
        }
        let hops = self.since / self.hop;
        self.since %= self.hop;
        let Some(settings) = self.settings else {
            return false;
        };
        let target =
            1.0 - (-((hops * self.hop) as f64) / (settings.speed * self.sample_rate)).exp();
        let amount = std::mem::replace(&mut self.smoothing, target);
        for signal in 0..2 {
            self.measure(signal, settings.size, amount);
        }
        true
    }

    /// One frame of `signal` (0 pre, 1 post): its spectrum at the grid,
    /// moved `amount` of the way into the averages.
    fn measure(&mut self, signal: usize, size: usize, amount: f64) {
        let ring = &self.rings[signal];
        let start = (self.write + MAX_SIZE - size) % MAX_SIZE;
        for (i, (sample, w)) in self.frame[..size].iter_mut().zip(&self.window).enumerate() {
            *sample = Complex::new(f64::from(ring[(start + i) % MAX_SIZE]) * w, 0.0);
        }
        let plan = &self.plans[SIZES.iter().position(|&s| s == size).unwrap_or(0)];
        plan.process_with_scratch(&mut self.frame[..size], &mut self.scratch);

        // A sine of amplitude A at a bin's centre gives |X| = A·Σw/2.
        let scale = 2.0 / self.window_sum;
        let frame = &self.frame;
        let power = |bin: usize| {
            let p = (frame[bin].norm() * scale).powi(2);
            if p.is_finite() { p } else { 0.0 }
        };
        for (level, reading) in self.levels[signal].iter_mut().zip(&self.readings) {
            let p = match *reading {
                Reading::Loudest { first, last } => (first..=last).map(power).fold(0.0, f64::max),
                Reading::Between { bin, fraction } => {
                    power(bin) + fraction * (power(bin + 1) - power(bin))
                }
                Reading::Beyond => 0.0,
            };
            *level += amount * (p - *level);
        }
    }

    /// The latest spectra, in dBFS: the pre one, then the post one, into
    /// the first [`SPECTRUM_LENGTH`] values of `into`.
    pub fn spectrum(&self, into: &mut [f32]) {
        for (value, level) in into.iter_mut().zip(self.levels.iter().flatten()) {
            *value = ((10.0 * level.log10()) as f32).max(SILENCE);
        }
    }
}

#[inline]
fn mono(left: &[f32], right: Option<&[f32]>, i: usize) -> f32 {
    match right {
        Some(right) => 0.5 * (left[i] + right[i]),
        None => left[i],
    }
}
