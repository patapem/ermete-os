use zbus::{interface, Result};
use tracing::info;
use crate::sync::SyncEngine;

pub struct CloudIface;

#[interface(name = "os.ermete.Cloud")]
impl CloudIface {
    /// Syncs local clipboard to trusted peers
    async fn push_clipboard(&self, content: String) -> Result<String> {
        info!("Received D-Bus request to push clipboard to cloud.");
        
        let engine = SyncEngine::new();
        
        match engine.send_clipboard(&content).await {
            Ok(_) => Ok("Clipboard pushed to peers.".into()),
            Err(e) => Ok(format!("Error: {}", e)),
        }
    }
}
