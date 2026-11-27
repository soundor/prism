//! The controller side: hands the processor the analyzer's settings.

use soundor::prelude::*;
use soundor::types::AnalyzerMode;

use crate::analyzer;

/// Prism's controller. The editor binds to the parameters and state
/// soundor.config declares; the controller only passes the analyzer's
/// settings on, as the processor cannot read enum state itself.
pub struct PluginController;

impl Controller for PluginController {
    type Local = ();
    type Shared = ();
}

impl NativeMethods for PluginController {
    /// Publishes the analyzer's settings from state to the processor, which
    /// analyzes while `enabled` and the editor shows the analyzer or the
    /// spectrogram (see `analyzer::Settings::decode` for the layout). The
    /// editor calls it when it opens, when a setting changes and when it
    /// closes.
    fn analyze(ctx: &mut TaskContext<'_, Self>, enabled: bool) {
        let state = &ctx.state;
        let mut shown = 0;
        if state.analyzer_mode.get() != AnalyzerMode::Off {
            shown |= analyzer::SPECTRUM;
        }
        if state.show_spectrogram.get() {
            shown |= analyzer::SPECTROGRAM;
        }
        let settings = [
            state.analyzer_fft_size.get() as u32,
            state.analyzer_window.get() as u32,
            state.analyzer_speed.get() as u32,
            if enabled { shown } else { 0 },
        ];
        ctx.processor
            .resources()
            .analyzer
            .publish(settings.to_vec());
    }
}
