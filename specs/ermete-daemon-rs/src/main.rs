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

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let _conn = ConnectionBuilder::session()?
        .name("os.ermete.Bedrock")?
        .serve_at("/os/ermete/Bedrock", Bedrock::default())?
        .build()
        .await?;

    println!("Ermete Bedrock Daemon started.");
    std::future::pending::<()>().await;
    Ok(())
}
