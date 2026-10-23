// Planner data: small JSON files in one folder (format: docs/data-format.md).
// This module owns the folder: it reads and writes the files for the webview and watches
// the folder, so edits from outside (a sync tool, an AI agent) reach the open app live.
// The webview only names files relative to the folder, and only valid data files.
use std::collections::HashMap;
use std::fs::{self, File};
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_full::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

use crate::{config_get, config_remove, config_set};

const ROOT_FILES: [&str; 3] = ["hapta.json", "lists.json", "recurring.json"];
// Single file written by an earlier version; returned by read_data_files so the app can migrate it
const LEGACY_FILE: &str = "hapta-data.json";

#[derive(Default)]
pub struct DataState {
    // Hash of each file as this app last read or wrote it, to tell outside edits from our own
    known: Mutex<HashMap<String, u64>>,
    watcher: Mutex<Option<Debouncer<RecommendedWatcher, RecommendedCache>>>,
}

#[derive(Deserialize)]
pub struct FolderLabels {
    question: String,
    load: String,
    cancel: String,
}

fn hash(contents: &str) -> u64 {
    let mut h = DefaultHasher::new();
    contents.hash(&mut h);
    h.finish()
}

// One of ROOT_FILES or "days/YYYY-MM-DD.json"
fn is_data_file(rel: &str) -> bool {
    if ROOT_FILES.contains(&rel) {
        return true;
    }
    let Some(day) = rel.strip_prefix("days/").and_then(|n| n.strip_suffix(".json")) else {
        return false;
    };
    day.len() == 10
        && day.bytes().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == b'-' } else { c.is_ascii_digit() })
}

fn default_folder(app: &AppHandle) -> PathBuf {
    app.path().app_data_dir().expect("no app data directory").join("data")
}

pub(crate) fn folder(app: &AppHandle) -> PathBuf {
    config_get(app, "dataFolder")
        .and_then(|v| v.as_str().map(PathBuf::from))
        .unwrap_or_else(|| default_folder(app))
}

fn data_files(dir: &Path) -> Vec<String> {
    let mut files: Vec<String> = ROOT_FILES.iter().filter(|f| dir.join(f).is_file()).map(|f| f.to_string()).collect();
    for entry in fs::read_dir(dir.join("days")).into_iter().flatten().flatten() {
        let rel = format!("days/{}", entry.file_name().to_string_lossy());
        if is_data_file(&rel) {
            files.push(rel);
        }
    }
    files
}

fn relative(dir: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(dir).ok()?.to_str()?.replace('\\', "/");
    is_data_file(&rel).then_some(rel)
}

// Temp file + fsync + rename: a crash or a sync tool never sees a half-written file
fn write_atomic(path: &Path, contents: &str) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("json.tmp");
    let mut file = File::create(&tmp)?;
    file.write_all(contents.as_bytes())?;
    file.sync_all()?;
    fs::rename(&tmp, path)
}

fn remove_if_exists(path: &Path) -> std::io::Result<()> {
    match fs::remove_file(path) {
        Err(e) if e.kind() != ErrorKind::NotFound => Err(e),
        _ => Ok(()),
    }
}

// Makes `to` hold exactly the data files of `from`
fn replace_data(from: &Path, to: &Path) -> std::io::Result<()> {
    let keep = data_files(from);
    for rel in data_files(to) {
        if !keep.contains(&rel) {
            remove_if_exists(&to.join(rel))?;
        }
    }
    for rel in keep {
        write_atomic(&to.join(&rel), &fs::read_to_string(from.join(&rel))?)?;
    }
    Ok(())
}

// (Re)starts watching the current folder; the previous watcher stops when replaced
pub fn watch(app: &AppHandle) {
    let dir = folder(app);
    let _ = fs::create_dir_all(dir.join("days"));
    let handle = app.clone();
    let root = dir.clone();
    let debouncer = new_debouncer(Duration::from_millis(200), None, move |result: DebounceEventResult| {
        let Ok(events) = result else { return };
        let mut paths: Vec<String> =
            events.iter().flat_map(|e| e.paths.iter()).filter_map(|p| relative(&root, p)).collect();
        paths.sort();
        paths.dedup();
        let state = handle.state::<DataState>();
        for rel in paths {
            let contents = fs::read_to_string(root.join(&rel)).ok();
            let changed = {
                let mut known = state.known.lock().unwrap();
                match &contents {
                    Some(c) => known.insert(rel.clone(), hash(c)) != Some(hash(c)),
                    None => known.remove(&rel).is_some(),
                }
            };
            if changed {
                let _ = handle.emit("data-changed", json!({ "path": rel, "contents": contents }));
            }
        }
    });
    let state = app.state::<DataState>();
    let mut watcher = state.watcher.lock().unwrap();
    *watcher = None;
    match debouncer {
        Ok(mut d) => match d.watch(&dir, RecursiveMode::Recursive) {
            Ok(()) => *watcher = Some(d),
            Err(e) => eprintln!("Not watching {}: {e}", dir.display()),
        },
        Err(e) => eprintln!("Not watching {}: {e}", dir.display()),
    }
}

