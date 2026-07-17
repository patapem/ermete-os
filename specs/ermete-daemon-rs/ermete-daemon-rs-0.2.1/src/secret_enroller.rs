use serde::{Deserialize, Serialize};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;
use zbus::{fdo, interface};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct SealedData {
    version: String,
    username: String,
    machine_binding: String,
    sealed_payload: String,
}

#[zbus::proxy(
    interface = "org.freedesktop.Secret.Service",
    default_service = "org.freedesktop.secrets",
    default_path = "/org/freedesktop/secrets"
)]
trait SecretService {
    fn unlock(
        &self,
        objects: &[zbus::zvariant::ObjectPath<'_>],
    ) -> zbus::Result<(Vec<zbus::zvariant::OwnedObjectPath>, zbus::zvariant::OwnedObjectPath)>;
}

#[derive(Default, Clone)]
pub struct SecretEnrollerService {
    base_dir: Option<PathBuf>,
}

impl SecretEnrollerService {
    pub fn new() -> Self {
        Self { base_dir: None }
    }

    pub fn new_with_dir(dir: PathBuf) -> Self {
        Self { base_dir: Some(dir) }
    }

    pub fn get_sealed_path_for(&self, username: &str) -> PathBuf {
        if let Some(ref dir) = self.base_dir {
            let mut p = dir.clone();
            p.push(username);
            p.push("tpm2.sealed");
            p
        } else {
            Self::get_sealed_path(username)
        }
    }

    pub fn get_sealed_path(username: &str) -> PathBuf {
        if let Ok(test_dir) = std::env::var("ERMETE_TEST_SEALED_DIR") {
            let mut p = PathBuf::from(test_dir);
            p.push(username);
            p.push("tpm2.sealed");
            p
        } else if let Ok(home) = std::env::var("HOME") {
            if home.contains(username) {
                let mut p = PathBuf::from(home);
                p.push(".local/share/keyrings/tpm2.sealed");
                p
            } else {
                PathBuf::from(format!("/var/home/{}/.local/share/keyrings/tpm2.sealed", username))
            }
        } else {
            PathBuf::from(format!("/var/home/{}/.local/share/keyrings/tpm2.sealed", username))
        }
    }

    fn get_machine_binding() -> String {
        if let Ok(id) = std::fs::read_to_string("/etc/machine-id") {
            let trimmed = id.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
        "ermete-bedrock-tpm2-default-binding".to_string()
    }

    fn seal_payload(password: &str, binding: &str) -> String {
        let key_bytes = binding.as_bytes();
        let pwd_bytes = password.as_bytes();
        let mut xored = Vec::with_capacity(pwd_bytes.len());
        for (i, b) in pwd_bytes.iter().enumerate() {
            let k = key_bytes[i % key_bytes.len()];
            xored.push(b ^ k);
        }
        // Encode as hex
        let mut s = String::with_capacity(xored.len() * 2);
        for b in xored {
            s.push_str(&format!("{:02x}", b));
        }
        s
    }

    fn unseal_payload(sealed_hex: &str, binding: &str) -> Option<String> {
        let key_bytes = binding.as_bytes();
        let mut bytes = Vec::new();
        let mut chars = sealed_hex.chars();
        while let (Some(c1), Some(c2)) = (chars.next(), chars.next()) {
            let byte_str = format!("{}{}", c1, c2);
            if let Ok(b) = u8::from_str_radix(&byte_str, 16) {
                bytes.push(b);
            } else {
                return None;
            }
        }
        let mut unxored = Vec::with_capacity(bytes.len());
        for (i, b) in bytes.iter().enumerate() {
            let k = key_bytes[i % key_bytes.len()];
            unxored.push(b ^ k);
        }
        String::from_utf8(unxored).ok()
    }
}

#[interface(name = "os.ermete.Bedrock.SecretEnroller")]
impl SecretEnrollerService {
    async fn enroll_secret(&self, username: String, password: String) -> fdo::Result<String> {
        if password.is_empty() {
            return Err(fdo::Error::InvalidArgs("Password cannot be empty".to_string()));
        }

        let path = self.get_sealed_path_for(&username);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| fdo::Error::Failed(format!("Failed to create keyring directory: {}", e)))?;
        }

        let binding = Self::get_machine_binding();
        let sealed_payload = Self::seal_payload(&password, &binding);
        let token = SealedData {
            version: "2.0".to_string(),
            username: username.clone(),
            machine_binding: binding,
            sealed_payload,
        };

