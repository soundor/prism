mod eq;

use eq::Equalizer;
use soundor::prelude::*;

#[derive(Default)]
pub struct PluginProcessor(Equalizer);

impl Processor for PluginProcessor {
    fn prepare(&mut self, ctx: &PrepareContext) {
        self.0.prepare(ctx.sample_rate);
        let p = ctx.params;
        self.0
            .configure([p.low, p.low_mid, p.high_mid, p.high], p.bypass);
        self.0.reset();
    }

    fn process(&mut self, ctx: &mut ProcessContext) {
        let p = ctx.params;
        self.0
            .configure([p.low, p.low_mid, p.high_mid, p.high], p.bypass);
        let mut channels = ctx.audio.channels();
        let Some(left) = channels.next() else { return };
        if let Some(right) = channels.next() {
            for (left, right) in left.iter_mut().zip(right) {
                [*left, *right] = self.0.tick([*left, *right]);
            }
        } else {
            for left in left {
                *left = self.0.tick([*left, 0.0])[0];
            }
        }
    }

    fn reset(&mut self) {
        self.0.reset();
    }
}

pub struct PluginController;

impl Controller for PluginController {
    type Local = ();
    type Shared = ();
}

soundor::export!(PluginProcessor, PluginController);
