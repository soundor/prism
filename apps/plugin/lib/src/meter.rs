//! The output meter: each channel's peak level, held long enough for the
//! editor to see it.
//!
//! The editor reads the latest level once a frame and skips the rest, so a
//! level published per block would let a short peak fall between two frames.
//! Each channel's level is instead the loudest sample of the last
//! [`HOLD_SECONDS`], kept as the peaks of a few short segments: a frame at
//! 30 Hz or faster sees every peak at least once.

/// How long a peak stays in the published level, in seconds.
pub const HOLD_SECONDS: f64 = 0.05;
/// The segments the hold is kept in: the level is the loudest of them and
/// the one being filled.
const SEGMENTS: usize = 5;
/// The level of silence, in dBFS: below anything the editor draws.
pub const SILENCE: f32 = -120.0;

/// One channel's peaks over the hold.
#[derive(Clone, Copy, Default)]
struct Hold {
    /// The finished segments' peaks, as linear amplitudes.
    segments: [f32; SEGMENTS],
    /// The peak of the segment being filled.
    current: f32,
}

impl Hold {
    fn level(&self) -> f32 {
        self.segments
            .iter()
            .fold(self.current, |peak, &s| peak.max(s))
    }
}

/// Both channels' peak levels.
pub struct Meter {
    holds: [Hold; 2],
    /// Samples in one segment.
    segment: usize,
    /// Samples counted into the current segment.
    filled: usize,
    /// The segment the current one replaces once full.
    next: usize,
}

impl Meter {
    pub fn new(sample_rate: f64) -> Self {
        Self {
            holds: Default::default(),
            segment: ((HOLD_SECONDS * sample_rate / SEGMENTS as f64).round() as usize).max(1),
            filled: 0,
            next: 0,
        }
    }

    /// Forgets every peak, as after a stop.
    pub fn reset(&mut self) {
        self.holds = Default::default();
        self.filled = 0;
    }

    /// Takes in a block of output; `right` is `None` for a mono signal,
    /// which both channels then show.
    pub fn process(&mut self, left: &[f32], right: Option<&[f32]>) {
        for i in 0..left.len() {
            let l = left[i].abs();
            let r = right.map_or(l, |right| right[i].abs());
            // `max` drops a NaN, so a bad sample does not stick.
            self.holds[0].current = self.holds[0].current.max(l);
            self.holds[1].current = self.holds[1].current.max(r);
            self.filled += 1;
            if self.filled == self.segment {
                for hold in &mut self.holds {
                    hold.segments[self.next] = hold.current;
                    hold.current = 0.0;
                }
                self.next = (self.next + 1) % SEGMENTS;
                self.filled = 0;
            }
        }
    }

    /// Each channel's level, in dBFS, no lower than [`SILENCE`].
    pub fn levels(&self) -> [f32; 2] {
        self.holds.map(|hold| decibels(hold.level()))
    }
}

fn decibels(amplitude: f32) -> f32 {
    if amplitude.is_finite() {
        (20.0 * amplitude.log10()).max(SILENCE)
    } else {
        // An infinite sample: as loud as can be shown, which latches clip.
        f32::MAX
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_peak_stays_for_the_hold_then_goes() {
        let rate = 48_000.0;
        let mut meter = Meter::new(rate);
        let mut block = [0.0f32; 64];
        block[10] = 0.5;
        meter.process(&block, None);
        assert!((meter.levels()[0] - -6.0206).abs() < 1e-3);

        let silence = [0.0f32; 64];
        let hold = (HOLD_SECONDS * rate) as usize;
        let mut frames = 64;
        while frames + 64 < hold - meter.segment {
            meter.process(&silence, None);
            frames += 64;
            assert!(meter.levels()[0] > -7.0, "dropped after {frames} frames");
        }
        for _ in 0..(hold / 64 + 2) {
            meter.process(&silence, None);
        }
        assert_eq!(meter.levels(), [SILENCE, SILENCE]);
    }

    #[test]
    fn channels_are_measured_apart() {
        let mut meter = Meter::new(48_000.0);
        meter.process(&[0.25, -1.0], Some(&[0.1, 0.0]));
        let [left, right] = meter.levels();
        assert!(left.abs() < 1e-4);
        assert!((right - -20.0).abs() < 1e-3);
    }
}
