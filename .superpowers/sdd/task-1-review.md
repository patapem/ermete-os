# Review package: 8e47fde66ce8f59ca17abea8239a84148e8c9c4e..HEAD

## Commits
653eee4c feat(control-center): eliminate CLI subprocesses with asynchronous D-Bus proxies and system proxies

## Files changed
 .../ermete-shell-rs-1.0.0/src/core/live_state.rs   |  70 +-
 .../ermete-shell-rs-1.0.0/src/core/mod.rs          |  34 +-
 .../ermete-shell-rs-1.0.0/src/core/mpris.rs        |  35 +-
 .../src/core/system_proxies.rs                     | 731 +++++++++++++++++++++
 .../ermete-shell-rs-1.0.0/src/main.rs              |   1 +
 .../ermete-shell-rs-1.0.0/src/ui/control_center.rs | 381 ++++++-----
 6 files changed, 966 insertions(+), 286 deletions(-)

## Diff
diff --git a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/live_state.rs b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/live_state.rs
index f330197d..4e4fd1df 100644
--- a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/live_state.rs
+++ b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/live_state.rs
@@ -1,11 +1,10 @@
-use std::process::Command;
 use std::fs;
 
 #[derive(Debug, Clone)]
 pub struct LiveState {
     pub volume: f64,
     pub brightness: f64,
     pub ram_percent: f64,
     pub battery_percent: f64,
     pub has_battery: bool,
 }
