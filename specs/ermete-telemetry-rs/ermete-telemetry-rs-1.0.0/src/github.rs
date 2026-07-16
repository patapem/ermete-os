use anyhow::{Context, Result};
use reqwest::Client;
use tracing::{info, warn};
use std::fs;
use serde_json::json;

pub struct GitHubReporter {
    client: Client,
}

impl GitHubReporter {
    pub fn new() -> Self {
        Self {
            client: Client::builder().user_agent("Ermete-Telemetry-Daemon").build().unwrap(),
        }
    }

    pub async fn report_crash(&self, crash_data: &str) -> Result<()> {
        info!("Preparing crash report to Ermete Forge GitHub Issues...");
        
        let token_path = "/home/ermete/.github_token";
        let token = match fs::read_to_string(token_path) {
            Ok(t) => t.trim().to_string(),
            Err(_) => {
                warn!("No GitHub token found at {}. Crash report aborted to protect privacy without explicit opt-in.", token_path);
                return Err(anyhow::anyhow!("Opt-in GitHub token missing."));
            }
        };

        let body = json!({
            "title": "Ermete OS Crash Report",
            "body": format!("### Coredump Report\n```\n{}\n```\n_Reported automatically by Ermete OS Telemetry_", crash_data),
            "labels": ["bug", "crash"]
        });

        let url = "https://api.github.com/repos/patapem/ermete-forge/issues";
        let res = self.client
            .post(url)
            .header("Authorization", format!("token {}", token))
            .header("Accept", "application/vnd.github.v3+json")
            .json(&body)
            .send()
            .await
            .context("Failed to connect to GitHub API")?;

        if res.status().is_success() {
            info!("Crash report successfully submitted as a GitHub Issue.");
            Ok(())
        } else {
            let err_text = res.text().await?;
            Err(anyhow::anyhow!("GitHub API Error: {}", err_text))
        }
    }
}
