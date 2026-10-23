// Bridge to the Tauri shell (src-tauri). Only openExternal works in the web build,
// guard everything else with isDesktop().
// Uses the API Tauri injects (app.withGlobalTauri) instead of bundling @tauri-apps/*.
const tauri = () => window.__TAURI__;

export default {
  isDesktop() {
    return !!tauri();
  },
  showCurrentWindow() {
    return tauri().core.invoke("show_current_window");
  },
  isWindowVisible() {
    return tauri().core.invoke("is_window_visible");
  },
  setOpenOnStartup(openOnStartup) {
    return openOnStartup ? tauri().autostart.enable() : tauri().autostart.disable();
  },
  matchOpenOnStartup(openOnStartup) {
    return tauri()
      .autostart.isEnabled()
      .then((enabled) => {
        if (enabled != openOnStartup) return this.setOpenOnStartup(openOnStartup);
      });
  },
  setRunInBackground(runInBackground) {
    return tauri().core.invoke("set_run_in_background", { runInBackground });
  },
  setTrayContextMenuLabel(labels) {
    return tauri().core.invoke("set_tray_context_menu_label", { labels });
  },
  setDarkTrayIcon(darkTrayIcon) {
    return tauri().core.invoke("set_dark_tray_icon", { darkTrayIcon });
  },
  clearConfig() {
    return tauri().core.invoke("clear_config");
  },
  // Planner data files, see src-tauri/src/data.rs
  dataFolder() {
    return tauri().core.invoke("data_folder");
  },
  readDataFiles() {
    return tauri().core.invoke("read_data_files");
  },
  writeDataFile(path, contents) {
    return tauri().core.invoke("write_data_file", { path, contents });
  },
  deleteDataFile(path) {
    return tauri().core.invoke("delete_data_file", { path });
  },
  onDataChanged(callback) {
    return tauri().event.listen("data-changed", (e) => callback(e.payload.path, e.payload.contents));
  },
  // Resolves to the new path, or null if nothing changed.
  // labels: { question, load, cancel } for the "folder already has data" prompt
  chooseDataFolder(labels) {
    return tauri().core.invoke("choose_data_folder", { labels });
  },
  resetDataFolder() {
    return tauri().core.invoke("reset_data_folder");
  },
  // AI agent CLIs, see src-tauri/src/agents.rs
  detectAgents() {
    return tauri().core.invoke("detect_agents");
  },
  // request: { agent, model, effort, system, prompt }; resolves to the agent's answer
  runAgent(request) {
    return tauri().core.invoke("run_agent", { request });
  },
  cancelAgent() {
    return tauri().core.invoke("cancel_agent");
  },
  onAgentOutput(callback) {
    return tauri().event.listen("agent-output", (e) => callback(e.payload));
  },
  onInitialChecks(callback) {
    return tauri().event.listen("initial-checks", callback);
  },
  openExternal(url) {
    if (tauri()) return tauri().opener.openUrl(url);
    window.open(url, "_blank");
  },
};