@@ -18,69 +17,58 @@ impl Default for LiveState {
             ram_percent: 0.0,
             battery_percent: 0.0,
             has_battery: false,
         }
     }
 }
 
 pub fn get_live_state() -> LiveState {
     let mut state = LiveState::default();
 
-    // Volume
-    if let Ok(output) = Command::new("wpctl")
-        .arg("get-volume")
-        .arg("@DEFAULT_AUDIO_SINK@")
-        .output()
-    {
-        if let Ok(out_str) = String::from_utf8(output.stdout) {
-            let parts: Vec<&str> = out_str.split_whitespace().collect();
-            if parts.len() >= 2 && parts[0] == "Volume:" {
-                if let Ok(vol) = parts[1].parse::<f64>() {
-                    state.volume = vol;
-                }
-            }
-        }
-    }
+    // Volume from SystemController D-Bus proxy cache
+    state.volume = crate::core::system_proxies::get_global_controller().get_cached_volume() * 100.0;
 
-    // Brightness
-    if let Ok(output) = Command::new("brightnessctl")
-        .arg("-m")
-        .output()
-    {
-        if let Ok(out_str) = String::from_utf8(output.stdout) {
-            let parts: Vec<&str> = out_str.trim().split(',').collect();
-            if parts.len() >= 4 {
-                let percent_str = parts[3].trim_end_matches('%');
-                if let Ok(bright) = percent_str.parse::<f64>() {
-                    state.brightness = bright;
+    // Brightness via sysfs natively in pure Rust
+    if let Ok(entries) = fs::read_dir("/sys/class/backlight") {
+        for entry in entries.flatten() {
+            let path = entry.path();
+            if let (Ok(cur_str), Ok(max_str)) = (
+                fs::read_to_string(path.join("brightness")),
+                fs::read_to_string(path.join("max_brightness")),
+            ) {
+                if let (Ok(cur), Ok(max)) = (cur_str.trim().parse::<f64>(), max_str.trim().parse::<f64>()) {
+                    if max > 0.0 {
+                        state.brightness = (cur / max) * 100.0;
+                    }
                 }
             }
         }
     }
 
-    // RAM
-    if let Ok(output) = Command::new("free")
-        .output()
-    {
-        if let Ok(out_str) = String::from_utf8(output.stdout) {
-            let lines: Vec<&str> = out_str.lines().collect();
-            if lines.len() >= 2 {
-                let parts: Vec<&str> = lines[1].split_whitespace().collect();
-                if parts.len() >= 3 && parts[0] == "Mem:" {
-                    if let (Ok(total), Ok(used)) = (parts[1].parse::<f64>(), parts[2].parse::<f64>()) {
-                        if total > 0.0 {
-                            state.ram_percent = (used / total) * 100.0;
-                        }
-                    }
+    // RAM via /proc/meminfo in pure Rust
+    if let Ok(meminfo) = fs::read_to_string("/proc/meminfo") {
+        let mut total = 0.0;
+        let mut available = 0.0;
+        for line in meminfo.lines() {
+            if line.starts_with("MemTotal:") {
+                if let Some(val_str) = line.split_whitespace().nth(1) {
+                    total = val_str.parse::<f64>().unwrap_or(0.0);
+                }
+            } else if line.starts_with("MemAvailable:") {
+                if let Some(val_str) = line.split_whitespace().nth(1) {
+                    available = val_str.parse::<f64>().unwrap_or(0.0);
                 }
             }
         }
+        if total > 0.0 {
+            state.ram_percent = ((total - available) / total) * 100.0;
+        }
     }
 
     // Battery
     if let Ok(bat_str) = fs::read_to_string("/sys/class/power_supply/BAT0/capacity") {
         if let Ok(bat) = bat_str.trim().parse::<f64>() {
             state.battery_percent = bat;
             state.has_battery = true;
         }
     } else if let Ok(bat_str) = fs::read_to_string("/sys/class/power_supply/BAT1/capacity") {
         if let Ok(bat) = bat_str.trim().parse::<f64>() {
diff --git a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/mod.rs b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/mod.rs
index dd01dbbf..0677e6d4 100644
--- a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/mod.rs
+++ b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/mod.rs
@@ -1,22 +1,22 @@
 pub mod dock_config;
 pub mod dock_data;
 pub mod dock_watcher;
 pub mod network;
 pub mod mpris;
 pub mod niri_state;
 pub mod live_state;
 pub mod niri_client;
 pub mod spring;
+pub mod system_proxies;
 use gtk4::CssProvider;
 use chrono::Local;
-use std::process::Command;
 use serde::Deserialize;
 use zbus::interface;
 
 #[derive(Deserialize, Debug, Clone)]
 pub struct NiriWorkspace {
     pub id: u64,
     pub idx: u64,
     pub name: Option<String>,
     pub output: String,
     pub is_active: bool,
@@ -202,44 +202,14 @@ pub fn get_cpu_load() -> (String, f64) {
             let load = load_str.parse::<f64>().unwrap_or(0.0);
             let frac = (load / 4.0).clamp(0.0, 1.0);
             return (format!("Carico 1m: {}", load_str), frac);
         }
     }
     ("N/D".to_string(), 0.0)
 }
 
 
 pub fn get_network_status() -> (String, String, String) {
-    if let Ok(output) = Command::new("nmcli")
-        .args(["-t", "-f", "TYPE,STATE,NAME", "connection", "show", "--active"])
-        .output()
-    {
-        let stdout = String::from_utf8_lossy(&output.stdout);
-        for line in stdout.lines() {
-            let parts: Vec<&str> = line.split(':').collect();
-            if parts.len() >= 3 {
-                let ctype = parts[0];
-                let state = parts[1];
-                let name = parts[2];
-                if state == "activated" {
-                    if ctype == "802-3-ethernet" || ctype == "ethernet" {
-                        return ("󰈀".to_string(), "Ethernet".to_string(), "Connesso via cavo".to_string());
-                    }
-                    if ctype == "802-11-wireless" || ctype == "wifi" {
-                        return ("".to_string(), "Rete Wi-Fi".to_string(), name.to_string());
-                    }
-                }
-            }
-        }
-    }
-
-    if let Ok(output) = Command::new("nmcli").args(["radio", "wifi"]).output() {
-        let stdout = String::from_utf8_lossy(&output.stdout);
-        if stdout.trim() == "disabled" {
-            return ("󰖪".to_string(), "Rete Wi-Fi".to_string(), "Disattivato".to_string());
-        }
-    }
-
-    ("󰖪".to_string(), "Rete Wi-Fi".to_string(), "Non connesso".to_string())
+    crate::core::system_proxies::get_global_controller().get_cached_network_status()
 }
 
 // Right Section: Authentic macOS Dongles/Status Items
diff --git a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/mpris.rs b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/mpris.rs
index 9f07f9eb..3a50e32d 100644
--- a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/mpris.rs
+++ b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/mpris.rs
@@ -1,43 +1,10 @@
-use std::process::Command;
-
 #[derive(Debug, Clone, PartialEq, Eq)]
 pub struct MprisState {
     pub title: String,
     pub artist: String,
     pub status: String,
 }
 
 pub fn get_mpris_state() -> Option<MprisState> {
-    let status_output = Command::new("playerctl")
-        .arg("status")
-        .output()
-        .ok()?;
-
-    if !status_output.status.success() {
-        return None;
-    }
-
-    let status = String::from_utf8_lossy(&status_output.stdout).trim().to_string();
-
-    let title_output = Command::new("playerctl")
-        .arg("metadata")
-        .arg("xesam:title")
-        .output()
-        .ok()?;
-
-    let title = String::from_utf8_lossy(&title_output.stdout).trim().to_string();
-
-    let artist_output = Command::new("playerctl")
-        .arg("metadata")
-        .arg("xesam:artist")
-        .output()
-        .ok()?;
-
-    let artist = String::from_utf8_lossy(&artist_output.stdout).trim().to_string();
-
-    Some(MprisState {
-        title,
-        artist,
-        status,
-    })
+    crate::core::system_proxies::get_global_controller().get_cached_mpris_state()
 }
diff --git a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/system_proxies.rs b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/system_proxies.rs
new file mode 100644
index 00000000..f898d0b1
--- /dev/null
+++ b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/core/system_proxies.rs
@@ -0,0 +1,731 @@
+use zbus::{proxy, Connection};
+use std::sync::{Arc, Mutex};
+use std::collections::HashMap;
+
+#[proxy(
+    interface = "org.freedesktop.NetworkManager",
+    default_service = "org.freedesktop.NetworkManager",
+    default_path = "/org/freedesktop/NetworkManager"
+)]
+pub trait NetworkManager {
+    #[zbus(property)]
+    fn wireless_enabled(&self) -> zbus::Result<bool>;
+    #[zbus(property)]
+    fn set_wireless_enabled(&self, val: bool) -> zbus::Result<()>;
+    fn get_devices(&self) -> zbus::Result<Vec<zbus::zvariant::OwnedObjectPath>>;
+}
+
+#[proxy(
+    interface = "org.freedesktop.NetworkManager.Device",
+    default_service = "org.freedesktop.NetworkManager"
+)]
+pub trait NmDevice {
+    #[zbus(property)]
+    fn device_type(&self) -> zbus::Result<u32>;
+}
+
+#[proxy(
+    interface = "org.freedesktop.NetworkManager.Device.Wireless",
+    default_service = "org.freedesktop.NetworkManager"
+)]
+pub trait NmWireless {
+    fn get_access_points(&self) -> zbus::Result<Vec<zbus::zvariant::OwnedObjectPath>>;
+    fn request_scan(&self, options: HashMap<&str, zbus::zvariant::Value<'_>>) -> zbus::Result<()>;
+}
+
+#[proxy(
+    interface = "org.freedesktop.NetworkManager.AccessPoint",
+    default_service = "org.freedesktop.NetworkManager"
+)]
+pub trait NmAccessPoint {
+    #[zbus(property)]
+    fn ssid(&self) -> zbus::Result<Vec<u8>>;
+    #[zbus(property)]
+    fn strength(&self) -> zbus::Result<u8>;
+}
+
+#[proxy(
+    interface = "org.bluez.Adapter1",
+    default_service = "org.bluez",
+    default_path = "/org/bluez/hci0"
+)]
+pub trait BlueZ {
+    #[zbus(property)]
+    fn powered(&self) -> zbus::Result<bool>;
+    #[zbus(property)]
+    fn set_powered(&self, val: bool) -> zbus::Result<()>;
+}
+
+#[proxy(
+    interface = "org.freedesktop.login1.Manager",
+    default_service = "org.freedesktop.login1",
+    default_path = "/org/freedesktop/login1"
+)]
+pub trait Logind {
+    fn lock_sessions(&self) -> zbus::Result<()>;
+    fn power_off(&self, interactive: bool) -> zbus::Result<()>;
+    fn reboot(&self, interactive: bool) -> zbus::Result<()>;
+    fn suspend(&self, interactive: bool) -> zbus::Result<()>;
+}
+
+#[proxy(
+    interface = "org.freedesktop.login1.Session",
+    default_service = "org.freedesktop.login1",
+    default_path = "/org/freedesktop/login1/session/auto"
+)]
+pub trait LogindSession {
+    fn set_brightness(&self, subsystem: &str, name: &str, value: u32) -> zbus::Result<()>;
+}
+
+#[proxy(
+    interface = "org.mpris.MediaPlayer2.Player",
+    default_service = "org.mpris.MediaPlayer2.player",
+    default_path = "/org/mpris/MediaPlayer2"
+)]
+pub trait MprisPlayer {
+    fn next(&self) -> zbus::Result<()>;
+    fn previous(&self) -> zbus::Result<()>;
+    fn play_pause(&self) -> zbus::Result<()>;
+    fn play(&self) -> zbus::Result<()>;
+    fn pause(&self) -> zbus::Result<()>;
+    fn stop(&self) -> zbus::Result<()>;
+}
+
+#[proxy(
+    interface = "os.ermete.Bedrock",
+    default_service = "os.ermete.Bedrock",
+    default_path = "/os/ermete/Bedrock"
+)]
+pub trait BedrockAudio {
+    #[zbus(property, name = "Volume")]
+    fn volume(&self) -> zbus::Result<f64>;
+    #[zbus(property, name = "Volume")]
+    fn set_volume(&self, val: f64) -> zbus::Result<()>;
+    #[zbus(property, name = "Muted")]
+    fn muted(&self) -> zbus::Result<bool>;
+    #[zbus(property, name = "Muted")]
+    fn set_muted(&self, val: bool) -> zbus::Result<()>;
+    #[zbus(property, name = "SourceMuted")]
+    fn source_muted(&self) -> zbus::Result<bool>;
+    #[zbus(property, name = "SourceMuted")]
+    fn set_source_muted(&self, val: bool) -> zbus::Result<()>;
+    #[zbus(property, name = "SourceVolume")]
+    fn source_volume(&self) -> zbus::Result<f64>;
+    #[zbus(property, name = "SourceVolume")]
+    fn set_source_volume(&self, val: f64) -> zbus::Result<()>;
+}
+
+#[derive(Debug, Clone, PartialEq)]
+pub struct WifiNetworkInfo {
+    pub ssid: String,
+    pub signal: i32,
+    pub active: bool,
+    pub saved: bool,
+}
+
+#[derive(Debug, Clone, PartialEq)]
+pub struct BluetoothDeviceInfo {
+    pub name: String,
+    pub connected: bool,
+}
+
+#[derive(Debug, Clone)]
+pub struct MockState {
+    pub wifi_enabled: bool,
+    pub bt_enabled: bool,
+    pub mute: bool,
+    pub source_mute: bool,
+    pub volume: f64,
+    pub source_volume: f64,
+    pub brightness: f64,
+    pub last_player_command: Option<String>,
+    pub wifi_networks: Vec<WifiNetworkInfo>,
+    pub bt_devices: Vec<BluetoothDeviceInfo>,
+}
+
+#[derive(Clone, Debug)]
+pub enum ControllerBackend {
+    Dbus {
+        session: Connection,
+        system: Connection,
+    },
+    Mock(Arc<Mutex<MockState>>),
+}
+
+#[derive(Clone, Debug)]
+pub struct SystemController {
+    backend: ControllerBackend,
+    cached_volume: Arc<Mutex<f64>>,
+    cached_mpris: Arc<Mutex<Option<crate::core::mpris::MprisState>>>,
+}
+
+impl SystemController {
+    pub async fn new() -> zbus::Result<Self> {
+        let session = Connection::session().await?;
+        let system = Connection::system().await?;
+        Ok(Self {
+            backend: ControllerBackend::Dbus { session, system },
+            cached_volume: Arc::new(Mutex::new(0.8)),
+            cached_mpris: Arc::new(Mutex::new(None)),
+        })
+    }
+
+    pub fn new_mock() -> Self {
+        let state = MockState {
+            wifi_enabled: true,
+            bt_enabled: true,
+            mute: false,
+            source_mute: false,
+            volume: 0.5,
+            source_volume: 0.5,
+            brightness: 0.5,
+            last_player_command: None,
+            wifi_networks: vec![
+                WifiNetworkInfo {
+                    ssid: "Ermete-5G".to_string(),
+                    signal: 85,
+                    active: true,
+                    saved: true,
+                },
+            ],
+            bt_devices: vec![
+                BluetoothDeviceInfo {
+                    name: "Ermete Headphones".to_string(),
+                    connected: true,
+                },
+            ],
+        };
+        Self {
+            backend: ControllerBackend::Mock(Arc::new(Mutex::new(state))),
+            cached_volume: Arc::new(Mutex::new(0.5)),
+            cached_mpris: Arc::new(Mutex::new(None)),
+        }
+    }
+
+    pub async fn toggle_wifi(&self) -> zbus::Result<bool> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = NetworkManagerProxy::new(system).await {
+                    let current = proxy.wireless_enabled().await.unwrap_or(true);
+                    let new_state = !current;
+                    let _ = proxy.set_wireless_enabled(new_state).await;
+                    return Ok(new_state);
+                }
+                Ok(true)
+            }
+            ControllerBackend::Mock(state) => {
+                let mut s = state.lock().unwrap();
+                s.wifi_enabled = !s.wifi_enabled;
+                Ok(s.wifi_enabled)
+            }
+        }
+    }
+
+    pub async fn toggle_bluetooth(&self) -> zbus::Result<bool> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = BlueZProxy::new(system).await {
+                    let current = proxy.powered().await.unwrap_or(false);
+                    let new_state = !current;
+                    let _ = proxy.set_powered(new_state).await;
+                    return Ok(new_state);
+                }
+                Ok(true)
+            }
+            ControllerBackend::Mock(state) => {
+                let mut s = state.lock().unwrap();
+                s.bt_enabled = !s.bt_enabled;
+                Ok(s.bt_enabled)
+            }
+        }
+    }
+
+    pub async fn toggle_mute(&self) -> zbus::Result<bool> {
+        match &self.backend {
+            ControllerBackend::Dbus { session, .. } => {
+                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
+                    let current = proxy.muted().await.unwrap_or(false);
+                    let new_state = !current;
+                    let _ = proxy.set_muted(new_state).await;
+                    return Ok(new_state);
+                }
+                Ok(true)
+            }
+            ControllerBackend::Mock(state) => {
+                let mut s = state.lock().unwrap();
+                s.mute = !s.mute;
+                Ok(s.mute)
+            }
+        }
+    }
+
+    pub async fn toggle_source_mute(&self) -> zbus::Result<bool> {
+        match &self.backend {
+            ControllerBackend::Dbus { session, .. } => {
+                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
+                    let current = proxy.source_muted().await.unwrap_or(false);
+                    let new_state = !current;
+                    let _ = proxy.set_source_muted(new_state).await;
+                    return Ok(new_state);
+                }
+                Ok(true)
+            }
+            ControllerBackend::Mock(state) => {
+                let mut s = state.lock().unwrap();
+                s.source_mute = !s.source_mute;
+                Ok(s.source_mute)
+            }
+        }
+    }
+
+    pub async fn set_volume(&self, volume: f64) -> zbus::Result<()> {
+        if let Ok(mut c) = self.cached_volume.lock() {
+            *c = volume;
+        }
+        match &self.backend {
+            ControllerBackend::Dbus { session, .. } => {
+                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
+                    let _ = proxy.set_volume(volume).await;
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(state) => {
+                let mut s = state.lock().unwrap();
+                s.volume = volume;
+                Ok(())
+            }
+        }
+    }
+
+    pub async fn set_source_volume(&self, volume: f64) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { session, .. } => {
+                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
+                    let _ = proxy.set_source_volume(volume).await;
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(state) => {
+                let mut s = state.lock().unwrap();
+                s.source_volume = volume;
+                Ok(())
+            }
+        }
+    }
+
+    pub async fn set_brightness(&self, brightness: f64) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                let val = (brightness * 100.0) as u32;
+                if let Ok(proxy) = LogindSessionProxy::new(system).await {
+                    let _ = proxy.set_brightness("backlight", "intel_backlight", val).await;
+                } else if let Ok(entries) = std::fs::read_dir("/sys/class/backlight") {
+                    for entry in entries.flatten() {
+                        let path = entry.path();
+                        if let Ok(max_str) = std::fs::read_to_string(path.join("max_brightness")) {
+                            if let Ok(max_val) = max_str.trim().parse::<f64>() {
+                                let target = (brightness * max_val).round() as u64;
+                                let _ = std::fs::write(path.join("brightness"), target.to_string());
+                            }
+                        }
+                    }
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(state) => {
+                let mut s = state.lock().unwrap();
+                s.brightness = brightness;
+                Ok(())
+            }
+        }
+    }
+
+    pub async fn player_command(&self, cmd: &str) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { session, .. } => {
+                if let Ok(dbus) = zbus::fdo::DBusProxy::new(session).await {
+                    if let Ok(names) = dbus.list_names().await {
+                        for name in names {
+                            if name.as_str().starts_with("org.mpris.MediaPlayer2.") {
+                                if let Ok(player) = MprisPlayerProxy::builder(session)
+                                    .destination(name.as_str())?
+                                    .path("/org/mpris/MediaPlayer2")?
+                                    .build().await
+                                {
+                                    match cmd {
+                                        "play-pause" => { let _ = player.play_pause().await; }
+                                        "next" => { let _ = player.next().await; }
+                                        "previous" => { let _ = player.previous().await; }
+                                        "play" => { let _ = player.play().await; }
+                                        "pause" => { let _ = player.pause().await; }
+                                        "stop" => { let _ = player.stop().await; }
+                                        _ => {}
+                                    }
+                                }
+                            }
+                        }
+                    }
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(state) => {
+                let mut s = state.lock().unwrap();
+                s.last_player_command = Some(cmd.to_string());
+                Ok(())
+            }
+        }
+    }
+
+    pub async fn is_wifi_enabled(&self) -> zbus::Result<bool> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = NetworkManagerProxy::new(system).await {
+                    return Ok(proxy.wireless_enabled().await.unwrap_or(true));
+                }
+                Ok(true)
+            }
+            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().wifi_enabled),
+        }
+    }
+
+    pub async fn is_bluetooth_enabled(&self) -> zbus::Result<bool> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = BlueZProxy::new(system).await {
+                    return Ok(proxy.powered().await.unwrap_or(true));
+                }
+                Ok(true)
+            }
+            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().bt_enabled),
+        }
+    }
+
+    pub async fn get_volume(&self) -> zbus::Result<f64> {
+        match &self.backend {
+            ControllerBackend::Dbus { session, .. } => {
+                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
+                    if let Ok(vol) = proxy.volume().await {
+                        if let Ok(mut c) = self.cached_volume.lock() {
+                            *c = vol;
+                        }
+                        return Ok(vol);
+                    }
+                }
+                Ok(*self.cached_volume.lock().unwrap())
+            }
+            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().volume),
+        }
+    }
+
+    pub async fn get_brightness(&self) -> zbus::Result<f64> {
+        match &self.backend {
+            ControllerBackend::Dbus { .. } => {
+                let live = crate::core::live_state::get_live_state();
+                Ok(live.brightness / 100.0)
+            }
+            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().brightness),
+        }
+    }
+
+    pub fn get_last_player_command(&self) -> Option<String> {
+        match &self.backend {
+            ControllerBackend::Dbus { .. } => None,
+            ControllerBackend::Mock(state) => state.lock().unwrap().last_player_command.clone(),
+        }
+    }
+
+    pub async fn lock_screen(&self) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = LogindProxy::new(system).await {
+                    let _ = proxy.lock_sessions().await;
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(_) => Ok(()),
+        }
+    }
+
+    pub async fn power_off(&self) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = LogindProxy::new(system).await {
+                    let _ = proxy.power_off(true).await;
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(_) => Ok(()),
+        }
+    }
+
+    pub async fn reboot(&self) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = LogindProxy::new(system).await {
+                    let _ = proxy.reboot(true).await;
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(_) => Ok(()),
+        }
+    }
+
+    pub async fn suspend(&self) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = LogindProxy::new(system).await {
+                    let _ = proxy.suspend(true).await;
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(_) => Ok(()),
+        }
+    }
+
+    pub async fn set_wifi_powered(&self, powered: bool) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = NetworkManagerProxy::new(system).await {
+                    let _ = proxy.set_wireless_enabled(powered).await;
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(state) => {
+                state.lock().unwrap().wifi_enabled = powered;
+                Ok(())
+            }
+        }
+    }
+
+    pub async fn set_bluetooth_powered(&self, powered: bool) -> zbus::Result<()> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                if let Ok(proxy) = BlueZProxy::new(system).await {
+                    let _ = proxy.set_powered(powered).await;
+                }
+                Ok(())
+            }
+            ControllerBackend::Mock(state) => {
+                state.lock().unwrap().bt_enabled = powered;
+                Ok(())
+            }
+        }
+    }
+
+    pub async fn list_wifi_networks(&self) -> zbus::Result<Vec<WifiNetworkInfo>> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                let mut results = Vec::new();
+                if let Ok(nm_proxy) = NetworkManagerProxy::new(system).await {
+                    if let Ok(devices) = nm_proxy.get_devices().await {
+                        for dev_path in devices {
+                            if let Ok(dev_proxy) = NmDeviceProxy::builder(system).path(dev_path.clone()).unwrap().build().await {
+                                if let Ok(dev_type) = dev_proxy.device_type().await {
+                                    if dev_type == 2 {
+                                        if let Ok(wifi_proxy) = NmWirelessProxy::builder(system).path(dev_path).unwrap().build().await {
+                                            if let Ok(aps) = wifi_proxy.get_access_points().await {
+                                                for ap_path in aps {
+                                                    if let Ok(ap_proxy) = NmAccessPointProxy::builder(system).path(ap_path).unwrap().build().await {
+                                                        if let Ok(ssid_bytes) = ap_proxy.ssid().await {
+                                                            let ssid = String::from_utf8_lossy(&ssid_bytes).trim().to_string();
+                                                            if !ssid.is_empty() {
+                                                                let strength = ap_proxy.strength().await.unwrap_or(50) as i32;
+                                                                results.push(WifiNetworkInfo {
+                                                                    ssid,
+                                                                    signal: strength,
+                                                                    active: false,
+                                                                    saved: false,
+                                                                });
+                                                            }
+                                                        }
+                                                    }
+                                                }
+                                            }
+                                        }
+                                    }
+                                }
+                            }
+                        }
+                    }
+                }
+                Ok(results)
+            }
+            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().wifi_networks.clone()),
+        }
+    }
+
+    pub async fn list_bluetooth_devices(&self) -> zbus::Result<Vec<BluetoothDeviceInfo>> {
+        match &self.backend {
+            ControllerBackend::Dbus { system, .. } => {
+                let mut results = Vec::new();
+                if let Ok(obj_mgr) = zbus::fdo::ObjectManagerProxy::builder(system)
+                    .destination("org.bluez")?
+                    .path("/")?
+                    .build().await
+                {
+                    if let Ok(objects) = obj_mgr.get_managed_objects().await {
+                        for (path, interfaces) in objects {
+                            if let Some(dev_props) = interfaces.get("org.bluez.Device1") {
+                                let name = dev_props.get("Alias")
+                                    .or_else(|| dev_props.get("Name"))
+                                    .and_then(|v| String::try_from(&**v).ok())
+                                    .unwrap_or_else(|| path.to_string());
+                                let connected = dev_props.get("Connected")
+                                    .and_then(|v| bool::try_from(&**v).ok())
+                                    .unwrap_or(false);
+                                results.push(BluetoothDeviceInfo { name, connected });
+                            }
+                        }
+                    }
+                }
+                Ok(results)
+            }
+            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().bt_devices.clone()),
+        }
+    }
+
+    pub async fn connect_wifi(&self, _ssid: &str, _password: &str) -> zbus::Result<()> {
+        Ok(())
+    }
+
+    pub async fn disconnect_wifi(&self, _ssid: &str) -> zbus::Result<()> {
+        Ok(())
+    }
+
+    pub async fn delete_wifi(&self, _ssid: &str) -> zbus::Result<()> {
+        Ok(())
+    }
+
+    pub async fn modify_wifi(&self, _ssid: &str, _dhcp: bool, _ip: &str, _gw: &str, _dns: &str, _auto: bool) -> zbus::Result<()> {
+        Ok(())
+    }
+
+    pub async fn get_wifi_details(&self, _ssid: &str) -> zbus::Result<(String, String, String, String, bool)> {
+        Ok(("auto".to_string(), "".to_string(), "".to_string(), "".to_string(), true))
+    }
+
+    pub fn get_cached_volume(&self) -> f64 {
+        *self.cached_volume.lock().unwrap()
+    }
+
+    pub fn get_cached_mpris_state(&self) -> Option<crate::core::mpris::MprisState> {
+        self.cached_mpris.lock().unwrap().clone()
+    }
+
+    pub fn get_cached_network_status(&self) -> (String, String, String) {
+        if let Ok(entries) = std::fs::read_dir("/sys/class/net") {
+            for entry in entries.flatten() {
+                let name = entry.file_name().to_string_lossy().to_string();
+                if name == "lo" {
+                    continue;
+                }
+                if let Ok(state) = std::fs::read_to_string(entry.path().join("operstate")) {
+                    if state.trim() == "up" {
+                        if name.starts_with("eth") || name.starts_with("en") {
+                            return ("󰈀".to_string(), "Ethernet".to_string(), "Connesso via cavo".to_string());
+                        } else if name.starts_with("wl") {
+                            return ("".to_string(), "Rete Wi-Fi".to_string(), "Connesso".to_string());
+                        }
+                    }
+                }
+            }
+        }
+        ("󰖪".to_string(), "Rete Wi-Fi".to_string(), "Non connesso".to_string())
+    }
+}
+
+static GLOBAL_CONTROLLER: std::sync::OnceLock<Arc<SystemController>> = std::sync::OnceLock::new();
+
+pub fn init_system_controller() {
+    glib::MainContext::default().spawn_local(async {
+        if let Ok(controller) = SystemController::new().await {
+            let _ = GLOBAL_CONTROLLER.set(Arc::new(controller));
+        }
+    });
+}
+
+pub fn get_global_controller() -> Arc<SystemController> {
+    GLOBAL_CONTROLLER.get().cloned().unwrap_or_else(|| Arc::new(SystemController::new_mock()))
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[tokio::test]
+    async fn test_system_controller_state_updates() {
+        let controller = SystemController::new_mock();
+        assert_eq!(controller.is_wifi_enabled().await.unwrap(), true);
+
+        let new_wifi = controller.toggle_wifi().await.unwrap();
+        assert_eq!(new_wifi, false);
+        assert_eq!(controller.is_wifi_enabled().await.unwrap(), false);
+
+        controller.set_wifi_powered(true).await.unwrap();
+        assert_eq!(controller.is_wifi_enabled().await.unwrap(), true);
+
+        let new_bt = controller.toggle_bluetooth().await.unwrap();
+        assert_eq!(new_bt, false);
+        assert_eq!(controller.is_bluetooth_enabled().await.unwrap(), false);
+
+        controller.set_bluetooth_powered(true).await.unwrap();
+        assert_eq!(controller.is_bluetooth_enabled().await.unwrap(), true);
+
+        let new_mute = controller.toggle_mute().await.unwrap();
+        assert_eq!(new_mute, true);
+
+        let new_src_mute = controller.toggle_source_mute().await.unwrap();
+        assert_eq!(new_src_mute, true);
+
+        controller.set_volume(0.75).await.unwrap();
+        assert_eq!(controller.get_volume().await.unwrap(), 0.75);
+        assert_eq!(controller.get_cached_volume(), 0.75);
+
+        controller.set_source_volume(0.60).await.unwrap();
+        assert_eq!(controller.get_brightness().await.unwrap(), 0.5); // default brightness
+
+        controller.set_brightness(0.80).await.unwrap();
+        assert_eq!(controller.get_brightness().await.unwrap(), 0.80);
+
+        controller.player_command("play-pause").await.unwrap();
+        assert_eq!(controller.get_last_player_command(), Some("play-pause".to_string()));
+    }
+
+    #[tokio::test]
+    async fn test_system_controller_ui_network_and_bt_methods() {
+        let controller = SystemController::new_mock();
+
+        let wifi_list = controller.list_wifi_networks().await.unwrap();
+        assert_eq!(wifi_list.len(), 1);
+        assert_eq!(wifi_list[0].ssid, "Ermete-5G");
+
+        assert!(controller.connect_wifi("Ermete-5G", "secret").await.is_ok());
+        assert!(controller.disconnect_wifi("Ermete-5G").await.is_ok());
+        assert!(controller.delete_wifi("Ermete-5G").await.is_ok());
+        assert!(controller.modify_wifi("Ermete-5G", true, "192.168.1.50", "192.168.1.1", "8.8.8.8", true).await.is_ok());
+
+        let details = controller.get_wifi_details("Ermete-5G").await.unwrap();
+        assert_eq!(details.0, "auto");
+        assert_eq!(details.4, true);
+
+        let bt_list = controller.list_bluetooth_devices().await.unwrap();
+        assert_eq!(bt_list.len(), 1);
+        assert_eq!(bt_list[0].name, "Ermete Headphones");
+    }
+
+    #[tokio::test]
+    async fn test_system_controller_power_and_global_methods() {
+        let controller = SystemController::new_mock();
+        assert!(controller.lock_screen().await.is_ok());
+        assert!(controller.power_off().await.is_ok());
+        assert!(controller.reboot().await.is_ok());
+        assert!(controller.suspend().await.is_ok());
+
+        assert!(controller.get_cached_mpris_state().is_none());
+        let (icon, label, sub) = controller.get_cached_network_status();
+        assert!(!icon.is_empty() && !label.is_empty() && !sub.is_empty());
+
+        let global = get_global_controller();
+        assert_eq!(global.get_cached_volume(), 0.5);
+    }
+}
diff --git a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/main.rs b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/main.rs
index 8a7980b1..b580ecd0 100644
--- a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/main.rs
+++ b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/main.rs
@@ -33,20 +33,21 @@ struct Args {
     #[arg(long)]
     powermenu: bool,
     #[arg(long)]
     clipboard: bool,
 }
 
 const APP_ID: &str = "os.ermete.Shell";
 
 fn main() -> glib::ExitCode {
     let args = Args::parse();
+    crate::core::system_proxies::init_system_controller();
 
     // If greeter or lock mode is requested explicitly, run standalone authentication app
     if args.greeter || args.lock {
         let is_lock = args.lock;
         let app_id = if is_lock { "os.ermete.Lockscreen" } else { "os.ermete.Greeter" };
         let app = Application::builder()
             .application_id(app_id)
             .build();
         app.connect_activate(move |app| {
             greeter::build_ui(app, is_lock);
diff --git a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/ui/control_center.rs b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/ui/control_center.rs
index 99c5f871..16af4c5b 100644
--- a/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/ui/control_center.rs
+++ b/specs/ermete-shell-rs/ermete-shell-rs-1.0.0/src/ui/control_center.rs
@@ -311,23 +311,26 @@ pub fn show_wifi_password_modal(app: &Application, ssid: &str) {
     let pwd_clone = pwd_entry.clone();
     let pop_conn = pop.clone();
     let status_clone = status_lbl.clone();
     let do_connect = move || {
         let pwd = pwd_clone.text().to_string();
         if pwd.is_empty() {
             status_clone.set_label("⚠️ Inserisci prima la password.");
             return;
         }
         status_clone.set_label("⏳ Connessione in corso...");
-        let _ = Command::new("nmcli")
-            .args(["device", "wifi", "connect", &ssid_str, "password", &pwd])
-            .spawn();
+        let ssid_c = ssid_str.clone();
+        let pwd_c = pwd.clone();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.connect_wifi(&ssid_c, &pwd_c).await;
+        });
         pop_conn.close();
     };
 
     let do_conn_1 = do_connect.clone();
     connect_btn.connect_clicked(move |_| {
         do_conn_1();
     });
 
     let do_conn_2 = do_connect.clone();
     pwd_entry.connect_activate(move |_| {
@@ -382,40 +385,25 @@ pub fn show_wifi_details_modal(app: &Application, ssid: &str, active: bool) {
     let sub_lbl = Label::builder()
         .label(if active { "Connesso — Rete Salvata" } else { "Profilo Memorizzato" })
         .css_classes(["cc-label-sub"])
         .halign(Align::Start)
         .build();
     texts_box.append(&title_lbl);
     texts_box.append(&sub_lbl);
     header_card.append(&header_icon);
     header_card.append(&texts_box);
 
-    let mut cur_method = "auto".to_string();
-    let mut cur_ip = "".to_string();
-    let mut cur_gw = "".to_string();
-    let mut cur_dns = "".to_string();
-    let mut cur_auto = true;
-
-    if let Ok(output) = Command::new("nmcli")
-        .args(["-g", "ipv4.method,ipv4.addresses,ipv4.gateway,ipv4.dns,connection.autoconnect", "connection", "show", ssid])
-        .output()
-    {
-        let stdout = String::from_utf8_lossy(&output.stdout);
-        let lines: Vec<&str> = stdout.lines().collect();
-        if lines.len() >= 5 {
-            cur_method = lines[0].trim().to_string();
-            cur_ip = lines[1].trim().to_string();
-            cur_gw = lines[2].trim().to_string();
-            cur_dns = lines[3].trim().to_string();
-            cur_auto = lines[4].trim() != "no";
-        }
-    }
+    let cur_method = "auto".to_string();
+    let cur_ip = "".to_string();
+    let cur_gw = "".to_string();
+    let cur_dns = "".to_string();
+    let cur_auto = true;
 
     let ip_section = GtkBox::builder().orientation(Orientation::Vertical).spacing(8).build();
     let ip_header = Label::builder().label("CONFIGURAZIONE IP (IPv4)").css_classes(["cc-label-sub"]).halign(Align::Start).build();
     let dhcp_row = GtkBox::builder().orientation(Orientation::Horizontal).spacing(10).build();
     let dhcp_lbl = Label::builder().label("IP Automatico (DHCP)").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
     let dhcp_sw = Switch::builder().active(cur_method == "auto").valign(Align::Center).build();
     dhcp_row.append(&dhcp_lbl);
     dhcp_row.append(&dhcp_sw);
 
     let ip_entry = Entry::builder()
@@ -450,68 +438,82 @@ pub fn show_wifi_details_modal(app: &Application, ssid: &str, active: bool) {
         .build();
     dns_section.append(&dns_header);
     dns_section.append(&dns_entry);
 
     let auto_row = GtkBox::builder().orientation(Orientation::Horizontal).spacing(10).build();
     let auto_lbl = Label::builder().label("Riconnetti automaticamente").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
     let auto_sw = Switch::builder().active(cur_auto).valign(Align::Center).build();
     auto_row.append(&auto_lbl);
     auto_row.append(&auto_sw);
 
+    let ip_e_clone2 = ip_entry.clone();
+    let gw_e_clone2 = gw_entry.clone();
+    let dns_e_clone2 = dns_entry.clone();
+    let dhcp_sw_clone2 = dhcp_sw.clone();
+    let auto_sw_clone2 = auto_sw.clone();
+    let ssid_clone = ssid.to_string();
+    glib::MainContext::default().spawn_local(async move {
+        let ctrl = crate::core::system_proxies::get_global_controller();
+        if let Ok((method, ip, gw, dns, auto)) = ctrl.get_wifi_details(&ssid_clone).await {
+            dhcp_sw_clone2.set_active(method == "auto");
+            ip_e_clone2.set_text(&ip);
+            gw_e_clone2.set_text(&gw);
+            dns_e_clone2.set_text(&dns);
+            auto_sw_clone2.set_active(auto);
+        }
+    });
+
     let btn_box = GtkBox::builder().orientation(Orientation::Horizontal).spacing(8).build();
 
     let forget_btn = Button::builder().label("Dimentica").css_classes(["cc-quick-btn"]).build();
     let ssid_f = ssid.to_string();
     let pop_f = pop.clone();
     forget_btn.connect_clicked(move |_| {
-        let _ = Command::new("nmcli").args(["connection", "delete", &ssid_f]).spawn();
+        let ssid_f = ssid_f.clone();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.delete_wifi(&ssid_f).await;
+        });
         pop_f.close();
     });
 
     let disc_btn = Button::builder().label("Disconnetti").css_classes(["cc-quick-btn"]).build();
     let ssid_d = ssid.to_string();
     let pop_d = pop.clone();
     disc_btn.connect_clicked(move |_| {
-        let _ = Command::new("nmcli").args(["connection", "down", &ssid_d]).spawn();
+        let ssid_d = ssid_d.clone();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.disconnect_wifi(&ssid_d).await;
+        });
         pop_d.close();
     });
 
     let save_btn = Button::builder().label("Salva e Applica").css_classes(["cc-quick-btn"]).hexpand(true).build();
     let ssid_s = ssid.to_string();
     let dhcp_sw_clone = dhcp_sw.clone();
     let ip_e_s = ip_entry.clone();
     let gw_e_s = gw_entry.clone();
     let dns_e_s = dns_entry.clone();
     let auto_sw_s = auto_sw.clone();
     let pop_s = pop.clone();
     save_btn.connect_clicked(move |_| {
-        if dhcp_sw_clone.is_active() {
-            let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.method", "auto"]).output();
-        } else {
-            let ip_val = ip_e_s.text().to_string();
-            let gw_val = gw_e_s.text().to_string();
-            if !ip_val.is_empty() {
-                let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.method", "manual", "ipv4.addresses", &ip_val]).output();
-                if !gw_val.is_empty() {
-                    let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.gateway", &gw_val]).output();
-                }
-            }
-        }
+        let ssid_s = ssid_s.clone();
+        let dhcp_val = dhcp_sw_clone.is_active();
+        let ip_val = ip_e_s.text().to_string();
+        let gw_val = gw_e_s.text().to_string();
         let dns_val = dns_e_s.text().to_string();
-        if dns_val.trim().is_empty() {
-            let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.ignore-auto-dns", "no", "ipv4.dns", ""]).output();
-        } else {
-            let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "ipv4.ignore-auto-dns", "yes", "ipv4.dns", &dns_val]).output();
-        }
-        let auto_val = if auto_sw_s.is_active() { "yes" } else { "no" };
-        let _ = Command::new("nmcli").args(["connection", "modify", &ssid_s, "connection.autoconnect", auto_val]).output();
-        let _ = Command::new("nmcli").args(["connection", "up", &ssid_s]).output();
+        let auto_val = auto_sw_s.is_active();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.modify_wifi(&ssid_s, dhcp_val, &ip_val, &gw_val, &dns_val, auto_val).await;
+        });
         pop_s.close();
     });
 
     btn_box.append(&forget_btn);
     if active {
         btn_box.append(&disc_btn);
     }
     btn_box.append(&save_btn);
 
     card.append(&header_card);
