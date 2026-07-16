use zbus::{interface, Result};
use tracing::info;
use crate::flatpak::FlatpakManager;

pub struct StoreIface;

#[interface(name = "os.ermete.Store")]
impl StoreIface {
    /// Installs a Flatpak app system-wide. Polkit auth required.
    async fn install_app(&self, app_id: String) -> Result<String> {
        info!("Received D-Bus request to install app: {}", app_id);
        
        let manager = FlatpakManager::new();
        
        match manager.install_app(&app_id).await {
            Ok(_) => Ok(format!("Successfully installed {}", app_id)),
            Err(e) => Ok(format!("Error: {}", e)),
        }
    }
}
