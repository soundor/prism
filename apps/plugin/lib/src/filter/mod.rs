//! One band's filter: its type, frequency, gain, Q and slope turned into up to
//! four stages, and those stages run over samples.
//!
//! Every second-order stage is Andrew Simper's state variable filter, with
//! fundsp's coefficients; a 6 dB/oct cut is the matching one-pole. Both are
//! the bilinear transform of the analog prototypes that R. Bristow-Johnson's
//! Audio EQ Cookbook uses, so a band sounds as the graph draws it
//! (`src/graph/response.ts`): the tests hold the two together.
//!
//! The state variable form is kept for what comes next: its coefficients can
//! change while it runs without the state blowing up, as a parameter is
//! smoothed or automated.
//!
//! - `shape`: the settings a band is designed from.
//! - `stage`: one second- or first-order section.
//! - `design`: a band's stages for one sample rate, and their memory.
//! - `ramp`: a design gliding to the next, a sample at a time.

mod design;
mod ramp;
mod shape;
mod stage;

pub use design::{Design, MAX_STAGES, NEUTRAL_Q, State};
pub use ramp::Ramp;
pub use shape::{FilterType, Shape, Slope};
