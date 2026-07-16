use zbus::interface;
use tracing::info;
use crate::wipe::WipeEngine;

pub struct MdmIface;

#[interface(name = "os.ermete.Mdm")]
impl MdmIface {
    /// Manually trigger a local device wipe (e.g. from the UI before giving PC away)
    async fn trigger_local_wipe(&self) -> std::result::Result<String, zbus::fdo::Error> {
        info!("Received D-Bus request to trigger LOCAL WIPE.");
        
        let engine = WipeEngine::new();
        
        // This is extremely dangerous, requires Polkit auth
        match engine.execute_cryptsetup_erase().await {
            Ok(_) => Ok("Wipe initiated. System halting.".into()),
            Err(e) => Ok(format!("Error: {}", e)),
        }
    }
}
