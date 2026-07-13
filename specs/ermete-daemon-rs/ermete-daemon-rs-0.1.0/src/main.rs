use std::error::Error;
use zbus::ConnectionBuilder;

#[derive(Default)]
struct Bedrock {
    volume: f64,
}

#[zbus::dbus_interface(name = "os.ermete.Bedrock")]
impl Bedrock {
    async fn ping(&self) -> String {
        "pong".to_string()
    }

    #[dbus_interface(property, name = "Volume")]
    async fn audio_volume(&self) -> f64 {
        self.volume
    }

    #[dbus_interface(property, name = "Volume")]
    async fn set_audio_volume(&mut self, val: f64) {
        self.volume = val;
        
        match tokio::process::Command::new("wpctl")
            .args(["set-volume", "@DEFAULT_AUDIO_SINK@", &val.to_string()])
            .output()
            .await
        {
            Ok(output) => {
                if !output.status.success() {
                    eprintln!("wpctl failed with status: {}", output.status);
                    if let Ok(err) = String::from_utf8(output.stderr) {
                        eprintln!("wpctl stderr: {}", err);
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to execute wpctl: {}", e);
            }
        }
    }
}

struct Network;

#[zbus::dbus_interface(name = "os.ermete.Bedrock.Network")]
impl Network {
    async fn scan_networks(&self) -> zbus::fdo::Result<Vec<String>> {
        let output = tokio::process::Command::new("nmcli")
            .args(["-t", "-f", "SSID", "dev", "wifi"])
            .output()
            .await
            .map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;

        let mut networks = vec![];
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let ssid = line.trim();
                if !ssid.is_empty() {
                    networks.push(ssid.to_string());
                }
            }
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(zbus::fdo::Error::Failed(format!("nmcli failed: {}", stderr)));
        }
        Ok(networks)
    }
}

struct Bluetooth {
    power: bool,
}

impl Bluetooth {
    fn new() -> Self {
        let mut power = false;
        if let Ok(output) = std::process::Command::new("bluetoothctl").arg("show").output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("Powered: yes") {
                power = true;
            }
        }
        Self { power }
    }
}

#[zbus::dbus_interface(name = "os.ermete.Bedrock.Bluetooth")]
impl Bluetooth {
    #[dbus_interface(property)]
    async fn power(&self) -> bool {
        self.power
    }

    #[dbus_interface(property)]
    async fn set_power(&mut self, val: bool) -> zbus::fdo::Result<()> {
        let arg = if val { "on" } else { "off" };
        let output = tokio::process::Command::new("bluetoothctl")
            .args(["power", arg])
            .output()
            .await
            .map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;
            
        if output.status.success() {
            self.power = val;
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(zbus::fdo::Error::Failed(format!("bluetoothctl power failed: {}", stderr)))
        }
    }

    async fn get_devices(&self) -> zbus::fdo::Result<Vec<String>> {
        let output = tokio::process::Command::new("bluetoothctl")
            .arg("devices")
            .output()
            .await
            .map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;
            
        let mut devices = vec![];
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.splitn(3, ' ').collect();
                if parts.len() == 3 {
                    devices.push(parts[2].to_string());
                }
            }
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(zbus::fdo::Error::Failed(format!("bluetoothctl devices failed: {}", stderr)));
        }
        Ok(devices)
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let _conn = ConnectionBuilder::session()?
        .name("os.ermete.Bedrock")?
        .serve_at("/os/ermete/Bedrock", Bedrock::default())?
        .serve_at("/os/ermete/Bedrock/Network", Network)?
        .serve_at("/os/ermete/Bedrock/Bluetooth", Bluetooth::new())?
        .build()
        .await?;

    println!("Ermete Bedrock Daemon started.");
    std::future::pending::<()>().await;
    Ok(())
}
