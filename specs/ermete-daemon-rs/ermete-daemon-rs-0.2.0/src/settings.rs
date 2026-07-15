use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;
use zbus::interface;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsState {
    pub color_scheme: String,  // "prefer-dark" or "default" (light)
    pub accent_color: String,  // hex e.g. "#89b4fa"
    pub wallpaper: String,     // e.g. "/usr/share/backgrounds/ermete-default.png"
    pub dock_pinned: Vec<String>,
}

impl Default for SettingsState {
    fn default() -> Self {
        Self {
            color_scheme: "prefer-dark".to_string(),
            accent_color: "#89b4fa".to_string(),
            wallpaper: "/usr/share/backgrounds/ermete-default.png".to_string(),
            dock_pinned: vec![
                "org.gnome.Terminal.desktop".to_string(),
                "org.mozilla.firefox.desktop".to_string(),
                "os.ermete.Settings.desktop".to_string(),
            ],
        }
    }
}

impl SettingsState {
    pub fn config_path() -> PathBuf {
        let mut path = if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
            PathBuf::from(xdg)
        } else if let Ok(home) = std::env::var("HOME") {
            let mut p = PathBuf::from(home);
            p.push(".config");
            p
        } else {
            PathBuf::from("/var/lib/ermete")
        };
        path.push("ermete");
        let _ = std::fs::create_dir_all(&path);
        path.push("settings.json");
        path
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(state) = serde_json::from_str(&content) {
                return state;
            }
        }
        Self::default()
    }

    pub fn save(&self) -> std::io::Result<()> {
        let path = Self::config_path();
        let content = serde_json::to_string_pretty(self)?;
        let temp_path = path.with_extension("json.tmp");
        std::fs::write(&temp_path, content)?;
        std::fs::rename(&temp_path, &path)?;
        Ok(())
    }
}

#[derive(Clone)]
pub struct SettingsService {
    pub state: Arc<Mutex<SettingsState>>,
}

impl SettingsService {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(SettingsState::load())),
        }
    }
}

use zbus::fdo;

#[interface(name = "org.ermete.Settings")]
impl SettingsService {
    #[zbus(property, name = "ColorScheme")]
    async fn color_scheme(&self) -> String {
        self.state.lock().await.color_scheme.clone()
    }

    #[zbus(property, name = "ColorScheme")]
    async fn set_color_scheme(&self, val: String) -> fdo::Result<()> {
        {
            let mut st = self.state.lock().await;
            st.color_scheme = val.clone();
            st.save().map_err(|e| fdo::Error::Failed(format!("Failed to save state: {}", e)))?;
        }
        let _ = tokio::process::Command::new("dconf")
            .args(["write", "/org/gnome/desktop/interface/color-scheme", &format!("'{}'", val)])
            .output()
            .await;
        Ok(())
    }

    #[zbus(property, name = "AccentColor")]
    async fn accent_color(&self) -> String {
        self.state.lock().await.accent_color.clone()
    }

    #[zbus(property, name = "AccentColor")]
    async fn set_accent_color(&self, val: String) -> fdo::Result<()> {
        {
            let mut st = self.state.lock().await;
            st.accent_color = val.clone();
            st.save().map_err(|e| fdo::Error::Failed(format!("Failed to save state: {}", e)))?;
        }
        let _ = tokio::process::Command::new("matugen")
            .args(["color", "hex", &val])
            .output()
            .await;
        Ok(())
    }

    #[zbus(property, name = "Wallpaper")]
    async fn wallpaper(&self) -> String {
        self.state.lock().await.wallpaper.clone()
    }

    #[zbus(property, name = "Wallpaper")]
    async fn set_wallpaper(&self, val: String) -> fdo::Result<()> {
        {
            let mut st = self.state.lock().await;
            st.wallpaper = val.clone();
            st.save().map_err(|e| fdo::Error::Failed(format!("Failed to save state: {}", e)))?;
        }
        let _ = tokio::process::Command::new("swww")
            .args(["img", &val, "--transition-type", "grow", "--transition-pos", "0.5,0.5"])
            .output()
            .await;
        Ok(())
    }
}
