//! The band slots' parameters, read out of the generated [`Parameters`].

use soundor::prelude::*;

use crate::engine::Channel;
use crate::filter::{FilterType, Shape, Slope};

/// How many band slots soundor.config declares.
pub const BANDS: usize = 24;

/// One slot's parameters, read out of the block's [`Parameters`].
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct BandParameters {
    /// Whether the slot holds a band at all.
    pub active: bool,
    /// The band's own on/off: off, it stays in place but doesn't filter.
    pub enabled: bool,
    pub shape: Shape,
    pub channel: Channel,
    pub solo: bool,
}

impl BandParameters {
    /// Whether the band filters the audio.
    pub fn audible(&self) -> bool {
        self.active && self.enabled
    }
}

/// Every slot's parameters. The generated [`Parameters`] has a field per
/// slot and setting, so the slots are listed out here.
pub fn band_parameters(p: &Parameters) -> [BandParameters; BANDS] {
    macro_rules! slots {
        ($($active:ident $enabled:ident $kind:ident $frequency:ident $gain:ident $q:ident $slope:ident $channel:ident $solo:ident;)*) => {
            [$(BandParameters {
                active: p.$active,
                enabled: p.$enabled,
                shape: Shape {
                    filter_type: FilterType::from_index(p.$kind.index()),
                    frequency: f64::from(p.$frequency),
                    gain: f64::from(p.$gain),
                    q: f64::from(p.$q),
                    slope: Slope::from_index(p.$slope.index()),
                },
                channel: Channel::from_index(p.$channel.index()),
                solo: p.$solo,
            }),*]
        };
    }
    slots! {
        band1_active band1_enabled band1_type band1_frequency band1_gain band1_q band1_slope band1_channel band1_solo;
        band2_active band2_enabled band2_type band2_frequency band2_gain band2_q band2_slope band2_channel band2_solo;
        band3_active band3_enabled band3_type band3_frequency band3_gain band3_q band3_slope band3_channel band3_solo;
        band4_active band4_enabled band4_type band4_frequency band4_gain band4_q band4_slope band4_channel band4_solo;
        band5_active band5_enabled band5_type band5_frequency band5_gain band5_q band5_slope band5_channel band5_solo;
        band6_active band6_enabled band6_type band6_frequency band6_gain band6_q band6_slope band6_channel band6_solo;
        band7_active band7_enabled band7_type band7_frequency band7_gain band7_q band7_slope band7_channel band7_solo;
        band8_active band8_enabled band8_type band8_frequency band8_gain band8_q band8_slope band8_channel band8_solo;
        band9_active band9_enabled band9_type band9_frequency band9_gain band9_q band9_slope band9_channel band9_solo;
        band10_active band10_enabled band10_type band10_frequency band10_gain band10_q band10_slope band10_channel band10_solo;
        band11_active band11_enabled band11_type band11_frequency band11_gain band11_q band11_slope band11_channel band11_solo;
        band12_active band12_enabled band12_type band12_frequency band12_gain band12_q band12_slope band12_channel band12_solo;
        band13_active band13_enabled band13_type band13_frequency band13_gain band13_q band13_slope band13_channel band13_solo;
        band14_active band14_enabled band14_type band14_frequency band14_gain band14_q band14_slope band14_channel band14_solo;
        band15_active band15_enabled band15_type band15_frequency band15_gain band15_q band15_slope band15_channel band15_solo;
        band16_active band16_enabled band16_type band16_frequency band16_gain band16_q band16_slope band16_channel band16_solo;
        band17_active band17_enabled band17_type band17_frequency band17_gain band17_q band17_slope band17_channel band17_solo;
        band18_active band18_enabled band18_type band18_frequency band18_gain band18_q band18_slope band18_channel band18_solo;
        band19_active band19_enabled band19_type band19_frequency band19_gain band19_q band19_slope band19_channel band19_solo;
        band20_active band20_enabled band20_type band20_frequency band20_gain band20_q band20_slope band20_channel band20_solo;
        band21_active band21_enabled band21_type band21_frequency band21_gain band21_q band21_slope band21_channel band21_solo;
        band22_active band22_enabled band22_type band22_frequency band22_gain band22_q band22_slope band22_channel band22_solo;
        band23_active band23_enabled band23_type band23_frequency band23_gain band23_q band23_slope band23_channel band23_solo;
        band24_active band24_enabled band24_type band24_frequency band24_gain band24_q band24_slope band24_channel band24_solo;
    }
}