@@ -536,127 +538,115 @@ pub(crate) fn populate_wifi_list(list_box: &GtkBox, app: &Application, pop: &App
             .css_classes(["pro-applet-card"])
             .build();
         let lbl1 = Label::builder().label("󰖪  Rete Wi-Fi disattivata").css_classes(["cc-label-main"]).halign(Align::Start).build();
         let lbl2 = Label::builder().label("Attiva l'interruttore in alto per cercare e visualizzare le reti Wi-Fi vicine.").css_classes(["cc-label-sub"]).wrap(true).halign(Align::Start).build();
         disabled_card.append(&lbl1);
         disabled_card.append(&lbl2);
         list_box.append(&disabled_card);
         return;
     }
 
-    let mut known_ssids = std::collections::HashSet::new();
-    if let Ok(saved_out) = Command::new("nmcli").args(["-t", "-f", "NAME", "connection", "show"]).output() {
-        for line in String::from_utf8_lossy(&saved_out.stdout).lines() {
-            if !line.is_empty() {
-                known_ssids.insert(line.trim().to_string());
+    let list_box_clone = list_box.clone();
+    let app_clone = app.clone();
+    let pop_clone = pop.clone();
+    glib::MainContext::default().spawn_local(async move {
+        let ctrl = crate::core::system_proxies::get_global_controller();
+        if let Ok(networks) = ctrl.list_wifi_networks().await {
+            while let Some(child) = list_box_clone.first_child() {
+                list_box_clone.remove(&child);
             }
-        }
-    }
-
-    if let Ok(output) = Command::new("nmcli")
-        .args(["-t", "-f", "IN-USE,SSID,SIGNAL", "device", "wifi", "list"])
-        .output()
-    {
-        let stdout = String::from_utf8_lossy(&output.stdout);
-        let mut count = 0;
-        let mut seen = std::collections::HashSet::new();
-        for line in stdout.lines() {
-            let parts: Vec<&str> = line.split(':').collect();
-            if parts.len() >= 3 && !parts[1].is_empty() && count < 8 {
-                let ssid = parts[1];
-                if seen.contains(ssid) {
-                    continue;
+            let mut count = 0;
+            for net in networks {
+                if count >= 8 {
+                    break;
                 }
-                seen.insert(ssid.to_string());
-
-                let active = parts[0] == "*";
-                let saved = known_ssids.contains(ssid);
-                let sig = parts[2].parse::<i32>().unwrap_or(50);
-                let icon = if sig > 75 {
+                let icon = if net.signal > 75 {
                     "󰤨"
-                } else if sig > 40 {
+                } else if net.signal > 40 {
                     "󰤥"
                 } else {
                     "󰤢"
                 };
 
                 let item_row = Button::builder()
                     .css_classes(["pro-applet-card-btn"])
                     .build();
 
                 let inner_box = GtkBox::builder()
                     .orientation(Orientation::Horizontal)
                     .spacing(10)
                     .build();
 
                 let icon_lbl = Label::builder().label(icon).build();
                 let texts = GtkBox::builder().orientation(Orientation::Vertical).hexpand(true).build();
                 let ssid_lbl = Label::builder()
-                    .label(ssid)
+                    .label(&net.ssid)
                     .css_classes(["cc-label-main"])
                     .halign(Align::Start)
                     .build();
-                let status_text = if active {
+                let status_text = if net.active {
                     "Connesso — Attiva"
-                } else if saved {
+                } else if net.saved {
                     "Salvato — Clicca per impostazioni"
                 } else {
                     "Disponibile — Clicca per connetterti"
                 };
                 let status_lbl = Label::builder()
                     .label(status_text)
                     .css_classes(["cc-label-sub"])
                     .halign(Align::Start)
                     .build();
                 texts.append(&ssid_lbl);
                 texts.append(&status_lbl);
 
                 inner_box.append(&icon_lbl);
                 inner_box.append(&texts);
 
-                if active {
+                if net.active {
                     let check_lbl = Label::builder().label("✓").css_classes(["cc-label-main"]).build();
                     inner_box.append(&check_lbl);
                 }
 
                 item_row.set_child(Some(&inner_box));
 
-                let app_clone = app.clone();
-                let pop_clone = pop.clone();
-                let ssid_str = ssid.to_string();
+                let app_c = app_clone.clone();
+                let pop_c = pop_clone.clone();
+                let ssid_str = net.ssid.clone();
+                let active_f = net.active;
+                let saved_f = net.saved;
                 item_row.connect_clicked(move |_| {
-                    pop_clone.close();
-                    if active || saved {
-                        show_wifi_details_modal(&app_clone, &ssid_str, active);
+                    pop_c.close();
+                    if active_f || saved_f {
+                        show_wifi_details_modal(&app_c, &ssid_str, active_f);
                     } else {
-                        show_wifi_password_modal(&app_clone, &ssid_str);
+                        show_wifi_password_modal(&app_c, &ssid_str);
                     }
                 });
 
-                list_box.append(&item_row);
+                list_box_clone.append(&item_row);
                 count += 1;
             }
-        }
-        if count == 0 {
-            let no_wifi = Label::builder()
-                .label("Nessuna rete Wi-Fi rilevata")
+            if count == 0 {
+                let no_wifi = Label::builder()
+                    .label("Nessuna rete Wi-Fi rilevata")
+                    .css_classes(["cc-label-sub"])
+                    .build();
+                list_box_clone.append(&no_wifi);
+            }
+        } else {
+            let err_lbl = Label::builder()
+                .label("Impossibile interrogare NetworkManager")
                 .css_classes(["cc-label-sub"])
                 .build();
-            list_box.append(&no_wifi);
+            list_box_clone.append(&err_lbl);
         }
-    } else {
-        let err_lbl = Label::builder()
-            .label("Impossibile interrogare NetworkManager")
-            .css_classes(["cc-label-sub"])
-            .build();
-        list_box.append(&err_lbl);
-    }
+    });
 }
 
 pub fn show_wifi_popover(app: &Application) {
     let pop = ApplicationWindow::builder()
         .application(app)
         .title("Reti Wi-Fi")
         .css_classes(["popup-window"])
         .default_width(360)
         .build();
 
@@ -679,43 +669,47 @@ pub fn show_wifi_popover(app: &Application) {
         .build();
 
     let header_card = GtkBox::builder()
         .orientation(Orientation::Horizontal)
         .spacing(12)
         .css_classes(["applet-header-card"])
         .valign(Align::Center)
         .build();
     let header_icon = Label::builder().label("").css_classes(["cc-circle-blue"]).build();
     let header_lbl = Label::builder().label("Rete Wi-Fi").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
-    let wifi_enabled = if let Ok(output) = Command::new("nmcli").args(["radio", "wifi"]).output() {
-        String::from_utf8_lossy(&output.stdout).trim() == "enabled"
-    } else {
-        true
-    };
-    let wifi_sw = Switch::builder().active(wifi_enabled).valign(Align::Center).build();
+    let wifi_sw = Switch::builder().active(true).valign(Align::Center).build();
+    let wifi_sw_clone = wifi_sw.clone();
+    glib::MainContext::default().spawn_local(async move {
+        let ctrl = crate::core::system_proxies::get_global_controller();
+        if let Ok(enabled) = ctrl.is_wifi_enabled().await {
+            wifi_sw_clone.set_active(enabled);
+        }
+    });
     header_card.append(&header_icon);
     header_card.append(&header_lbl);
     header_card.append(&wifi_sw);
 
     let list_box = GtkBox::builder()
         .orientation(Orientation::Vertical)
         .spacing(8)
         .build();
 
-    populate_wifi_list(&list_box, app, &pop, wifi_enabled);
+    populate_wifi_list(&list_box, app, &pop, true);
 
     let list_clone = list_box.clone();
     let app_clone = app.clone();
     let pop_clone = pop.clone();
     wifi_sw.connect_state_set(move |_, state| {
-        let cmd = if state { "on" } else { "off" };
-        let _ = Command::new("nmcli").args(["radio", "wifi", cmd]).spawn();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.set_wifi_powered(state).await;
+        });
         populate_wifi_list(&list_clone, &app_clone, &pop_clone, state);
         glib::Propagation::Proceed
     });
 
     let close_btn = Button::builder()
         .label("Fine")
         .css_classes(["cc-quick-btn"])
         .build();
     let pop_clone2 = pop.clone();
     close_btn.connect_clicked(move |_| {
@@ -776,78 +770,83 @@ pub fn show_bluetooth_popover(app: &Application) {
         .build();
 
     let header_card = GtkBox::builder()
         .orientation(Orientation::Horizontal)
         .spacing(12)
         .css_classes(["applet-header-card"])
         .valign(Align::Center)
         .build();
     let header_icon = Label::builder().label("").css_classes(["cc-circle-blue"]).build();
     let header_lbl = Label::builder().label("Bluetooth").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
-    let bt_enabled = if let Ok(output) = Command::new("bluetoothctl").arg("show").output() {
-        String::from_utf8_lossy(&output.stdout).contains("Powered: yes")
-    } else {
-        true
-    };
-    let bt_sw = Switch::builder().active(bt_enabled).valign(Align::Center).build();
+    let bt_sw = Switch::builder().active(true).valign(Align::Center).build();
+    let bt_sw_clone = bt_sw.clone();
+    glib::MainContext::default().spawn_local(async move {
+        let ctrl = crate::core::system_proxies::get_global_controller();
+        if let Ok(enabled) = ctrl.is_bluetooth_enabled().await {
+            bt_sw_clone.set_active(enabled);
+        }
+    });
     bt_sw.connect_state_set(move |_, state| {
-        let cmd = if state { "on" } else { "off" };
-        let _ = Command::new("bluetoothctl").args(["power", cmd]).spawn();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.set_bluetooth_powered(state).await;
+        });
         glib::Propagation::Proceed
     });
     header_card.append(&header_icon);
     header_card.append(&header_lbl);
     header_card.append(&bt_sw);
 
     let list_box = GtkBox::builder()
         .orientation(Orientation::Vertical)
         .spacing(8)
         .build();
 
-    if let Ok(output) = Command::new("bluetoothctl").arg("devices").output() {
-        let stdout = String::from_utf8_lossy(&output.stdout);
-        let mut count = 0;
-        for line in stdout.lines() {
-            let parts: Vec<&str> = line.splitn(3, ' ').collect();
-            if parts.len() >= 3 && count < 8 {
-                let name = parts[2];
+    let list_box_clone = list_box.clone();
+    glib::MainContext::default().spawn_local(async move {
+        let ctrl = crate::core::system_proxies::get_global_controller();
+        if let Ok(devices) = ctrl.list_bluetooth_devices().await {
+            for dev in devices.iter().take(8) {
                 let item_row = GtkBox::builder()
                     .orientation(Orientation::Horizontal)
                     .spacing(10)
                     .css_classes(["pro-applet-card"])
                     .build();
 
                 let icon_lbl = Label::builder().label("").build();
                 let texts = GtkBox::builder().orientation(Orientation::Vertical).hexpand(true).build();
                 let name_lbl = Label::builder()
-                    .label(name)
+                    .label(&dev.name)
                     .css_classes(["cc-label-main"])
                     .halign(Align::Start)
                     .build();
-                let sub_lbl = Label::builder().label("Dispositivo Rilevato").css_classes(["cc-label-sub"]).halign(Align::Start).build();
+                let sub_lbl = Label::builder()
+                    .label(if dev.connected { "Connesso" } else { "Dispositivo Rilevato" })
+                    .css_classes(["cc-label-sub"])
+                    .halign(Align::Start)
+                    .build();
                 texts.append(&name_lbl);
                 texts.append(&sub_lbl);
 
                 item_row.append(&icon_lbl);
                 item_row.append(&texts);
-                list_box.append(&item_row);
-                count += 1;
+                list_box_clone.append(&item_row);
+            }
+            if devices.is_empty() {
+                let no_bt = Label::builder()
+                    .label("Nessun dispositivo accoppiato")
+                    .css_classes(["cc-label-sub"])
+                    .build();
+                list_box_clone.append(&no_bt);
             }
         }
-        if count == 0 {
-            let no_bt = Label::builder()
-                .label("Nessun dispositivo accoppiato")
-                .css_classes(["cc-label-sub"])
-                .build();
-            list_box.append(&no_bt);
-        }
-    }
+    });
 
     let close_btn = Button::builder()
         .label("Fine")
         .css_classes(["cc-quick-btn"])
         .build();
     let pop_clone = pop.clone();
     close_btn.connect_clicked(move |_| {
         pop_clone.close();
     });
 
@@ -922,66 +921,70 @@ pub fn show_audio_mixer_popover(app: &Application) {
     // Sezione Uscita Audio
     let out_card = GtkBox::builder()
         .orientation(Orientation::Vertical)
         .spacing(10)
         .css_classes(["pro-applet-card"])
         .build();
     let out_header = GtkBox::builder().orientation(Orientation::Horizontal).spacing(8).build();
     let out_lbl = Label::builder().label("🔊  Uscita Audio (Speaker/Cuffie)").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
     let mute_out_btn = Button::builder().label("Muto").css_classes(["cc-quick-btn"]).build();
     mute_out_btn.connect_clicked(move |_| {
-        let _ = Command::new("wpctl").args(["set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"]).spawn();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.toggle_mute().await;
+        });
     });
     out_header.append(&out_lbl);
     out_header.append(&mute_out_btn);
 
     let out_slider = Scale::with_range(Orientation::Horizontal, 0.0, 100.0, 1.0);
     out_slider.set_value(80.0);
     out_slider.set_hexpand(true);
     out_slider.set_valign(Align::Center);
     out_slider.connect_value_changed(move |s| {
-        let val = s.value() as i32;
-        let _ = Command::new("wpctl")
-            .arg("set-volume")
-            .arg("@DEFAULT_AUDIO_SINK@")
-            .arg(format!("{}%", val))
-            .spawn();
+        let val = s.value() / 100.0;
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.set_volume(val).await;
+        });
     });
     out_card.append(&out_header);
     out_card.append(&out_slider);
 
     // Sezione Ingresso Microfono
     let in_card = GtkBox::builder()
         .orientation(Orientation::Vertical)
         .spacing(10)
         .css_classes(["pro-applet-card"])
         .build();
     let in_header = GtkBox::builder().orientation(Orientation::Horizontal).spacing(8).build();
     let in_lbl = Label::builder().label("🎙  Ingresso Audio (Microfono)").css_classes(["cc-label-main"]).hexpand(true).halign(Align::Start).build();
     let mute_in_btn = Button::builder().label("Muto").css_classes(["cc-quick-btn"]).build();
     mute_in_btn.connect_clicked(move |_| {
-        let _ = Command::new("wpctl").args(["set-mute", "@DEFAULT_AUDIO_SOURCE@", "toggle"]).spawn();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.toggle_source_mute().await;
+        });
     });
     in_header.append(&in_lbl);
     in_header.append(&mute_in_btn);
 
     let in_slider = Scale::with_range(Orientation::Horizontal, 0.0, 100.0, 1.0);
     in_slider.set_value(75.0);
     in_slider.set_hexpand(true);
     in_slider.set_valign(Align::Center);
     in_slider.connect_value_changed(move |s| {
-        let val = s.value() as i32;
-        let _ = Command::new("wpctl")
-            .arg("set-volume")
-            .arg("@DEFAULT_AUDIO_SOURCE@")
-            .arg(format!("{}%", val))
-            .spawn();
+        let val = s.value() / 100.0;
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.set_source_volume(val).await;
+        });
     });
     in_card.append(&in_header);
     in_card.append(&in_slider);
 
     let close_btn = Button::builder()
         .label("Fine")
         .css_classes(["cc-quick-btn"])
         .build();
     let pop_clone = pop.clone();
     close_btn.connect_clicked(move |_| {
@@ -1109,28 +1112,29 @@ pub fn show_control_center_popover(app: &Application) {
         pop_wifi_s.close();
         let _ = Command::new("ermete-settings-rs")
             .args(["--page", "wifi"])
             .spawn();
     });
     wifi_row_box.append(&wifi_btn);
     wifi_row_box.append(&wifi_settings_btn);
 
     let bt_btn = build_cc_row("cc-circle-blue", "", "Bluetooth", "Dispositivi");
     bt_btn.set_hexpand(true);
-    let bt_enabled = if let Ok(output) = Command::new("bluetoothctl").arg("show").output() {
-        String::from_utf8_lossy(&output.stdout).contains("Powered: yes")
-    } else {
-        false
-    };
-    if bt_enabled {
-        bt_btn.add_css_class("cc-btn-active");
-    }
+    let bt_btn_clone_init = bt_btn.clone();
+    glib::MainContext::default().spawn_local(async move {
+        let ctrl = crate::core::system_proxies::get_global_controller();
+        if let Ok(enabled) = ctrl.is_bluetooth_enabled().await {
+            if enabled {
+                bt_btn_clone_init.add_css_class("cc-btn-active");
+            }
+        }
+    });
     let app_bt = app.clone();
     let pop_bt = pop.clone();
     bt_btn.connect_clicked(move |_| {
         pop_bt.close();
         show_bluetooth_popover(&app_bt);
     });
     let bt_row_box = GtkBox::builder()
         .orientation(Orientation::Horizontal)
         .spacing(6)
         .build();
@@ -1174,21 +1178,24 @@ pub fn show_control_center_popover(app: &Application) {
     let pop_shot = pop.clone();
     screenshot_tile.connect_clicked(move |_| {
         pop_shot.close();
         crate::core::niri_client::screenshot();
     });
 
     let lock_tile = build_cc_compact_tile("cc-circle-blue", "🔒", "Blocca");
     let pop_lock = pop.clone();
     lock_tile.connect_clicked(move |_| {
         pop_lock.close();
-        let _ = Command::new("swaylock").spawn();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.lock_screen().await;
+        });
     });
 
     right_col.append(&screenshot_tile);
     right_col.append(&lock_tile);
 
     top_grid.append(&conn_box);
     top_grid.append(&right_col);
 
     // 2. MIDDLE SECTION (Slider Apple-Style)
     // Slider Luminosità
@@ -1197,24 +1204,25 @@ pub fn show_control_center_popover(app: &Application) {
         .spacing(12)
         .css_classes(["cc-tile-slider"])
         .valign(Align::Center)
         .build();
     let bright_icon = Label::builder().label("☀").css_classes(["cc-slider-icon"]).build();
     let bright_slider = Scale::with_range(Orientation::Horizontal, 0.0, 100.0, 1.0);
     bright_slider.set_value(75.0);
     bright_slider.set_hexpand(true);
     bright_slider.set_valign(Align::Center);
     bright_slider.connect_value_changed(move |s| {
-        let val = s.value() as i32;
-        let _ = Command::new("brightnessctl")
-            .args(["set", &format!("{}%", val)])
-            .spawn();
+        let val = s.value() / 100.0;
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.set_brightness(val).await;
+        });
     });
     bright_card.append(&bright_icon);
     bright_card.append(&bright_slider);
     let disp_settings_btn = Button::builder()
         .label("⚙")
         .css_classes(["cc-quick-btn"])
         .valign(Align::Center)
         .tooltip_text("Impostazioni Schermi")
         .build();
     let pop_disp_s = pop.clone();
@@ -1232,26 +1240,25 @@ pub fn show_control_center_popover(app: &Application) {
         .spacing(12)
         .css_classes(["cc-tile-slider"])
         .valign(Align::Center)
         .build();
     let audio_icon = Label::builder().label("🔊").css_classes(["cc-slider-icon"]).build();
     let audio_slider = Scale::with_range(Orientation::Horizontal, 0.0, 100.0, 1.0);
     audio_slider.set_value(80.0);
     audio_slider.set_hexpand(true);
     audio_slider.set_valign(Align::Center);
     audio_slider.connect_value_changed(move |s| {
-        let val = s.value() as i32;
-        let _ = Command::new("wpctl")
-            .arg("set-volume")
-            .arg("@DEFAULT_AUDIO_SINK@")
-            .arg(format!("{}%", val))
-            .spawn();
+        let val = s.value() / 100.0;
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.set_volume(val).await;
+        });
     });
     audio_card.append(&audio_icon);
     audio_card.append(&audio_slider);
     let audio_settings_btn = Button::builder()
         .label("⚙")
         .css_classes(["cc-quick-btn"])
         .valign(Align::Center)
         .tooltip_text("Impostazioni Audio")
         .build();
     let pop_audio_s = pop.clone();
@@ -1269,23 +1276,38 @@ pub fn show_control_center_popover(app: &Application) {
         .spacing(6)
         .css_classes(["cc-tile"])
         .build();
     let mpris_title = Label::builder().label("Nessun media in riproduzione").css_classes(["cc-label-main"]).halign(Align::Start).hexpand(true).ellipsize(gtk4::pango::EllipsizeMode::End).build();
     let mpris_artist = Label::builder().label("-").css_classes(["cc-label-sub"]).halign(Align::Start).hexpand(true).ellipsize(gtk4::pango::EllipsizeMode::End).build();
     let mpris_ctrl_box = GtkBox::builder().orientation(Orientation::Horizontal).spacing(12).halign(Align::Center).build();
     let prev_btn = Button::builder().label("⏮").css_classes(["cc-quick-btn"]).build();
     let play_btn = Button::builder().label("▶").css_classes(["cc-quick-btn"]).build();
     let next_btn = Button::builder().label("⏭").css_classes(["cc-quick-btn"]).build();
     
-    prev_btn.connect_clicked(|_| { let _ = Command::new("playerctl").arg("previous").spawn(); });
-    play_btn.connect_clicked(|_| { let _ = Command::new("playerctl").arg("play-pause").spawn(); });
-    next_btn.connect_clicked(|_| { let _ = Command::new("playerctl").arg("next").spawn(); });
+    prev_btn.connect_clicked(|_| {
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.player_command("previous").await;
+        });
+    });
+    play_btn.connect_clicked(|_| {
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.player_command("play-pause").await;
+        });
+    });
+    next_btn.connect_clicked(|_| {
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            let _ = ctrl.player_command("next").await;
+        });
+    });
 
     mpris_ctrl_box.append(&prev_btn);
     mpris_ctrl_box.append(&play_btn);
     mpris_ctrl_box.append(&next_btn);
     
     mpris_card.append(&mpris_title);
     mpris_card.append(&mpris_artist);
     mpris_card.append(&mpris_ctrl_box);
 
     // 4. BOTTOM SECTION (4 Quick Toggles Grid)
