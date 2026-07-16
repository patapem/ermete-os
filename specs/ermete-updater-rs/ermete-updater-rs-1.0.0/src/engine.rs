use anyhow::{Context, Result};
use tracing::{info, warn};
use std::process::Command;

#[derive(Debug)]
pub enum UpdateStatus {
    NoUpdates,
    Layer1AppliedLive,
    Layer0RebootRequired,
}

pub struct UpdateEngine {
    // In the future, this will hold zbus connections for D-Bus IPC
    // conn: zbus::Connection,
}

impl UpdateEngine {
    pub async fn new() -> Result<Self> {
        info!("Initializing UpdateEngine...");
        // let conn = zbus::Connection::system().await?;
        Ok(Self {})
    }

    pub async fn check_and_apply(&mut self) -> Result<UpdateStatus> {
        // Step 1: Check Layer 1 (Userspace) updates via rpm-ostree
        info!("Checking rpm-ostree for Layer 1 updates...");
        
        // This is a placeholder logic. Real implementation will use D-Bus
        // to query `org.projectatomic.rpmostree1`.
        let ostree_output = Command::new("rpm-ostree")
            .arg("status")
            .output()
            .context("Failed to execute rpm-ostree")?;

        let status_str = String::from_utf8_lossy(&ostree_output.stdout);
        
        if status_str.contains("AvailableUpdate") {
            info!("Layer 1 updates found. Applying live...");
            // Command::new("rpm-ostree").arg("apply-live").status()?;
            return Ok(UpdateStatus::Layer1AppliedLive);
        }

        // Step 2: Check Layer 0 (Core OS) updates via bootc
        info!("Checking bootc for Layer 0 updates...");
        
        // This is a placeholder logic for `bootc upgrade`.
        let bootc_output = Command::new("bootc")
            .arg("status")
            .output()
            .context("Failed to execute bootc")?;

        let bootc_str = String::from_utf8_lossy(&bootc_output.stdout);
        
        if bootc_str.contains("Update available") {
            info!("Layer 0 core update found. Stage for next reboot...");
            // Command::new("bootc").arg("upgrade").status()?;
            warn!("A system reboot is required to apply the new Kernel/DKMS layer.");
            return Ok(UpdateStatus::Layer0RebootRequired);
        }

        Ok(UpdateStatus::NoUpdates)
    }
}