fn switch_folder(app: &AppHandle, dir: Option<&Path>) {
    match dir {
        Some(dir) => config_set(app, "dataFolder", json!(dir.to_string_lossy())),
        None => config_remove(app, "dataFolder"),
    }
    watch(app);
}

// { path, custom }: custom is false for the app's own folder
#[tauri::command]
pub fn data_folder(app: AppHandle) -> serde_json::Value {
    let path = folder(&app);
    json!({ "path": path.to_string_lossy(), "custom": path != default_folder(&app) })
}

// Every data file, by relative path
#[tauri::command]
pub fn read_data_files(app: AppHandle, state: State<DataState>) -> Result<HashMap<String, String>, String> {
    let dir = folder(&app);
    fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    let mut files = HashMap::new();
    let mut known = state.known.lock().unwrap();
    known.clear();
    for rel in data_files(&dir) {
        let contents = fs::read_to_string(dir.join(&rel)).map_err(|e| format!("{rel}: {e}"))?;
        known.insert(rel.clone(), hash(&contents));
        files.insert(rel, contents);
    }
    if let Ok(contents) = fs::read_to_string(dir.join(LEGACY_FILE)) {
        files.insert(LEGACY_FILE.into(), contents);
    }
    Ok(files)
}

#[tauri::command]
pub fn write_data_file(app: AppHandle, state: State<DataState>, path: String, contents: String) -> Result<(), String> {
    if !is_data_file(&path) {
        return Err(format!("not a data file: {path}"));
    }
    // Recorded first, so the watcher sees this write as ours
    state.known.lock().unwrap().insert(path.clone(), hash(&contents));
    write_atomic(&folder(&app).join(&path), &contents).map_err(|e| {
        state.known.lock().unwrap().remove(&path);
        format!("{path}: {e}")
    })
}

#[tauri::command]
pub fn delete_data_file(app: AppHandle, state: State<DataState>, path: String) -> Result<(), String> {
    if !is_data_file(&path) {
        return Err(format!("not a data file: {path}"));
    }
    state.known.lock().unwrap().remove(&path);
    remove_if_exists(&folder(&app).join(&path)).map_err(|e| format!("{path}: {e}"))
}

// Picks a new folder. One that already has Hapta data is loaded (after asking);
// an empty one gets a copy of the current data. Returns the new path, None if nothing changed.
// async = off the main thread, which the blocking dialogs require.
#[tauri::command]
pub async fn choose_data_folder(app: AppHandle, labels: FolderLabels) -> Result<Option<String>, String> {
    let Some(dir) = app.dialog().file().blocking_pick_folder().and_then(|p| p.into_path().ok()) else {
        return Ok(None);
    };
    let current = folder(&app);
    if dir == current {
        return Ok(None);
    }
    let has_data = !data_files(&dir).is_empty() || dir.join(LEGACY_FILE).is_file();
    if has_data {
        let load = app
            .dialog()
            .message(labels.question)
            .title("Hapta")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom(labels.load, labels.cancel))
            .blocking_show();
        if !load {
            return Ok(None);
        }
    } else {
        replace_data(&current, &dir).map_err(|e| e.to_string())?;
    }
    switch_folder(&app, Some(&dir));
    Ok(Some(dir.to_string_lossy().into_owned()))
}

// Moves the current data back into the app's own folder; the chosen folder keeps its files
#[tauri::command]
pub fn reset_data_folder(app: AppHandle) -> Result<String, String> {
    let (current, default) = (folder(&app), default_folder(&app));
    if current != default {
        replace_data(&current, &default).map_err(|e| e.to_string())?;
        switch_folder(&app, None);
    }
    Ok(default.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_file_names() {
        for ok in ["hapta.json", "lists.json", "recurring.json", "days/2026-10-23.json"] {
            assert!(is_data_file(ok), "{ok}");
        }
        for bad in [
            "../x.json",
            "/etc/passwd",
            "days/2026-10-23.json.tmp",
            "days/../lists.json",
            "days/2026_10_23.json",
            "days/x/2026-10-23.json",
            "hapta-data.json",
            "config.json",
        ] {
            assert!(!is_data_file(bad), "{bad}");
        }
    }
}
