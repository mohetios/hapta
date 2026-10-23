// Replaces the old Electron background.js: tray, close-to-tray, single instance and
// the small set of commands the Vue app calls through src/helpers/desktop.js.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_store::StoreExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const TRAY_ICON: &[u8] = include_bytes!("../icons/tray.png");
const TRAY_ICON_DARK: &[u8] = include_bytes!("../icons/tray-dark.png");
// Task data mirrored into the folder chosen in Settings > Data (see src/helpers/dataFolder.js)
const DATA_FILE: &str = "hapta-data.json";
const HIDE_SPLASH_JS: &str = "if(document.getElementById('splashScreen')) document.getElementById('splashScreen').classList.add('hiddenSplashScreen');";

// Visibility is decided by runInBackground, so the window state plugin must not touch it.
fn window_state_flags() -> StateFlags {
    StateFlags::all() & !StateFlags::VISIBLE
}

static INITIAL_CHECKS_SENT: AtomicBool = AtomicBool::new(false);

fn config_get(app: &AppHandle, key: &str) -> Option<Value> {
    app.store("config.json").ok()?.get(key)
}

fn config_set(app: &AppHandle, key: &str, value: Value) {
    if let Ok(store) = app.store("config.json") {
        store.set(key, value);
        let _ = store.save();
    }
}

fn config_remove(app: &AppHandle, key: &str) {
    if let Ok(store) = app.store("config.json") {
        store.delete(key);
        let _ = store.save();
    }
}

fn config_bool(app: &AppHandle, key: &str) -> bool {
    config_get(app, key).and_then(|v| v.as_bool()).unwrap_or(false)
}

fn config_str(app: &AppHandle, key: &str, default: &str) -> String {
    config_get(app, key)
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| default.into())
}

fn data_folder(app: &AppHandle) -> Option<PathBuf> {
    config_get(app, "dataFolder")?.as_str().map(PathBuf::from)
}

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn show_window(app: &AppHandle) {
    let Some(window) = main_window(app) else { return };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    if !INITIAL_CHECKS_SENT.swap(true, Ordering::SeqCst) {
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(4000));
            let _ = window.emit("initial-checks", ());
        });
    }
}

fn hide_splash_screen_later(app: &AppHandle, millis: u64) {
    let Some(window) = main_window(app) else { return };
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(millis));
        let _ = window.eval(HIDE_SPLASH_JS);
    });
}

fn quit(app: &AppHandle) {
    let _ = app.save_window_state(window_state_flags());
    app.exit(0);
}

fn tray_icon(app: &AppHandle) -> Image<'static> {
    let bytes = if config_bool(app, "darkTrayIcon") { TRAY_ICON_DARK } else { TRAY_ICON };
    Image::from_bytes(bytes).expect("bundled tray icon is a valid PNG")
}

fn tray_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let open = MenuItem::with_id(app, "open", config_str(app, "openLabel", "Open"), true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", config_str(app, "quitLabel", "Quit"), true, None::<&str>)?;
    Menu::with_items(app, &[&open, &quit])
}

fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    TrayIconBuilder::with_id("main")
        .icon(tray_icon(app))
        .tooltip("Hapta")
        .menu(&tray_menu(app)?)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                show_window(app);
                hide_splash_screen_later(app, 5000);
            }
            "quit" => quit(app),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

fn create_window(app: &AppHandle) -> tauri::Result<()> {
    // Like Electron: a missing setting means first run, so show the window.
    let visible = !config_bool(app, "runInBackground");
    if config_get(app, "runInBackground").is_none() {
        config_set(app, "runInBackground", json!(true));
    }

    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("Hapta")
        .inner_size(1000.0, 600.0)
        .min_inner_size(1000.0, 600.0)
        .visible(visible)
        .build()?;

    let handle = app.clone();
    let win = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            if config_bool(&handle, "runInBackground") {
                let _ = handle.save_window_state(window_state_flags());
                let _ = win.hide();
            } else {
                quit(&handle);
            }
        }
    });
    Ok(())
}

