//! The part of the signal a band filters, and running a filter over it.

use crate::filter::{Design, State};

/// The part of the signal a band filters.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Channel {
    #[default]
    Stereo,
    Left,
    Right,
    /// (L + R) / 2.
    Mid,
    /// (L - R) / 2.
    Side,
}

impl Channel {
    /// The channel at its index, in the order soundor.config declares them.
    pub fn from_index(index: u32) -> Self {
        match index {
            1 => Self::Left,
            2 => Self::Right,
            3 => Self::Mid,
            4 => Self::Side,
            _ => Self::Stereo,
        }
    }
}

/// Runs `design` over the part of `(left, right)` that `channel` names, and
/// mixes the result in by `amount`. A mono signal comes as `left == right`.
#[inline]
pub(super) fn route(
    design: &Design,
    states: &mut [State; 2],
    channel: Channel,
    amount: f64,
    replace: bool,
    (left, right): (f64, f64),
) -> (f64, f64) {
    // With `replace` (solo), what the band doesn't filter is silent; without
    // it, it is left as it was.
    let keep = if replace { 0.0 } else { 1.0 };
    let mix = |dry: f64, wet: f64| dry + amount * (wet - dry);
    match channel {
        Channel::Stereo => (
            mix(left, design.tick(&mut states[0], left)),
            mix(right, design.tick(&mut states[1], right)),
        ),
        Channel::Left => (
            mix(left, design.tick(&mut states[0], left)),
            mix(right, keep * right),
        ),
        Channel::Right => (
            mix(left, keep * left),
            mix(right, design.tick(&mut states[1], right)),
        ),
        Channel::Mid | Channel::Side => {
            let mid = 0.5 * (left + right);
            let side = 0.5 * (left - right);
            let (mid, side) = if channel == Channel::Mid {
                (
                    mix(mid, design.tick(&mut states[0], mid)),
                    mix(side, keep * side),
                )
            } else {
                (
                    mix(mid, keep * mid),
                    mix(side, design.tick(&mut states[0], side)),
                )
            };
            (mid + side, mid - side)
        }
    }
}
