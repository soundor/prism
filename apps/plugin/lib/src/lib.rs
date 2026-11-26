use soundor::prelude::*;

/// Prism's processor. The band, bypass and gain parameters are declared, but
/// the audio is not processed yet: every block passes through unchanged.
#[derive(Default)]
pub struct PluginProcessor;

impl Processor for PluginProcessor {
    fn prepare(&mut self, _ctx: &PrepareContext) {}

    fn process(&mut self, _ctx: &mut ProcessContext) {}

    fn reset(&mut self) {}
}

pub struct PluginController;

impl Controller for PluginController {
    type Local = ();
    type Shared = ();
}

soundor::export!(PluginProcessor, PluginController);

#[cfg(test)]
mod tests {
    use super::PluginProcessor;
    use soundor::testing::TestProcessor;

    fn signal(frames: usize, phase: f32) -> Vec<f32> {
        (0..frames)
            .map(|i| (i as f32 * 0.05 + phase).sin() * 0.5)
            .collect()
    }

    #[test]
    fn passes_audio_through_unchanged() {
        let input = [signal(1024, 0.0), signal(1024, 1.0)];
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .sample_rate(48_000.0)
            .block_size(256)
            .channels(2)
            .parameter("band1Active", 1.0)
            .parameter("band1Gain", 12.0)
            .parameter("inputGain", -6.0)
            .build();
        assert_eq!(processor.process(&input), input);
    }

    #[test]
    fn bypass_passes_audio_through_unchanged() {
        let input = [signal(512, 0.3), signal(512, 2.0)];
        let mut processor = TestProcessor::<PluginProcessor>::new()
            .channels(2)
            .parameter("bypass", 1.0)
            .build();
        assert_eq!(processor.process(&input), input);
    }
}
