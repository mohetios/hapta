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
  onInitialChecks(callback) {
    return tauri().event.listen("initial-checks", callback);
  },
  openExternal(url) {
    if (tauri()) return tauri().opener.openUrl(url);
    window.open(url, "_blank");
  },
};