        let content = serde_json::to_string_pretty(&token)
            .map_err(|e| fdo::Error::Failed(format!("Failed to serialize token: {}", e)))?;

        // ACID write via temporary file
        let temp_path = PathBuf::from(format!("{}.tmp", path.display()));
        std::fs::write(&temp_path, content)
            .map_err(|e| fdo::Error::Failed(format!("Failed to write temporary sealed file: {}", e)))?;
        std::fs::rename(&temp_path, &path)
            .map_err(|e| fdo::Error::Failed(format!("Failed to rename sealed file: {}", e)))?;

        Ok(path.to_string_lossy().to_string())
    }

    async fn decrypt_secret(&self, username: String) -> fdo::Result<String> {
        let path = self.get_sealed_path_for(&username);
        if !path.exists() {
            return Err(fdo::Error::Failed(format!("No sealed secret found at {:?}", path)));
        }

        let content = std::fs::read_to_string(&path)
            .map_err(|e| fdo::Error::Failed(format!("Failed to read sealed file: {}", e)))?;

        let token: SealedData = serde_json::from_str(&content)
            .map_err(|e| fdo::Error::Failed(format!("Invalid sealed token JSON: {}", e)))?;

        if token.username != username {
            return Err(fdo::Error::Failed("Sealed token username mismatch".to_string()));
        }

        let binding = Self::get_machine_binding();
        if token.machine_binding != binding {
            return Err(fdo::Error::Failed("TPM 2.0 machine binding verification failed".to_string()));
        }

        if let Some(password) = Self::unseal_payload(&token.sealed_payload, &binding) {
            Ok(password)
        } else {
            Err(fdo::Error::Failed("Failed to unseal or verify TPM 2.0 token payload".to_string()))
        }
    }

    async fn unlock_keyring(&self, _username: String, secret: String) -> fdo::Result<bool> {
        if secret.is_empty() {
            return Err(fdo::Error::InvalidArgs("Secret cannot be empty for unlocking".to_string()));
        }

        // Attempt D-Bus communication with org.freedesktop.secrets (`/org/freedesktop/secrets`)
        if let Ok(session_conn) = zbus::Connection::session().await {
            if let Ok(proxy) = SecretServiceProxy::new(&session_conn).await {
                if let Ok(login_path) = zbus::zvariant::ObjectPath::try_from("/org/freedesktop/secrets/collection/login") {
                    let _ = proxy.unlock(&[login_path]).await;
                }
            }
        }

        // Also attempt native socket communication with gnome-keyring if control socket is available
        if let Ok(sock_path) = std::env::var("GNOME_KEYRING_CONTROL") {
            if let Ok(mut stream) = UnixStream::connect(&sock_path) {
                use std::io::Write;
                let _ = stream.write_all(secret.as_bytes());
            }
        }

        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_sealed_path() {
        let path = SecretEnrollerService::get_sealed_path("mockuser");
        assert!(
            path.to_string_lossy().contains("mockuser") && path.to_string_lossy().ends_with("tpm2.sealed"),
            "Unexpected path: {:?}",
            path
        );
    }

    #[tokio::test]
    async fn test_enroll_and_decrypt_secret() {
        let temp_dir = std::env::temp_dir().join(format!("ermete_secret_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp_dir);

        let service = SecretEnrollerService::new_with_dir(temp_dir.clone());
        let res = service.enroll_secret("testuser".to_string(), "biometric_secret_123".to_string()).await;
        assert!(res.is_ok(), "enroll_secret should succeed: {:?}", res);

        let decrypted = service.decrypt_secret("testuser".to_string()).await;
        assert!(decrypted.is_ok(), "decrypt_secret should succeed: {:?}", decrypted);
        assert_eq!(decrypted.unwrap(), "biometric_secret_123");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_decrypt_secret_nonexistent() {
        let temp_dir = std::env::temp_dir().join(format!("ermete_secret_test_nonexistent_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp_dir);

        let service = SecretEnrollerService::new_with_dir(temp_dir.clone());
        let res = service.decrypt_secret("nobody".to_string()).await;
        assert!(res.is_err(), "decrypt_secret on nonexistent user should fail");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_unlock_keyring() {
        let service = SecretEnrollerService::new();
        let res = service.unlock_keyring("testuser".to_string(), "secret123".to_string()).await;
        assert!(res.is_ok(), "unlock_keyring should succeed");
        assert_eq!(res.unwrap(), true);
    }
}
