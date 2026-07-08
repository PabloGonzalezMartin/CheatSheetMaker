use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

const BACKEND_PORT: u16 = 8000;
const FRONTEND_PORT: u16 = 3001;

struct SidecarHandles {
    backend: Option<CommandChild>,
    frontend: Option<CommandChild>,
}

impl Drop for SidecarHandles {
    fn drop(&mut self) {
        if let Some(child) = self.backend.take() {
            let _ = child.kill();
        }
        if let Some(child) = self.frontend.take() {
            let _ = child.kill();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
            let db_path = data_dir.join("cheatsheetmaker.db");
            let db_path_str = db_path
                .to_string_lossy()
                .replace('\\', "/")
                .trim_start_matches("//?/")
                .to_string();
            let database_url = format!("sqlite:///{db_path_str}");

            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve resource dir");
            let frontend_dir = resource_dir.join("resources").join("frontend");
            let server_js_path = frontend_dir
                .join("server.js")
                .to_string_lossy()
                .replace('\\', "/")
                .trim_start_matches("//?/")
                .to_string();
            log::info!("resource_dir={resource_dir:?} frontend_dir={frontend_dir:?} server_js_path={server_js_path:?}");

            let secret_key = uuid_like_secret();

            let (mut backend_rx, backend_child) = app
                .shell()
                .sidecar("cheatsheetmaker-backend")
                .expect("failed to create backend sidecar command")
                .env("DATABASE_URL", &database_url)
                .env("SECRET_KEY", &secret_key)
                .args([BACKEND_PORT.to_string()])
                .spawn()
                .expect("failed to spawn backend sidecar");

            let (mut frontend_rx, frontend_child) = app
                .shell()
                .sidecar("node-server")
                .expect("failed to create frontend sidecar command")
                .current_dir(frontend_dir)
                .env("PORT", FRONTEND_PORT.to_string())
                .env("BACKEND_URL", format!("http://127.0.0.1:{BACKEND_PORT}"))
                .args([server_js_path])
                .spawn()
                .expect("failed to spawn frontend sidecar");

            tauri::async_runtime::spawn(async move {
                while let Some(event) = backend_rx.recv().await {
                    log_sidecar_event("backend", event);
                }
            });
            tauri::async_runtime::spawn(async move {
                while let Some(event) = frontend_rx.recv().await {
                    log_sidecar_event("frontend", event);
                }
            });

            app.manage(std::sync::Mutex::new(SidecarHandles {
                backend: Some(backend_child),
                frontend: Some(frontend_child),
            }));

            let window = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                wait_for_health(BACKEND_PORT).await;
                if let Some(win) = window.get_webview_window("main") {
                    let _ = win.eval(&format!(
                        "location.href = 'http://127.0.0.1:{FRONTEND_PORT}'"
                    ));
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(
                event,
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
            ) {
                if let Some(handles) = window
                    .app_handle()
                    .try_state::<std::sync::Mutex<SidecarHandles>>()
                {
                    let mut h = handles.lock().unwrap();
                    if let Some(child) = h.backend.take() {
                        let _ = child.kill();
                    }
                    if let Some(child) = h.frontend.take() {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn log_sidecar_event(name: &str, event: tauri_plugin_shell::process::CommandEvent) {
    match event {
        tauri_plugin_shell::process::CommandEvent::Stdout(line) => {
            log::info!("[{name}] {}", String::from_utf8_lossy(&line));
        }
        tauri_plugin_shell::process::CommandEvent::Stderr(line) => {
            log::warn!("[{name}] {}", String::from_utf8_lossy(&line));
        }
        tauri_plugin_shell::process::CommandEvent::Error(err) => {
            log::error!("[{name}] error: {err}");
        }
        tauri_plugin_shell::process::CommandEvent::Terminated(payload) => {
            log::info!("[{name}] terminated: {:?}", payload.code);
        }
        _ => {}
    }
}

async fn wait_for_health(port: u16) {
    let url = format!("http://127.0.0.1:{port}/health");
    for _ in 0..60 {
        if let Ok(resp) = reqwest::get(&url).await {
            if resp.status().is_success() {
                return;
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
}

fn uuid_like_secret() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{nanos:x}")
}
