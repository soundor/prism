//! The windows an FFT frame is shaped with, as the analyzer settings name
//! them.

use std::f64::consts::TAU;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Window {
    #[default]
    Hann,
    BlackmanHarris,
    Hamming,
    FlatTop,
}

impl Window {
    /// The window at an option index of `AnalyzerWindow`.
    pub fn from_index(index: u32) -> Self {
        match index {
            1 => Self::BlackmanHarris,
            2 => Self::Hamming,
            3 => Self::FlatTop,
            _ => Self::Hann,
        }
    }

    /// The cosine-sum coefficients: w(n) = Σ (−1)^k a_k cos(2πkn/N).
    fn coefficients(self) -> &'static [f64] {
        match self {
            Self::Hann => &[0.5, 0.5],
            Self::Hamming => &[0.54, 0.46],
            Self::BlackmanHarris => &[0.35875, 0.48829, 0.14128, 0.01168],
            Self::FlatTop => &[
                0.215_578_95,
                0.416_631_58,
                0.277_263_158,
                0.083_578_947,
                0.006_947_368,
            ],
        }
    }

    /// Fills `into` with the window, periodic over its length, and returns
    /// its sum (the gain it gives a sine at a bin's centre, times two).
    pub fn fill(self, into: &mut [f64]) -> f64 {
        let n = into.len() as f64;
        let coefficients = self.coefficients();
        let mut sum = 0.0;
        for (i, w) in into.iter_mut().enumerate() {
            let x = TAU * i as f64 / n;
            *w = coefficients
                .iter()
                .enumerate()
                .map(|(k, &a)| if k % 2 == 0 { a } else { -a } * (k as f64 * x).cos())
                .sum();
            sum += *w;
        }
        sum
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_peak_in_the_middle_and_sum_as_expected() {
        for (window, mean) in [
            (Window::Hann, 0.5),
            (Window::Hamming, 0.54),
            (Window::BlackmanHarris, 0.35875),
            (Window::FlatTop, 0.215_578_95),
        ] {
            let mut w = [0.0; 1024];
            let sum = window.fill(&mut w);
            assert!((sum / 1024.0 - mean).abs() < 1e-9, "{window:?}");
            assert!((w[512] - 1.0).abs() < 0.01, "{window:?}: {}", w[512]);
        }
    }
}
