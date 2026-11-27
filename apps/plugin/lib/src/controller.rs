//! The controller side: no state of its own yet.

use soundor::prelude::*;

/// Prism's controller. The editor binds to the parameters and state
/// soundor.config declares, so there is nothing for it to hold or do yet.
pub struct PluginController;

impl Controller for PluginController {
    type Local = ();
    type Shared = ();
}
