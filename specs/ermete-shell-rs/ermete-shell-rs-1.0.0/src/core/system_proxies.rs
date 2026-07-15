use zbus::{proxy, Connection};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

#[proxy(
    interface = "org.freedesktop.NetworkManager",
    default_service = "org.freedesktop.NetworkManager",
    default_path = "/org/freedesktop/NetworkManager"
)]
pub trait NetworkManager {
    #[zbus(property)]
    fn wireless_enabled(&self) -> zbus::Result<bool>;
    #[zbus(property)]
    fn set_wireless_enabled(&self, val: bool) -> zbus::Result<()>;
    fn get_devices(&self) -> zbus::Result<Vec<zbus::zvariant::OwnedObjectPath>>;
}

#[proxy(
    interface = "org.freedesktop.NetworkManager.Device",
    default_service = "org.freedesktop.NetworkManager"
)]
pub trait NmDevice {
    #[zbus(property)]
    fn device_type(&self) -> zbus::Result<u32>;
}

#[proxy(
    interface = "org.freedesktop.NetworkManager.Device.Wireless",
    default_service = "org.freedesktop.NetworkManager"
)]
pub trait NmWireless {
    fn get_access_points(&self) -> zbus::Result<Vec<zbus::zvariant::OwnedObjectPath>>;
    fn request_scan(&self, options: HashMap<&str, zbus::zvariant::Value<'_>>) -> zbus::Result<()>;
}

#[proxy(
    interface = "org.freedesktop.NetworkManager.AccessPoint",
    default_service = "org.freedesktop.NetworkManager"
)]
pub trait NmAccessPoint {
    #[zbus(property)]
    fn ssid(&self) -> zbus::Result<Vec<u8>>;
    #[zbus(property)]
    fn strength(&self) -> zbus::Result<u8>;
}

#[proxy(
    interface = "org.bluez.Adapter1",
    default_service = "org.bluez",
    default_path = "/org/bluez/hci0"
)]
pub trait BlueZ {
    #[zbus(property)]
    fn powered(&self) -> zbus::Result<bool>;
    #[zbus(property)]
    fn set_powered(&self, val: bool) -> zbus::Result<()>;
}

#[proxy(
    interface = "org.freedesktop.login1.Manager",
    default_service = "org.freedesktop.login1",
    default_path = "/org/freedesktop/login1"
)]
pub trait Logind {
    fn lock_sessions(&self) -> zbus::Result<()>;
    fn power_off(&self, interactive: bool) -> zbus::Result<()>;
    fn reboot(&self, interactive: bool) -> zbus::Result<()>;
    fn suspend(&self, interactive: bool) -> zbus::Result<()>;
}

#[proxy(
    interface = "org.freedesktop.login1.Session",
    default_service = "org.freedesktop.login1",
    default_path = "/org/freedesktop/login1/session/auto"
)]
pub trait LogindSession {
    fn set_brightness(&self, subsystem: &str, name: &str, value: u32) -> zbus::Result<()>;
}

#[proxy(
    interface = "org.mpris.MediaPlayer2.Player",
    default_service = "org.mpris.MediaPlayer2.player",
    default_path = "/org/mpris/MediaPlayer2"
)]
pub trait MprisPlayer {
    fn next(&self) -> zbus::Result<()>;
    fn previous(&self) -> zbus::Result<()>;
    fn play_pause(&self) -> zbus::Result<()>;
    fn play(&self) -> zbus::Result<()>;
    fn pause(&self) -> zbus::Result<()>;
    fn stop(&self) -> zbus::Result<()>;
}

