//! The frequencies the analyzer publishes at: the spectrum at the graph's
//! own grid (`GRID_POINTS` and `gridFrequencies` in
//! `src/graph/response.ts`), the spectrogram at equally spaced bins
//! (`SPECTROGRAM_BINS` in `src/analyzer/analyzer.ts`), both across the
//! graph's range. A test in `src/analyzer` holds the two sides together.

/// Points on the grid.
pub const GRID_POINTS: usize = 320;
/// Bins in a spectrogram frame.
pub const SPECTROGRAM_BINS: usize = 4096;
/// The graph's first and last frequencies, in Hz.
pub const FREQUENCY_MIN: f64 = 10.0;
pub const FREQUENCY_MAX: f64 = 30_000.0;

/// The `i`th grid frequency, log-spaced from [`FREQUENCY_MIN`] to
/// [`FREQUENCY_MAX`].
pub fn frequency(i: usize) -> f64 {
    FREQUENCY_MIN * (FREQUENCY_MAX / FREQUENCY_MIN).powf(i as f64 / (GRID_POINTS - 1) as f64)
}

/// The `i`th spectrogram bin's frequency, equally spaced from
/// [`FREQUENCY_MIN`] to [`FREQUENCY_MAX`].
pub fn bin_frequency(i: usize) -> f64 {
    FREQUENCY_MIN + (FREQUENCY_MAX - FREQUENCY_MIN) * i as f64 / (SPECTROGRAM_BINS - 1) as f64
}

/// Where a grid point reads an FFT's bins.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum Reading {
    /// The loudest of these bins, the ones nearer this point than its
    /// neighbours: where bins are closer together than grid points.
    Loudest { first: usize, last: usize },
    /// Between two bins, `fraction` of the way from `bin` to the next:
    /// where grid points are closer together than bins.
    Between { bin: usize, fraction: f64 },
    /// Above the highest bin: silence.
    #[default]
    Beyond,
}

/// Each point's [`Reading`] of a `size`-point FFT at `sample_rate`, for
/// points at `frequency(i)` ([`frequency`] or [`bin_frequency`]), as many as
/// `into` holds.
pub fn readings(
    size: usize,
    sample_rate: f64,
    frequency: impl Fn(usize) -> f64,
    into: &mut [Reading],
) {
    let spacing = sample_rate / size as f64;
    let top = size / 2;
    let points = into.len();
    for (i, reading) in into.iter_mut().enumerate() {
        let f = frequency(i);
        // Halfway, on the log scale, to each neighbour.
        let low = (f * frequency(i.saturating_sub(1))).sqrt() / spacing;
        let high = (f * frequency((i + 1).min(points - 1))).sqrt() / spacing;
        let position = f / spacing;
        let (first, last) = (low.ceil() as usize, (high.floor() as usize).min(top));
        *reading = if position >= top as f64 {
            Reading::Beyond
        } else if first <= last && i > 0 && i < points - 1 {
            Reading::Loudest { first, last }
        } else {
            let bin = position.floor() as usize;
            Reading::Between {
                bin,
                fraction: position - bin as f64,
            }
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn low_points_interpolate_and_high_points_take_the_loudest() {
        let mut readings_ = [Reading::Beyond; GRID_POINTS];
        readings(8192, 48_000.0, frequency, &mut readings_);
        assert!(matches!(readings_[0], Reading::Between { bin: 1, .. }));
        assert!(matches!(readings_[250], Reading::Loudest { .. }));
        // 30 kHz is above a 48 kHz Nyquist.
        assert_eq!(readings_[GRID_POINTS - 1], Reading::Beyond);
        // Every bin up to Nyquist from the first loudest read is read once.
        let mut next = None;
        for reading in readings_ {
            if let Reading::Loudest { first, last } = reading {
                if let Some(next) = next {
                    assert_eq!(first, next);
                }
                next = Some(last + 1);
            }
        }
    }

    #[test]
    fn spectrogram_bins_read_every_fft_bin_or_between_them() {
        let mut readings_ = vec![Reading::Beyond; SPECTROGRAM_BINS];
        // 23 Hz apart: wider than the spectrogram's 7.3 Hz bins.
        readings(2048, 48_000.0, bin_frequency, &mut readings_);
        assert!(matches!(readings_[100], Reading::Between { .. }));
        // 2.9 Hz apart: narrower.
        readings(16384, 48_000.0, bin_frequency, &mut readings_);
        assert!(matches!(readings_[100], Reading::Loudest { .. }));
        assert_eq!(readings_[SPECTROGRAM_BINS - 1], Reading::Beyond);
    }
}
