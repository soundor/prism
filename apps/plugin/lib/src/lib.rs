//! Prism's audio processing: a 24-band parametric equalizer.

mod controller;
pub mod engine;
pub mod filter;
mod meter;
mod parameters;
mod processor;

pub use controller::PluginController;
pub use parameters::{BANDS, BandParameters, band_parameters};
pub use processor::PluginProcessor;

// The analyzer will be built on rustfft; until then only the tests use it,
// so this keeps the dependency from being unused.
use rustfft as _;

soundor::export!(PluginProcessor, PluginController);
