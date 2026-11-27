//! Prism's audio processing: a 24-band parametric equalizer.

pub mod analyzer;
mod controller;
pub mod engine;
pub mod filter;
mod meter;
mod parameters;
mod processor;

pub use controller::PluginController;
pub use parameters::{BANDS, BandParameters, band_parameters};
pub use processor::PluginProcessor;

soundor::export!(PluginProcessor, PluginController);
