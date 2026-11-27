//! The spectrum analyzer: what goes into the EQ and what comes out, measured
//! with an FFT about 60 times a second, for the spectrum and the
//! spectrogram.
//!
//! Both signals are mixed to mono and kept in rings as long as the largest
//! FFT. Every hop, the latest stretch of each is windowed and transformed.
//! For the spectrum, each of the graph's grid points reads the bins around
//! it (`grid`), and its power is averaged over time at the speed the
//! settings ask for. For the spectrogram, the post frame is read as it is
//! at equally spaced bins, at the FFT's own resolution. A full-scale sine
//! reads 0 dBFS.
//!
//! What the editor does for display (octave smoothing, tilt, the floor,
//! peak hold, freezing) it does itself.
//!
//! - `window`: the windows a frame is shaped with.
//! - `grid`: the frequencies published at, and where each reads the bins.

mod grid;
mod window;

use std::sync::Arc;

use rustfft::num_complex::Complex;
use rustfft::{Fft, FftPlanner};

use grid::Reading;
pub use grid::{GRID_POINTS, SPECTROGRAM_BINS};
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

/// In the `analyzer` resource's last value: measure the spectrum.
pub const SPECTRUM: u32 = 1;
/// In the `analyzer` resource's last value: measure the spectrogram.
pub const SPECTROGRAM: u32 = 2;

/// What the editor asks for, as the controller hands it over.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Settings {
    pub size: usize,
    pub window: Window,
    /// The time constant of the spectrum's averaging, in seconds.
    pub speed: f64,
    pub spectrum: bool,
    pub spectrogram: bool,
}

impl Settings {
    /// The settings in the `analyzer` resource: the option indices of FFT
    /// size, window and speed, then [`SPECTRUM`] and [`SPECTROGRAM`] as
    /// flags; `None` while there is nothing to measure.
    pub fn decode(resource: Option<&[u32]>) -> Option<Self> {
        let &[size, window, speed, flags] = resource? else {
            return None;
        };
        (flags & (SPECTRUM | SPECTROGRAM) != 0).then(|| Self {
            size: SIZES[(size as usize).min(SIZES.len() - 1)],
            window: Window::from_index(window),
            speed: SPEEDS[(speed as usize).min(SPEEDS.len() - 1)],
            spectrum: flags & SPECTRUM != 0,
            spectrogram: flags & SPECTROGRAM != 0,
        })
    }
}

/// What a block measured, to publish.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Measured {
    pub spectrum: bool,
    pub spectrogram: bool,
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
    spectrogram_readings: Vec<Reading>,
    /// The latest post frame at the spectrogram's bins, in dBFS.
    spectrogram: Vec<f32>,
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
            spectrogram_readings: vec![Reading::Beyond; SPECTROGRAM_BINS],
            spectrogram: vec![SILENCE; SPECTROGRAM_BINS],
        }
    }

    /// Forgets what it heard, as after a stop.
    pub fn reset(&mut self) {
        self.rings.iter_mut().for_each(|ring| ring.fill(0.0));
        self.levels = [[0.0; GRID_POINTS]; 2];
        self.spectrogram.fill(SILENCE);
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
                let (size, rate) = (new.size, self.sample_rate);
                grid::readings(size, rate, grid::frequency, &mut self.readings);
                grid::readings(
                    size,
                    rate,
                    grid::bin_frequency,
                    &mut self.spectrogram_readings,
                );
            }
            if old.is_none_or(|old| !old.spectrum) {
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

    /// Takes in the block the EQ put out, and measures if a frame is due:
    /// returns what there is new to publish.
    pub fn capture_post(&mut self, left: &[f32], right: Option<&[f32]>) -> Measured {
        for i in 0..left.len() {
            self.rings[1][self.write] = mono(left, right, i);
            self.write = (self.write + 1) % MAX_SIZE;
        }
        self.since += left.len();
        if self.since < self.hop {
            return Measured::default();
        }
        let hops = self.since / self.hop;
        self.since %= self.hop;
        let Some(settings) = self.settings else {
            return Measured::default();
        };
        if settings.spectrum {
            let target =
                1.0 - (-((hops * self.hop) as f64) / (settings.speed * self.sample_rate)).exp();
            let amount = std::mem::replace(&mut self.smoothing, target);
            self.transform(0, settings.size);
            self.average(0, amount);
            self.transform(1, settings.size);
            self.average(1, amount);
        } else {
            self.transform(1, settings.size);
        }
        if settings.spectrogram {
            self.read_spectrogram();
        }
        Measured {
            spectrum: settings.spectrum,
            spectrogram: settings.spectrogram,
        }
    }

    /// The latest `size` samples of `signal` (0 pre, 1 post), windowed and
    /// transformed into `frame`.
    fn transform(&mut self, signal: usize, size: usize) {
        let ring = &self.rings[signal];
        let start = (self.write + MAX_SIZE - size) % MAX_SIZE;
        for (i, (sample, w)) in self.frame[..size].iter_mut().zip(&self.window).enumerate() {
            *sample = Complex::new(f64::from(ring[(start + i) % MAX_SIZE]) * w, 0.0);
        }
        let plan = &self.plans[SIZES.iter().position(|&s| s == size).unwrap_or(0)];
        plan.process_with_scratch(&mut self.frame[..size], &mut self.scratch);
    }

    /// The power of the frame's `bin`, scaled so that a full-scale sine at
    /// a bin's centre is 1: such a sine gives |X| = Σw/2.
    fn power(&self, bin: usize) -> f64 {
        let p = (self.frame[bin].norm() * 2.0 / self.window_sum).powi(2);
        if p.is_finite() { p } else { 0.0 }
    }

    /// The frame's power as `reading` reads it.
    fn read(&self, reading: Reading) -> f64 {
        match reading {
            Reading::Loudest { first, last } => (first..=last)
                .map(|bin| self.power(bin))
                .fold(0.0, f64::max),
            Reading::Between { bin, fraction } => {
                let low = self.power(bin);
                low + fraction * (self.power(bin + 1) - low)
            }
            Reading::Beyond => 0.0,
        }
    }

    /// The frame, of `signal`, at the grid, moved `amount` of the way into
    /// its averages.
    fn average(&mut self, signal: usize, amount: f64) {
        for i in 0..GRID_POINTS {
            let p = self.read(self.readings[i]);
            let level = &mut self.levels[signal][i];
            *level += amount * (p - *level);
        }
    }

    /// The frame, of the post signal, at the spectrogram's bins.
    fn read_spectrogram(&mut self) {
        for i in 0..SPECTROGRAM_BINS {
            self.spectrogram[i] = decibels(self.read(self.spectrogram_readings[i]));
        }
    }

    /// The latest spectra, in dBFS: the pre one, then the post one, into
    /// the first [`SPECTRUM_LENGTH`] values of `into`.
    pub fn spectrum(&self, into: &mut [f32]) {
        for (value, &level) in into.iter_mut().zip(self.levels.iter().flatten()) {
            *value = decibels(level);
        }
    }

    /// The latest spectrogram frame: the post signal at
    /// [`SPECTROGRAM_BINS`] equally spaced frequencies, in dBFS.
    pub fn spectrogram(&self) -> &[f32] {
        &self.spectrogram
    }
}

fn decibels(power: f64) -> f32 {
    ((10.0 * power.log10()) as f32).max(SILENCE)
}

#[inline]
fn mono(left: &[f32], right: Option<&[f32]>, i: usize) -> f32 {
    match right {
        Some(right) => 0.5 * (left[i] + right[i]),
        None => left[i],
    }
}
