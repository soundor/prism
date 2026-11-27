//! The audio side: the [`Engine`] run over each block the host sends, and
//! the output measured for the editor's meter and analyzer.

use soundor::prelude::*;

use crate::analyzer::{self, Analyzer, Measured, SPECTRUM_LENGTH};
use crate::engine::{Engine, Settings};
use crate::meter::Meter;
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
/// or its only one, with the `Meter` after it and the [`Analyzer`] around
/// it.
#[derive(Default)]
pub struct PluginProcessor {
    engine: Option<Engine>,
    meter: Option<Meter>,
    analyzer: Option<Analyzer>,
}

impl Processor for PluginProcessor {
    fn prepare(&mut self, ctx: &PrepareContext) {
        let bands = band_parameters(ctx.params);
        self.engine = Some(Engine::new(ctx.sample_rate, &settings(ctx.params, &bands)));
        self.meter = Some(Meter::new(ctx.sample_rate));
        self.analyzer = Some(Analyzer::new(ctx.sample_rate));
    }

    fn process(&mut self, ctx: &mut ProcessContext) {
        let (Some(engine), Some(meter), Some(analyzer)) =
            (&mut self.engine, &mut self.meter, &mut self.analyzer)
        else {
            return;
        };
        let bands = band_parameters(ctx.params);
        let settings = settings(ctx.params, &bands);
        analyzer.configure(analyzer::Settings::decode(ctx.resources.analyzer.get()));
        // What the EQ hears: the input after its gain, or as it is when bypassed.
        let pre_gain = if settings.bypass {
            1.0
        } else {
            10f32.powf(ctx.params.input_gain / 20.0)
        };
        let mut measured = Measured::default();
        let mut channels = ctx.audio.channels();
        if let Some(left) = channels.next() {
            let mut right = channels.next();
            analyzer.capture_pre(left, right.as_deref(), pre_gain);
            engine.process(&settings, left, right.as_deref_mut());
            meter.process(left, right.as_deref());
            measured = analyzer.capture_post(left, right.as_deref());
        }
        ctx.streams.output_levels.publish(&meter.levels());
        if measured.spectrum {
            let spectrum = ctx.streams.spectrum.buffer_mut();
            if spectrum.len() >= SPECTRUM_LENGTH {
                analyzer.spectrum(&mut spectrum[..SPECTRUM_LENGTH]);
                ctx.streams.spectrum.commit(SPECTRUM_LENGTH);
            }
        }
        if measured.spectrogram {
            ctx.streams.spectrogram.publish(analyzer.spectrogram());
        }
    }

    fn reset(&mut self) {
        if let Some(engine) = &mut self.engine {
            engine.reset();
        }
        if let Some(meter) = &mut self.meter {
            meter.reset();
        }
        if let Some(analyzer) = &mut self.analyzer {
            analyzer.reset();
        }
    }
}
