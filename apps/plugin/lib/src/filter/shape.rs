//! The settings a band's filter is designed from, as its parameters hold
//! them.

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum FilterType {
    #[default]
    Bell,
    LowShelf,
    HighShelf,
    LowCut,
    HighCut,
    Notch,
    BandPass,
}

impl FilterType {
    /// The type at its index, in the order soundor.config declares them.
    pub fn from_index(index: u32) -> Self {
        match index {
            1 => Self::LowShelf,
            2 => Self::HighShelf,
            3 => Self::LowCut,
            4 => Self::HighCut,
            5 => Self::Notch,
            6 => Self::BandPass,
            _ => Self::Bell,
        }
    }

    pub fn is_cut(self) -> bool {
        matches!(self, Self::LowCut | Self::HighCut)
    }
}

/// A cut's slope, in dB per octave.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Slope {
    Db6,
    #[default]
    Db12,
    Db24,
    Db36,
    Db48,
}

impl Slope {
    /// The slope at its index, in the order soundor.config declares them.
    pub fn from_index(index: u32) -> Self {
        match index {
            0 => Self::Db6,
            2 => Self::Db24,
            3 => Self::Db36,
            4 => Self::Db48,
            _ => Self::Db12,
        }
    }

    /// The filter's order: one pole for each 6 dB/oct.
    pub(super) fn order(self) -> usize {
        match self {
            Self::Db6 => 1,
            Self::Db12 => 2,
            Self::Db24 => 4,
            Self::Db36 => 6,
            Self::Db48 => 8,
        }
    }
}

/// A band's settings.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Shape {
    pub filter_type: FilterType,
    /// Hz.
    pub frequency: f64,
    /// dB; only bells and shelves use it.
    pub gain: f64,
    pub q: f64,
    /// Only cuts use it.
    pub slope: Slope,
}

impl Default for Shape {
    fn default() -> Self {
        Self {
            filter_type: FilterType::Bell,
            frequency: 1000.0,
            gain: 0.0,
            q: 0.707,
            slope: Slope::Db12,
        }
    }
}
