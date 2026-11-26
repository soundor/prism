use std::f64::consts::TAU;

const FREQUENCIES: [f64; 4] = [100.0, 400.0, 2_000.0, 8_000.0];
const IDENTITY: [f64; 5] = [1.0, 0.0, 0.0, 0.0, 0.0];

#[derive(Clone, Copy)]
enum Shape {
    LowShelf,
    Bell,
    HighShelf,
}

const SHAPES: [Shape; 4] = [Shape::LowShelf, Shape::Bell, Shape::Bell, Shape::HighShelf];

// RBJ cookbook biquads, with Q = 1 on the bells and slope = 1 on the shelves.
fn coefficients(shape: Shape, hz: f64, rate: f64, db: f32) -> [f64; 5] {
    if db == 0.0 {
        return IDENTITY;
    }
    let (sin, cos) = (TAU * (hz / rate).min(0.45)).sin_cos();
    let a = 10.0_f64.powf(f64::from(db) / 40.0);
    let alpha = sin * 0.5;
    let p = a + 1.0;
    let m = a - 1.0;
    let s = (2.0 * a).sqrt() * sin;
    let (b0, b1, b2, a0, a1, a2) = match shape {
        Shape::Bell => (
            1.0 + alpha * a,
            -2.0 * cos,
            1.0 - alpha * a,
            1.0 + alpha / a,
            -2.0 * cos,
            1.0 - alpha / a,
        ),
        Shape::LowShelf => (
            a * (p - m * cos + s),
            2.0 * a * (m - p * cos),
            a * (p - m * cos - s),
            p + m * cos + s,
            -2.0 * (m + p * cos),
            p + m * cos - s,
        ),
        Shape::HighShelf => (
            a * (p + m * cos + s),
            -2.0 * a * (m + p * cos),
            a * (p + m * cos - s),
            p - m * cos + s,
            2.0 * (m - p * cos),
            p - m * cos - s,
        ),
    };
    [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

struct Band {
    current: [f64; 5],
    target: [f64; 5],
    // Direct form I retains the input/output history through coefficient changes.
    history: [[f64; 4]; 2],
}

impl Default for Band {
    fn default() -> Self {
        Self {
            current: IDENTITY,
            target: IDENTITY,
            history: [[0.0; 4]; 2],
        }
    }
}

impl Band {
    fn tick(&mut self, frame: &mut [f64; 2], smooth: f64) {
        for (current, target) in self.current.iter_mut().zip(self.target) {
            approach(current, target, smooth);
        }
        let [b0, b1, b2, a1, a2] = self.current;
        for (sample, history) in frame.iter_mut().zip(&mut self.history) {
            let [x1, x2, y1, y2] = *history;
            let output = b0 * *sample + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
            let output = if output.abs() < 1e-30 { 0.0 } else { output };
            *history = [*sample, x1, output, y1];
            *sample = output;
        }
    }
}

fn approach(current: &mut f64, target: f64, smooth: f64) {
    let difference = target - *current;
    *current = if difference.abs() < 1e-8 {
        target
    } else {
        *current + smooth * difference
    };
}

pub(crate) struct Equalizer {
    rate: f64,
    smooth: f64,
    gains: [f32; 4],
    bands: [Band; 4],
    wet: f64,
    target_wet: f64,
}

impl Default for Equalizer {
    fn default() -> Self {
        Self {
            rate: 48_000.0,
            smooth: 1.0 - (-1.0_f64 / 240.0).exp(),
            gains: [0.0; 4],
            bands: std::array::from_fn(|_| Band::default()),
            wet: 1.0,
            target_wet: 1.0,
        }
    }
}

impl Equalizer {
    pub fn prepare(&mut self, rate: f64) {
        *self = Self::default();
        self.rate = rate.max(1.0);
        self.smooth = 1.0 - (-1.0 / (0.005 * self.rate)).exp();
    }

    pub fn configure(&mut self, gains: [f32; 4], bypass: bool) {
        self.target_wet = if bypass { 0.0 } else { 1.0 };
        for (i, gain) in gains.into_iter().enumerate() {
            let gain = if gain.is_finite() {
                gain.clamp(-12.0, 12.0)
            } else {
                0.0
            };
            if self.gains[i] != gain {
                self.gains[i] = gain;
                self.bands[i].target = coefficients(SHAPES[i], FREQUENCIES[i], self.rate, gain);
            }
        }
    }

    pub fn reset(&mut self) {
        for band in &mut self.bands {
            band.history = [[0.0; 4]; 2];
            band.current = band.target;
        }
        self.wet = self.target_wet;
    }

    pub fn tick(&mut self, input: [f32; 2]) -> [f32; 2] {
        let mut frame = input.map(f64::from);
        for band in &mut self.bands {
            band.tick(&mut frame, self.smooth);
        }
        approach(&mut self.wet, self.target_wet, self.smooth);
        if self.wet == 0.0 {
            return input;
        }
        std::array::from_fn(|i| {
            let dry = f64::from(input[i]);
            (dry + self.wet * (frame[i] - dry)) as f32
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flat_and_settled_bypass_pass_dry_audio() {
        let mut eq = Equalizer::default();
        let sample = [0.1, -0.23];
        assert_eq!(eq.tick(sample), sample);
        eq.configure([12.0, -12.0, 12.0, -12.0], true);
        for _ in 0..5_000 {
            eq.tick(sample);
        }
        assert_eq!(eq.tick(sample), sample);
    }

    #[test]
    fn each_band_reaches_the_expected_gain_without_stereo_crosstalk() {
        for rate in [44_100.0, 48_000.0, 96_000.0] {
            for (i, hz) in [20.0, 400.0, 2_000.0, 18_000.0].into_iter().enumerate() {
                for db in [-9.0, 9.0] {
                    let mut eq = Equalizer::default();
                    eq.prepare(rate);
                    let mut gains = [0.0; 4];
                    gains[i] = db;
                    eq.configure(gains, false);
                    let mut power = [0.0; 2];
                    for n in 0..rate as usize {
                        let sample = (0.1 * (TAU * hz * n as f64 / rate).sin()) as f32;
                        let [left, right] = eq.tick([sample, 0.0]);
                        assert_eq!(right, 0.0);
                        if n >= rate as usize / 2 {
                            power[0] += f64::from(sample).powi(2);
                            power[1] += f64::from(left).powi(2);
                        }
                    }
                    let measured = 10.0 * (power[1] / power[0]).log10();
                    assert!(
                        (measured - f64::from(db)).abs() < 1.1,
                        "band {i}: {measured} dB"
                    );
                }
            }
        }
    }
}
