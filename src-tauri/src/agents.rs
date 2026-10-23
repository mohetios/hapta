// Runs a local AI agent CLI (Claude Code or Codex) in the data folder, so it reads and edits
// the planner files directly (docs/data-format.md). data.rs watches the folder, so the
// agent's edits show up in the open app as it makes them.
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct AgentState {
    running: Mutex<Option<Arc<Mutex<Child>>>>,
}

#[derive(Serialize)]
pub struct Model {
    id: String,
    label: String,
}

#[derive(Serialize)]
pub struct Agent {
    id: &'static str,
    name: &'static str,
    version: String,
    models: Vec<Model>,
}

#[derive(Deserialize)]
pub struct AgentRequest {
    agent: String,
    model: Option<String>,
    effort: Option<String>,
    // Hapta's instructions and the current planner context
    system: String,
    prompt: String,
}

// Install locations a GUI app may not have on its PATH
fn search_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = env::var_os("PATH").map(|p| env::split_paths(&p).collect()).unwrap_or_default();
    if let Some(home) = env::var_os("HOME").or_else(|| env::var_os("USERPROFILE")).map(PathBuf::from) {
        for dir in [".local/bin", ".claude/local", ".npm-global/bin", ".bun/bin", ".volta/bin", ".local/share/pnpm", "bin"] {
            dirs.push(home.join(dir));
        }
        if let Some(appdata) = env::var_os("APPDATA") {
            dirs.push(PathBuf::from(appdata).join("npm"));
        }
    }
    dirs.extend(["/usr/local/bin", "/opt/homebrew/bin", "/usr/bin"].map(PathBuf::from));
    dirs
}

fn find(name: &str) -> Option<PathBuf> {
    let names: Vec<String> =
        if cfg!(windows) { vec![format!("{name}.exe"), format!("{name}.cmd")] } else { vec![name.into()] };
    search_dirs().into_iter().flat_map(|d| names.iter().map(move |n| d.join(n))).find(|p| p.is_file())
}

// The CLI's own directory first: npm installs need the node next to them
fn command(bin: &PathBuf) -> Command {
    let mut path: Vec<PathBuf> = bin.parent().map(|p| vec![p.to_path_buf()]).unwrap_or_default();
    path.extend(search_dirs());
    let mut cmd = Command::new(bin);
    if let Ok(joined) = env::join_paths(path) {
        cmd.env("PATH", joined);
    }
    cmd
}

