use zbus::interface;
use tracing::info;
use std::collections::HashMap;

pub struct ErmetePortal;

#[interface(name = "org.freedesktop.impl.portal.ScreenCast")]
impl ErmetePortal {
    /// Creates a ScreenCast session. This is what prompts the user for permission.
    async fn create_session(&self, handle: String, session_handle: String, app_id: String, options: HashMap<String, zbus::zvariant::Value<'_>>) -> std::result::Result<u32, zbus::fdo::Error> {
        info!("App {} requested ScreenCast. Prompting user...", app_id);
        // Placeholder: We would trigger a GTK4 prompt here, or tell Niri/PipeWire to handle it
        // 0 = Success, 1 = User Cancelled, 2 = Other Error
        Ok(0) 
    }
}

// We would implement org.freedesktop.impl.portal.Camera, Location, FileChooser, etc.