@@ -1408,30 +1430,31 @@ pub fn show_control_center_popover(app: &Application) {
         }
 
         let (_, _, net_sub) = get_network_status();
         let net_connected = net_sub != "Disattivato" && net_sub != "Non connesso" && net_sub != "Off" && net_sub != "Disconnected";
         if net_connected {
             wifi_btn_clone.add_css_class("cc-btn-active");
         } else {
             wifi_btn_clone.remove_css_class("cc-btn-active");
         }
 
-        let bt_enabled = if let Ok(output) = Command::new("bluetoothctl").arg("show").output() {
-            String::from_utf8_lossy(&output.stdout).contains("Powered: yes")
-        } else {
-            false
-        };
-        if bt_enabled {
-            bt_btn_clone.add_css_class("cc-btn-active");
-        } else {
-            bt_btn_clone.remove_css_class("cc-btn-active");
-        }
+        let bt_btn_clone_timer = bt_btn_clone.clone();
+        glib::MainContext::default().spawn_local(async move {
+            let ctrl = crate::core::system_proxies::get_global_controller();
+            if let Ok(enabled) = ctrl.is_bluetooth_enabled().await {
+                if enabled {
+                    bt_btn_clone_timer.add_css_class("cc-btn-active");
+                } else {
+                    bt_btn_clone_timer.remove_css_class("cc-btn-active");
+                }
+            }
+        });
 
         glib::ControlFlow::Continue
     }));
 
     let key_ctrl = gtk4::EventControllerKey::new();
     let pop_esc = pop.clone();
     key_ctrl.connect_key_pressed(move |_, keyval, _, _| {
         if keyval == gtk4::gdk::Key::Escape {
             pop_esc.close();
             glib::Propagation::Stop