fn output(bin: &PathBuf, args: &[&str]) -> Option<String> {
    let out = command(bin).args(args).stdin(Stdio::null()).output().ok()?;
    out.status.success().then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

fn model(id: &str, label: &str) -> Model {
    Model { id: id.into(), label: label.into() }
}

fn codex_models(bin: &PathBuf) -> Vec<Model> {
    let Some(json) = output(bin, &["debug", "models"]).and_then(|s| serde_json::from_str::<Value>(&s).ok()) else {
        return vec![];
    };
    json["models"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|m| m["visibility"] == "list")
        .filter_map(|m| Some(model(m["slug"].as_str()?, m["display_name"].as_str().unwrap_or(m["slug"].as_str()?))))
        .collect()
}

fn detect(id: &'static str) -> Option<Agent> {
    let bin = find(id)?;
    let version = output(&bin, &["--version"]).unwrap_or_default().lines().next().unwrap_or("").trim().to_string();
    Some(match id {
        "claude" => Agent {
            id,
            name: "Claude",
            version,
            // Aliases that always point at the latest model of each family
            models: vec![model("opus", "Opus"), model("sonnet", "Sonnet"), model("haiku", "Haiku"), model("fable", "Fable")],
        },
        _ => Agent { id, name: "Codex", version, models: codex_models(&bin) },
    })
}

// The installed agents, with the models each offers
#[tauri::command]
pub async fn detect_agents() -> Vec<Agent> {
    tauri::async_runtime::spawn_blocking(|| ["claude", "codex"].into_iter().filter_map(detect).collect())
        .await
        .unwrap_or_default()
}

// Edits are allowed only inside the data folder: Claude gets file tools and no shell,
// Codex runs in its workspace-write sandbox.
fn agent_command(req: &AgentRequest, dir: &PathBuf, last_message: &PathBuf) -> Result<(Command, String), String> {
    let bin = find(&req.agent).ok_or(format!("{} is not installed", req.agent))?;
    let mut cmd = command(&bin);
    cmd.current_dir(dir);
    let stdin = match req.agent.as_str() {
        "claude" => {
            cmd.args(["-p", "--output-format", "text", "--no-session-persistence"])
                .args(["--permission-mode", "acceptEdits"])
                .args(["--allowedTools", "Read,Edit,Write,Glob,Grep"])
                .args(["--disallowedTools", "Bash,WebFetch,WebSearch"])
                .arg("--append-system-prompt")
                .arg(&req.system);
            if let Some(m) = &req.model {
                cmd.args(["--model", m]);
            }
            if let Some(e) = &req.effort {
                cmd.args(["--effort", e]);
            }
            req.prompt.clone()
        }
        "codex" => {
            cmd.args(["exec", "--skip-git-repo-check", "--ephemeral", "--color", "never"])
                .args(["--sandbox", "workspace-write"])
                .arg("-C")
                .arg(dir)
                .arg("-o")
                .arg(last_message);
            if let Some(m) = &req.model {
                cmd.args(["-m", m]);
            }
            if let Some(e) = &req.effort {
                cmd.args(["-c", &format!("model_reasoning_effort=\"{e}\"")]);
            }
            cmd.arg("-");
            // Codex has no separate system prompt flag
            format!("{}\n\n# The user's request\n\n{}", req.system, req.prompt)
        }
        other => return Err(format!("unknown agent: {other}")),
    };
    Ok((cmd, stdin))
}

fn run(app: AppHandle, child: Arc<Mutex<Child>>) -> (bool, String, String) {
    let (stdout, stderr) = {
        let mut c = child.lock().unwrap();
        (c.stdout.take(), c.stderr.take())
    };
    // Every line goes to the modal as progress; stdout is also the answer
    let pipe = |reader: Option<Box<dyn std::io::Read + Send>>, app: AppHandle| {
        thread::spawn(move || {
            let mut all = String::new();
            for line in reader.into_iter().flat_map(|r| BufReader::new(r).lines().map_while(Result::ok)) {
                let _ = app.emit("agent-output", &line);
                all.push_str(&line);
                all.push('\n');
            }
            all
        })
    };
    let out = pipe(stdout.map(|s| Box::new(s) as _), app.clone());
    let err = pipe(stderr.map(|s| Box::new(s) as _), app);
    // Polled, so cancel_agent can take the lock and kill it meanwhile
    let success = loop {
        if let Ok(Some(status)) = child.lock().unwrap().try_wait() {
            break status.success();
        }
        thread::sleep(Duration::from_millis(100));
    };
    (success, out.join().unwrap_or_default(), err.join().unwrap_or_default())
}

// Resolves to the agent's final answer
#[tauri::command]
pub async fn run_agent(app: AppHandle, state: State<'_, AgentState>, request: AgentRequest) -> Result<String, String> {
    let dir = crate::data::folder(&app);
    let last_message = env::temp_dir().join(format!("hapta-agent-{}.txt", std::process::id()));
    let _ = fs::remove_file(&last_message);
    let (mut cmd, input) = agent_command(&request, &dir, &last_message)?;
    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("{}: {e}", request.agent))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input.as_bytes()).map_err(|e| e.to_string())?;
    }
    let child = Arc::new(Mutex::new(child));
    {
        let mut running = state.running.lock().unwrap();
        if running.is_some() {
            let _ = child.lock().unwrap().kill();
            return Err("another request is still running".into());
        }
        *running = Some(child.clone());
    }
    let (success, stdout, stderr) =
        tauri::async_runtime::spawn_blocking(move || run(app, child)).await.map_err(|e| e.to_string())?;
    *state.running.lock().unwrap() = None;
    let answer = fs::read_to_string(&last_message).unwrap_or(stdout);
    let _ = fs::remove_file(&last_message);
    if success {
        Ok(answer.trim().to_string())
    } else {
        let tail: Vec<&str> = stderr.lines().rev().take(15).collect();
        Err(tail.into_iter().rev().collect::<Vec<_>>().join("\n"))
    }
}

#[tauri::command]
pub fn cancel_agent(state: State<'_, AgentState>) {
    if let Some(child) = state.running.lock().unwrap().as_ref() {
        let _ = child.lock().unwrap().kill();
    }
}