#[derive(Deserialize)]
struct TrayLabels {
    open: String,
    quit: String,
}

#[derive(Deserialize)]
struct DataFolderLabels {
    question: String,
    load: String,
    cancel: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ChosenDataFolder {
    path: String,
    has_data: bool,
}

#[tauri::command]
fn show_current_window(app: AppHandle) {
    show_window(&app);
}

#[tauri::command]
fn is_window_visible(window: WebviewWindow) -> bool {
    window.is_visible().unwrap_or(false)
}

#[tauri::command]
fn set_run_in_background(app: AppHandle, run_in_background: bool) {
    config_set(&app, "runInBackground", json!(run_in_background));
}

#[tauri::command]
fn clear_config(app: AppHandle) {
    config_set(&app, "runInBackground", json!(true));
    config_remove(&app, "dataFolder");
}

#[tauri::command]
fn get_data_folder(app: AppHandle) -> Option<String> {
    data_folder(&app).map(|p| p.to_string_lossy().into_owned())
}

// The path never comes from the webview: it is picked here and stored on the Rust side.
// async = runs off the main thread, which the blocking dialogs require.
#[tauri::command]
async fn choose_data_folder(app: AppHandle, labels: DataFolderLabels) -> Option<ChosenDataFolder> {
    let dir = app.dialog().file().blocking_pick_folder()?.into_path().ok()?;
    let has_data = dir.join(DATA_FILE).exists();
    if has_data
        && !app
            .dialog()
            .message(labels.question)
            .title("Hapta")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom(labels.load, labels.cancel))
            .blocking_show()
    {
        return None;
    }
    let path = dir.to_string_lossy().into_owned();
    config_set(&app, "dataFolder", json!(path));
    Some(ChosenDataFolder { path, has_data })
}

#[tauri::command]
fn reset_data_folder(app: AppHandle) {
    config_remove(&app, "dataFolder");
}

// None when no folder is set or the folder has no data file yet.
#[tauri::command]
fn read_data_file(app: AppHandle) -> Result<Option<String>, String> {
    let Some(dir) = data_folder(&app) else { return Ok(None) };
    match fs::read_to_string(dir.join(DATA_FILE)) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// Write to a temp file and rename, so a crash never leaves a half-written data file.
#[tauri::command]
fn write_data_file(app: AppHandle, contents: String) -> Result<(), String> {
    let dir = data_folder(&app).ok_or("no data folder set")?;
    let tmp = dir.join(format!("{DATA_FILE}.tmp"));
    fs::write(&tmp, contents).map_err(|e| e.to_string())?;
    fs::rename(&tmp, dir.join(DATA_FILE)).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_dark_tray_icon(app: AppHandle, dark_tray_icon: bool) {
    config_set(&app, "darkTrayIcon", json!(dark_tray_icon));
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_icon(Some(tray_icon(&app)));
    }
}

#[tauri::command]
fn set_tray_context_menu_label(app: AppHandle, labels: TrayLabels) {
    config_set(&app, "openLabel", json!(labels.open));
    config_set(&app, "quitLabel", json!(labels.quit));
    if let (Some(tray), Ok(menu)) = (app.tray_by_id("main"), tray_menu(&app)) {
        let _ = tray.set_menu(Some(menu));
    }
}

fn main() {
    tauri::Builder::default()
        // Must be registered first so a second launch only focuses the running app.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
            hide_splash_screen_later(app, 5000);
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(window_state_flags())
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            show_current_window,
            is_window_visible,
            set_run_in_background,
            clear_config,
            get_data_folder,
            choose_data_folder,
            reset_data_folder,
            read_data_file,
            write_data_file,
            set_dark_tray_icon,
            set_tray_context_menu_label
        ])
        .setup(|app| {
            create_tray(app.handle())?;
            create_window(app.handle())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Hapta");
}
