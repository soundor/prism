//! The audio side: the [`Engine`] run over each block the host sends.

use soundor::prelude::*;

use crate::engine::{Engine, Settings};
use crate::parameters::{BANDS, BandParameters, band_parameters};

fn settings<'a>(p: &Parameters, bands: &'a [BandParameters; BANDS]) -> Settings<'a> {
    Settings {
        bands,
        bypass: p.bypass,
        input_gain: f64::from(p.input_gain),
        output_gain: f64::from(p.output_gain),
    }
}

/// Prism's processor: the [`Engine`] over the main bus's first two channels,
/// or its only one.
#[derive(Default)]
pub struct PluginProcessor {
    engine: Option<Engine>,
}

impl Processor for PluginProcessor {
    fn prepare(&mut self, ctx: &PrepareContext) {
        let bands = band_parameters(ctx.params);
        self.engine = Some(Engine::new(ctx.sample_rate, &settings(ctx.params, &bands)));
    }

    fn process(&mut self, ctx: &mut ProcessContext) {
        let Some(engine) = &mut self.engine else {
            return;
        };
        let bands = band_parameters(ctx.params);
        let settings = settings(ctx.params, &bands);
        let mut channels = ctx.audio.channels();
        if let Some(left) = channels.next() {
            engine.process(&settings, left, channels.next());
        }
    }

    fn reset(&mut self) {
        if let Some(engine) = &mut self.engine {
            engine.reset();
        }
    }
}
