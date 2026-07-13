use anyhow::Result;
use tokio::process::Command;
use std::process::Stdio;

#[derive(Debug, Clone, PartialEq)]
pub struct AppInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
}

pub fn parse_search_output(stdout_str: &str) -> Vec<AppInfo> {
    let mut apps = Vec::new();
    for line in stdout_str.lines() {
        if line.trim().is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            apps.push(AppInfo {
                id: parts[0].trim().to_string(),
                name: parts[1].trim().to_string(),
                description: parts[2].trim().to_string(),
                version: if parts.len() >= 4 { parts[3].trim().to_string() } else { "".to_string() },
            });
        }
    }
    apps
}

pub async fn search_apps(query: &str) -> Result<Vec<AppInfo>> {
    let output = Command::new("flatpak")
        .arg("search")
        .arg("--columns=application,name,description,version")
        .arg(query)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await?;

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    Ok(parse_search_output(&stdout_str))
}

pub async fn get_featured_apps() -> Result<Vec<AppInfo>> {
    let featured_queries = ["blender", "gimp", "vlc", "obsidian"];
    let mut apps = Vec::new();
    for query in featured_queries {
        if let Ok(results) = search_apps(query).await {
            if let Some(first) = results.into_iter().next() {
                apps.push(first);
            }
        }
    }
    Ok(apps)
}

pub async fn install_app(id: &str) -> Result<()> {
    let status = Command::new("flatpak")
        .arg("install")
        .arg("-y")
        .arg("flathub")
        .arg(id)
        .status()
        .await?;
        
    if status.success() {
        Ok(())
    } else {
        Err(anyhow::anyhow!("Failed to install {}", id))
    }
}

pub async fn update_system() -> Result<String> {
    let output = Command::new("rpm-ostree")
        .arg("upgrade")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await?;
        
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(anyhow::anyhow!("Update failed: {}", String::from_utf8_lossy(&output.stderr)))
    }
}

pub async fn update_apps() -> Result<String> {
    let output = Command::new("flatpak")
        .arg("update")
        .arg("-y")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await?;
        
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(anyhow::anyhow!("App update failed: {}", String::from_utf8_lossy(&output.stderr)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_search_output() {
        let sample = "org.blender.Blender\tBlender\tFree and open source 3D creation suite\t4.1.1\n\
                      org.gimp.GIMP\tGNU Image Manipulation Program\tCreate images and edit photographs\t2.10.36";
        let apps = parse_search_output(sample);
        assert_eq!(apps.len(), 2);
        assert_eq!(apps[0].id, "org.blender.Blender");
        assert_eq!(apps[0].name, "Blender");
        assert_eq!(apps[0].description, "Free and open source 3D creation suite");
        assert_eq!(apps[0].version, "4.1.1");
        
        assert_eq!(apps[1].id, "org.gimp.GIMP");
        assert_eq!(apps[1].name, "GNU Image Manipulation Program");
        assert_eq!(apps[1].version, "2.10.36");
    }
}