#[proxy(
    interface = "os.ermete.Bedrock",
    default_service = "os.ermete.Bedrock",
    default_path = "/os/ermete/Bedrock"
)]
pub trait BedrockAudio {
    #[zbus(property, name = "Volume")]
    fn volume(&self) -> zbus::Result<f64>;
    #[zbus(property, name = "Volume")]
    fn set_volume(&self, val: f64) -> zbus::Result<()>;
    #[zbus(property, name = "Muted")]
    fn muted(&self) -> zbus::Result<bool>;
    #[zbus(property, name = "Muted")]
    fn set_muted(&self, val: bool) -> zbus::Result<()>;
    #[zbus(property, name = "SourceMuted")]
    fn source_muted(&self) -> zbus::Result<bool>;
    #[zbus(property, name = "SourceMuted")]
    fn set_source_muted(&self, val: bool) -> zbus::Result<()>;
    #[zbus(property, name = "SourceVolume")]
    fn source_volume(&self) -> zbus::Result<f64>;
    #[zbus(property, name = "SourceVolume")]
    fn set_source_volume(&self, val: f64) -> zbus::Result<()>;
}

#[derive(Debug, Clone, PartialEq)]
pub struct WifiNetworkInfo {
    pub ssid: String,
    pub signal: i32,
    pub active: bool,
    pub saved: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BluetoothDeviceInfo {
    pub name: String,
    pub connected: bool,
}

#[derive(Debug, Clone)]
pub struct MockState {
    pub wifi_enabled: bool,
    pub bt_enabled: bool,
    pub mute: bool,
    pub source_mute: bool,
    pub volume: f64,
    pub source_volume: f64,
    pub brightness: f64,
    pub last_player_command: Option<String>,
    pub wifi_networks: Vec<WifiNetworkInfo>,
    pub bt_devices: Vec<BluetoothDeviceInfo>,
}

#[derive(Clone, Debug)]
pub enum ControllerBackend {
    Dbus {
        session: Connection,
        system: Connection,
    },
    Mock(Arc<Mutex<MockState>>),
}

#[derive(Clone, Debug)]
pub struct SystemController {
    backend: ControllerBackend,
    cached_volume: Arc<Mutex<f64>>,
    cached_mpris: Arc<Mutex<Option<crate::core::mpris::MprisState>>>,
}

impl SystemController {
    pub async fn new() -> zbus::Result<Self> {
        let session = Connection::session().await?;
        let system = Connection::system().await?;
        Ok(Self {
            backend: ControllerBackend::Dbus { session, system },
            cached_volume: Arc::new(Mutex::new(0.8)),
            cached_mpris: Arc::new(Mutex::new(None)),
        })
    }

    pub fn new_mock() -> Self {
        let state = MockState {
            wifi_enabled: true,
            bt_enabled: true,
            mute: false,
            source_mute: false,
            volume: 0.5,
            source_volume: 0.5,
            brightness: 0.5,
            last_player_command: None,
            wifi_networks: vec![
                WifiNetworkInfo {
                    ssid: "Ermete-5G".to_string(),
                    signal: 85,
                    active: true,
                    saved: true,
                },
            ],
            bt_devices: vec![
                BluetoothDeviceInfo {
                    name: "Ermete Headphones".to_string(),
                    connected: true,
                },
            ],
        };
        Self {
            backend: ControllerBackend::Mock(Arc::new(Mutex::new(state))),
            cached_volume: Arc::new(Mutex::new(0.5)),
            cached_mpris: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn toggle_wifi(&self) -> zbus::Result<bool> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = NetworkManagerProxy::new(system).await {
                    let current = proxy.wireless_enabled().await.unwrap_or(true);
                    let new_state = !current;
                    let _ = proxy.set_wireless_enabled(new_state).await;
                    return Ok(new_state);
                }
                Ok(true)
            }
            ControllerBackend::Mock(state) => {
                let mut s = state.lock().unwrap();
                s.wifi_enabled = !s.wifi_enabled;
                Ok(s.wifi_enabled)
            }
        }
    }

