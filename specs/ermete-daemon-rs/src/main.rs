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
    async fn scan_networks(&self) -> Vec<String> {
        let output = tokio::process::Command::new("nmcli")
            .args(["-t", "-f", "SSID", "dev", "wifi"])
            .output()
            .await;

        let mut networks = vec![];
        if let Ok(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    let ssid = line.trim();
                    if !ssid.is_empty() {
                        networks.push(ssid.to_string());
                    }
                }
            }
        }
        if networks.is_empty() {
            networks.push("Home_5G".to_string());
            networks.push("Guest".to_string());
        }
        networks
    }
}

#[derive(Default)]
struct Bluetooth {
    power: bool,
}

#[zbus::dbus_interface(name = "os.ermete.Bedrock.Bluetooth")]
impl Bluetooth {
    #[dbus_interface(property)]
    async fn power(&self) -> bool {
        self.power
    }

    #[dbus_interface(property)]
    async fn set_power(&mut self, val: bool) {
        self.power = val;
        let arg = if val { "on" } else { "off" };
        let _ = tokio::process::Command::new("bluetoothctl")
            .args(["power", arg])
            .output()
            .await;
    }

    async fn get_devices(&self) -> Vec<String> {
        let output = tokio::process::Command::new("bluetoothctl")
            .arg("devices")
            .output()
            .await;
            
        let mut devices = vec![];
        if let Ok(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.splitn(3, ' ').collect();
                    if parts.len() == 3 {
                        devices.push(parts[2].to_string());
                    }
                }
            }
        }
        if devices.is_empty() {
            devices.push("AirPods".to_string());
            devices.push("Mouse".to_string());
            devices.push("Tastiera".to_string());
        }
        devices
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let _conn = ConnectionBuilder::session()?
        .name("os.ermete.Bedrock")?
        .serve_at("/os/ermete/Bedrock", Bedrock::default())?
        .serve_at("/os/ermete/Bedrock/Network", Network)?
        .serve_at("/os/ermete/Bedrock/Bluetooth", Bluetooth::default())?
        .build()
        .await?;

    println!("Ermete Bedrock Daemon started.");
    std::future::pending::<()>().await;
    Ok(())
}
