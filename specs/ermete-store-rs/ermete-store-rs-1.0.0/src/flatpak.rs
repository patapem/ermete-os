use anyhow::{Context, Result};
use tokio::process::Command;
use tracing::info;

pub struct FlatpakManager;

impl FlatpakManager {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn sync_remotes(&self) -> Result<()> {
        info!("Synchronizing Flatpak remotes...");
        // This is a system-wide call, so the daemon runs as root
        let _ = Command::new("flatpak")
            .arg("update")
            .arg("--appstream")
            .arg("-y")
            .output()
            .await
            .context("Failed to sync flatpak appstream")?;
        
        Ok(())
    }
    
    pub async fn install_app(&self, app_id: &str) -> Result<()> {
        info!("Installing Flatpak app: {}", app_id);
        
        let output = Command::new("flatpak")
            .arg("install")
            .arg("flathub")
            .arg(app_id)
            .arg("-y")
            .arg("--noninteractive")
            .output()
            .await?;
            
        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Flatpak installation failed: {}", err);
        }
        
        Ok(())
    }
}