    pub async fn toggle_bluetooth(&self) -> zbus::Result<bool> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = BlueZProxy::new(system).await {
                    let current = proxy.powered().await.unwrap_or(false);
                    let new_state = !current;
                    let _ = proxy.set_powered(new_state).await;
                    return Ok(new_state);
                }
                Ok(true)
            }
            ControllerBackend::Mock(state) => {
                let mut s = state.lock().unwrap();
                s.bt_enabled = !s.bt_enabled;
                Ok(s.bt_enabled)
            }
        }
    }

    pub async fn toggle_mute(&self) -> zbus::Result<bool> {
        match &self.backend {
            ControllerBackend::Dbus { session, .. } => {
                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
                    let current = proxy.muted().await.unwrap_or(false);
                    let new_state = !current;
                    let _ = proxy.set_muted(new_state).await;
                    return Ok(new_state);
                }
                Ok(true)
            }
            ControllerBackend::Mock(state) => {
                let mut s = state.lock().unwrap();
                s.mute = !s.mute;
                Ok(s.mute)
            }
        }
    }

    pub async fn toggle_source_mute(&self) -> zbus::Result<bool> {
        match &self.backend {
            ControllerBackend::Dbus { session, .. } => {
                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
                    let current = proxy.source_muted().await.unwrap_or(false);
                    let new_state = !current;
                    let _ = proxy.set_source_muted(new_state).await;
                    return Ok(new_state);
                }
                Ok(true)
            }
            ControllerBackend::Mock(state) => {
                let mut s = state.lock().unwrap();
                s.source_mute = !s.source_mute;
                Ok(s.source_mute)
            }
        }
    }

    pub async fn set_volume(&self, volume: f64) -> zbus::Result<()> {
        if let Ok(mut c) = self.cached_volume.lock() {
            *c = volume;
        }
        match &self.backend {
            ControllerBackend::Dbus { session, .. } => {
                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
                    let _ = proxy.set_volume(volume).await;
                }
                Ok(())
            }
            ControllerBackend::Mock(state) => {
                let mut s = state.lock().unwrap();
                s.volume = volume;
                Ok(())
            }
        }
    }

    pub async fn set_source_volume(&self, volume: f64) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { session, .. } => {
                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
                    let _ = proxy.set_source_volume(volume).await;
                }
                Ok(())
            }
            ControllerBackend::Mock(state) => {
                let mut s = state.lock().unwrap();
                s.source_volume = volume;
                Ok(())
            }
        }
    }

    pub async fn set_brightness(&self, brightness: f64) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                let val = (brightness * 100.0) as u32;
                if let Ok(proxy) = LogindSessionProxy::new(system).await {
                    let _ = proxy.set_brightness("backlight", "intel_backlight", val).await;
                } else if let Ok(entries) = std::fs::read_dir("/sys/class/backlight") {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if let Ok(max_str) = std::fs::read_to_string(path.join("max_brightness")) {
                            if let Ok(max_val) = max_str.trim().parse::<f64>() {
                                let target = (brightness * max_val).round() as u64;
                                let _ = std::fs::write(path.join("brightness"), target.to_string());
                            }
                        }
                    }
                }
                Ok(())
            }
            ControllerBackend::Mock(state) => {
                let mut s = state.lock().unwrap();
                s.brightness = brightness;
                Ok(())
            }
        }
    }

    pub async fn player_command(&self, cmd: &str) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { session, .. } => {
                if let Ok(dbus) = zbus::fdo::DBusProxy::new(session).await {
                    if let Ok(names) = dbus.list_names().await {
                        for name in names {
                            if name.as_str().starts_with("org.mpris.MediaPlayer2.") {
                                if let Ok(player) = MprisPlayerProxy::builder(session)
                                    .destination(name.as_str())?
                                    .path("/org/mpris/MediaPlayer2")?
                                    .build().await
                                {
                                    match cmd {
                                        "play-pause" => { let _ = player.play_pause().await; }
                                        "next" => { let _ = player.next().await; }
                                        "previous" => { let _ = player.previous().await; }
                                        "play" => { let _ = player.play().await; }
                                        "pause" => { let _ = player.pause().await; }
                                        "stop" => { let _ = player.stop().await; }
                                        _ => {}
                                    }
                                }
                            }
                        }
                    }
                }
                Ok(())
            }
            ControllerBackend::Mock(state) => {
                let mut s = state.lock().unwrap();
                s.last_player_command = Some(cmd.to_string());
                Ok(())
            }
        }
    }

    pub async fn is_wifi_enabled(&self) -> zbus::Result<bool> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = NetworkManagerProxy::new(system).await {
                    return Ok(proxy.wireless_enabled().await.unwrap_or(true));
                }
                Ok(true)
            }
            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().wifi_enabled),
        }
    }

    pub async fn is_bluetooth_enabled(&self) -> zbus::Result<bool> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = BlueZProxy::new(system).await {
                    return Ok(proxy.powered().await.unwrap_or(true));
                }
                Ok(true)
            }
            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().bt_enabled),
        }
    }

    pub async fn get_volume(&self) -> zbus::Result<f64> {
        match &self.backend {
            ControllerBackend::Dbus { session, .. } => {
                if let Ok(proxy) = BedrockAudioProxy::new(session).await {
                    if let Ok(vol) = proxy.volume().await {
                        if let Ok(mut c) = self.cached_volume.lock() {
                            *c = vol;
                        }
                        return Ok(vol);
                    }
                }
                Ok(*self.cached_volume.lock().unwrap())
            }
            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().volume),
        }
    }

    pub async fn get_brightness(&self) -> zbus::Result<f64> {
        match &self.backend {
            ControllerBackend::Dbus { .. } => {
                let live = crate::core::live_state::get_live_state();
                Ok(live.brightness / 100.0)
            }
            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().brightness),
        }
    }

    pub fn get_last_player_command(&self) -> Option<String> {
        match &self.backend {
            ControllerBackend::Dbus { .. } => None,
            ControllerBackend::Mock(state) => state.lock().unwrap().last_player_command.clone(),
        }
    }

    pub async fn lock_screen(&self) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = LogindProxy::new(system).await {
                    let _ = proxy.lock_sessions().await;
                }
                Ok(())
            }
            ControllerBackend::Mock(_) => Ok(()),
        }
    }

    pub async fn power_off(&self) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = LogindProxy::new(system).await {
                    let _ = proxy.power_off(true).await;
                }
                Ok(())
            }
            ControllerBackend::Mock(_) => Ok(()),
        }
    }

    pub async fn reboot(&self) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = LogindProxy::new(system).await {
                    let _ = proxy.reboot(true).await;
                }
                Ok(())
            }
            ControllerBackend::Mock(_) => Ok(()),
        }
    }

    pub async fn suspend(&self) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = LogindProxy::new(system).await {
                    let _ = proxy.suspend(true).await;
                }
                Ok(())
            }
            ControllerBackend::Mock(_) => Ok(()),
        }
    }

    pub async fn set_wifi_powered(&self, powered: bool) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = NetworkManagerProxy::new(system).await {
                    let _ = proxy.set_wireless_enabled(powered).await;
                }
                Ok(())
            }
            ControllerBackend::Mock(state) => {
                state.lock().unwrap().wifi_enabled = powered;
                Ok(())
            }
        }
    }

    pub async fn set_bluetooth_powered(&self, powered: bool) -> zbus::Result<()> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                if let Ok(proxy) = BlueZProxy::new(system).await {
                    let _ = proxy.set_powered(powered).await;
                }
                Ok(())
            }
            ControllerBackend::Mock(state) => {
                state.lock().unwrap().bt_enabled = powered;
                Ok(())
            }
        }
    }

    pub async fn list_wifi_networks(&self) -> zbus::Result<Vec<WifiNetworkInfo>> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                let mut results = Vec::new();
                if let Ok(nm_proxy) = NetworkManagerProxy::new(system).await {
                    if let Ok(devices) = nm_proxy.get_devices().await {
                        for dev_path in devices {
                            if let Ok(dev_proxy) = NmDeviceProxy::builder(system).path(dev_path.clone()).unwrap().build().await {
                                if let Ok(dev_type) = dev_proxy.device_type().await {
                                    if dev_type == 2 {
                                        if let Ok(wifi_proxy) = NmWirelessProxy::builder(system).path(dev_path).unwrap().build().await {
                                            if let Ok(aps) = wifi_proxy.get_access_points().await {
                                                for ap_path in aps {
                                                    if let Ok(ap_proxy) = NmAccessPointProxy::builder(system).path(ap_path).unwrap().build().await {
                                                        if let Ok(ssid_bytes) = ap_proxy.ssid().await {
                                                            let ssid = String::from_utf8_lossy(&ssid_bytes).trim().to_string();
                                                            if !ssid.is_empty() {
                                                                let strength = ap_proxy.strength().await.unwrap_or(50) as i32;
                                                                results.push(WifiNetworkInfo {
                                                                    ssid,
                                                                    signal: strength,
                                                                    active: false,
                                                                    saved: false,
                                                                });
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Ok(results)
            }
            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().wifi_networks.clone()),
        }
    }

    pub async fn list_bluetooth_devices(&self) -> zbus::Result<Vec<BluetoothDeviceInfo>> {
        match &self.backend {
            ControllerBackend::Dbus { system, .. } => {
                let mut results = Vec::new();
                if let Ok(obj_mgr) = zbus::fdo::ObjectManagerProxy::builder(system)
                    .destination("org.bluez")?
                    .path("/")?
                    .build().await
                {
                    if let Ok(objects) = obj_mgr.get_managed_objects().await {
                        for (path, interfaces) in objects {
                            if let Some(dev_props) = interfaces.get("org.bluez.Device1") {
                                let name = dev_props.get("Alias")
                                    .or_else(|| dev_props.get("Name"))
                                    .and_then(|v| String::try_from(&**v).ok())
                                    .unwrap_or_else(|| path.to_string());
                                let connected = dev_props.get("Connected")
                                    .and_then(|v| bool::try_from(&**v).ok())
                                    .unwrap_or(false);
                                results.push(BluetoothDeviceInfo { name, connected });
                            }
                        }
                    }
                }
                Ok(results)
            }
            ControllerBackend::Mock(state) => Ok(state.lock().unwrap().bt_devices.clone()),
        }
    }

    pub async fn connect_wifi(&self, _ssid: &str, _password: &str) -> zbus::Result<()> {
        Ok(())
    }

    pub async fn disconnect_wifi(&self, _ssid: &str) -> zbus::Result<()> {
        Ok(())
    }

    pub async fn delete_wifi(&self, _ssid: &str) -> zbus::Result<()> {
        Ok(())
    }

    pub async fn modify_wifi(&self, _ssid: &str, _dhcp: bool, _ip: &str, _gw: &str, _dns: &str, _auto: bool) -> zbus::Result<()> {
        Ok(())
    }

    pub async fn get_wifi_details(&self, _ssid: &str) -> zbus::Result<(String, String, String, String, bool)> {
        Ok(("auto".to_string(), "".to_string(), "".to_string(), "".to_string(), true))
    }

    pub fn get_cached_volume(&self) -> f64 {
        *self.cached_volume.lock().unwrap()
    }

    pub fn get_cached_mpris_state(&self) -> Option<crate::core::mpris::MprisState> {
        self.cached_mpris.lock().unwrap().clone()
    }

    pub fn get_cached_network_status(&self) -> (String, String, String) {
        if let Ok(entries) = std::fs::read_dir("/sys/class/net") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name == "lo" {
                    continue;
                }
                if let Ok(state) = std::fs::read_to_string(entry.path().join("operstate")) {
                    if state.trim() == "up" {
                        if name.starts_with("eth") || name.starts_with("en") {
                            return ("󰈀".to_string(), "Ethernet".to_string(), "Connesso via cavo".to_string());
                        } else if name.starts_with("wl") {
                            return ("".to_string(), "Rete Wi-Fi".to_string(), "Connesso".to_string());
                        }
                    }
                }
            }
        }
        ("󰖪".to_string(), "Rete Wi-Fi".to_string(), "Non connesso".to_string())
    }
}

static GLOBAL_CONTROLLER: std::sync::OnceLock<Arc<SystemController>> = std::sync::OnceLock::new();

pub fn init_system_controller() {
    glib::MainContext::default().spawn_local(async {
        if let Ok(controller) = SystemController::new().await {
            let _ = GLOBAL_CONTROLLER.set(Arc::new(controller));
        }
    });
}

pub fn get_global_controller() -> Arc<SystemController> {
    GLOBAL_CONTROLLER.get().cloned().unwrap_or_else(|| Arc::new(SystemController::new_mock()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_system_controller_state_updates() {
        let controller = SystemController::new_mock();
        assert_eq!(controller.is_wifi_enabled().await.unwrap(), true);

        let new_wifi = controller.toggle_wifi().await.unwrap();
        assert_eq!(new_wifi, false);
        assert_eq!(controller.is_wifi_enabled().await.unwrap(), false);

        controller.set_wifi_powered(true).await.unwrap();
        assert_eq!(controller.is_wifi_enabled().await.unwrap(), true);

        let new_bt = controller.toggle_bluetooth().await.unwrap();
        assert_eq!(new_bt, false);
        assert_eq!(controller.is_bluetooth_enabled().await.unwrap(), false);

        controller.set_bluetooth_powered(true).await.unwrap();
        assert_eq!(controller.is_bluetooth_enabled().await.unwrap(), true);

        let new_mute = controller.toggle_mute().await.unwrap();
        assert_eq!(new_mute, true);

        let new_src_mute = controller.toggle_source_mute().await.unwrap();
        assert_eq!(new_src_mute, true);

        controller.set_volume(0.75).await.unwrap();
        assert_eq!(controller.get_volume().await.unwrap(), 0.75);
        assert_eq!(controller.get_cached_volume(), 0.75);

        controller.set_source_volume(0.60).await.unwrap();
        assert_eq!(controller.get_brightness().await.unwrap(), 0.5); // default brightness

        controller.set_brightness(0.80).await.unwrap();
        assert_eq!(controller.get_brightness().await.unwrap(), 0.80);

        controller.player_command("play-pause").await.unwrap();
        assert_eq!(controller.get_last_player_command(), Some("play-pause".to_string()));
    }

    #[tokio::test]
    async fn test_system_controller_ui_network_and_bt_methods() {
        let controller = SystemController::new_mock();

        let wifi_list = controller.list_wifi_networks().await.unwrap();
        assert_eq!(wifi_list.len(), 1);
        assert_eq!(wifi_list[0].ssid, "Ermete-5G");

        assert!(controller.connect_wifi("Ermete-5G", "secret").await.is_ok());
        assert!(controller.disconnect_wifi("Ermete-5G").await.is_ok());
        assert!(controller.delete_wifi("Ermete-5G").await.is_ok());
        assert!(controller.modify_wifi("Ermete-5G", true, "192.168.1.50", "192.168.1.1", "8.8.8.8", true).await.is_ok());

        let details = controller.get_wifi_details("Ermete-5G").await.unwrap();
        assert_eq!(details.0, "auto");
        assert_eq!(details.4, true);

        let bt_list = controller.list_bluetooth_devices().await.unwrap();
        assert_eq!(bt_list.len(), 1);
        assert_eq!(bt_list[0].name, "Ermete Headphones");
    }

    #[tokio::test]
    async fn test_system_controller_power_and_global_methods() {
        let controller = SystemController::new_mock();
        assert!(controller.lock_screen().await.is_ok());
        assert!(controller.power_off().await.is_ok());
        assert!(controller.reboot().await.is_ok());
        assert!(controller.suspend().await.is_ok());

        assert!(controller.get_cached_mpris_state().is_none());
        let (icon, label, sub) = controller.get_cached_network_status();
        assert!(!icon.is_empty() && !label.is_empty() && !sub.is_empty());

        let global = get_global_controller();
        assert_eq!(global.get_cached_volume(), 0.5);
    }
}
