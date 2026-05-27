use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub api_url: String,
    pub api_key: String,
    pub model: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_url: "https://token-plan-cn.xiaomimimo.com/v1/chat/completions".to_string(),
            api_key: String::new(),
            model: "gpt-3.5-turbo".to_string(),
        }
    }
}

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub history: Mutex<Vec<ChatMessage>>,
    pub config_path: Mutex<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

pub fn get_config_path(app: &tauri::AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("config.json")
}

pub fn load_config(app: &tauri::AppHandle) -> AppConfig {
    let path = get_config_path(app);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

fn save_config(path: &PathBuf, config: &AppConfig) {
    if let Ok(content) = serde_json::to_string_pretty(config) {
        let _ = fs::write(path, content);
    }
}

#[tauri::command]
pub fn get_config(state: State<AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_config(state: State<AppState>, config: AppConfig) {
    let path = state.config_path.lock().unwrap().clone();
    save_config(&path, &config);
    *state.config.lock().unwrap() = config;
}

#[tauri::command]
pub fn clear_history(state: State<AppState>) {
    state.history.lock().unwrap().clear();
}

#[tauri::command]
pub async fn chat(
    state: State<'_, AppState>,
    message: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let (api_url, api_key, model) = {
        let config = state.config.lock().unwrap();
        (
            config.api_url.clone(),
            config.api_key.clone(),
            config.model.clone(),
        )
    };

    if api_key.is_empty() {
        return Err("请先配置 API Key".to_string());
    }

    {
        let mut history = state.history.lock().unwrap();
        history.push(ChatMessage {
            role: "user".to_string(),
            content: message,
        });
    }

    let messages: Vec<serde_json::Value> = {
        let history = state.history.lock().unwrap();
        history
            .iter()
            .map(|m| {
                serde_json::json!({
                    "role": m.role,
                    "content": m.content
                })
            })
            .collect()
    };

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true
    });

    let response = client
        .post(&api_url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, text));
    }

    let mut full_response = String::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("流读取错误: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            let line = line.trim();
            if !line.starts_with("data: ") || line == "data: [DONE]" {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line[6..]) {
                if let Some(delta) = json["choices"][0]["delta"]["content"].as_str() {
                    full_response.push_str(delta);
                    let _ = app.emit("ai-chunk", delta);
                }
            }
        }
    }

    {
        let mut history = state.history.lock().unwrap();
        history.push(ChatMessage {
            role: "assistant".to_string(),
            content: full_response.clone(),
        });
    }

    let _ = app.emit("ai-done", ());
    Ok(full_response)
}
