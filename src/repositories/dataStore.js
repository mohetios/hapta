// The planner data: small JSON files in one folder (format: docs/data-format.md).
// All files are read once at startup and kept in memory, so reads are instant and synchronous.
// Writes go straight to that file only (coalesced per file, written in order).
// On desktop the folder is owned by src-tauri/src/data.rs, which also reports files changed
// from outside (sync tools, AI agents) so the open app updates live.
// The web build keeps the same files in localStorage.
import desktop from "../helpers/desktop";
import { reactive } from "vue";

const WEB_PREFIX = "hapta-data:";
// Single file written by an earlier version; kept aside for the one-time migration
const LEGACY_FILE = "hapta-data.json";

const desktopDriver = {
  readAll: () => desktop.readDataFiles(),
  write: (path, contents) => desktop.writeDataFile(path, contents),
  remove: (path) => desktop.deleteDataFile(path),
  onChange: (callback) => desktop.onDataChanged(callback),
};

const webDriver = {
  async readAll() {
    const files = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(WEB_PREFIX)) files[key.slice(WEB_PREFIX.length)] = localStorage.getItem(key);
    }
    return files;
  },
  write: async (path, contents) => localStorage.setItem(WEB_PREFIX + path, contents),
  remove: async (path) => localStorage.removeItem(WEB_PREFIX + path),
  onChange() {},
};

let driver = null;
const files = new Map(); // path -> parsed JSON
const pending = new Map(); // path -> JSON text, or null to delete
// Files that didn't parse: never written over, so nothing in them is lost; fixed from outside
const broken = new Set();
const listeners = [];
let flushing = null;

// Shown in Settings > Data
export const dataStoreState = reactive({ folder: null, customFolder: false, error: null });

const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
const text = (value) => JSON.stringify(value, null, 2) + "\n";

function fail(error) {
  console.error("Data:", error);
  dataStoreState.error = String(error);
}

// One write per file at a time; later changes to a file replace its queued one
function flush() {
  flushing ??= (async () => {
    while (pending.size) {
      const [path, contents] = pending.entries().next().value;
      pending.delete(path);
      try {
        await (contents === null ? driver.remove(path) : driver.write(path, contents));
        dataStoreState.error = null;
      } catch (e) {
        fail(e);
      }
    }
    flushing = null;
  })();
  return flushing;
}

function persist(path, contents) {
  if (broken.has(path)) return fail(`Not saved, ${path} is unreadable`);
  pending.set(path, contents);
  flush();
}

export default {
  legacy: null,
  // files: { path: text } as read from disk; returns the paths that couldn't be parsed
  load(raw) {
    files.clear();
    broken.clear();
    for (const [path, contents] of Object.entries(raw)) {
      try {
        files.set(path, JSON.parse(contents));
      } catch {
        broken.add(path);
      }
    }
    return [...broken];
  },
  // driver: for tests
  async init(d = desktop.isDesktop() ? desktopDriver : webDriver) {
    driver = d;
    if (desktop.isDesktop()) {
      const { path, custom } = await desktop.dataFolder();
      dataStoreState.folder = path;
      dataStoreState.customFolder = custom;
    }
    const { [LEGACY_FILE]: legacy, ...raw } = await driver.readAll();
    try {
      this.legacy = legacy ? JSON.parse(legacy) : null;
    } catch {
      this.legacy = null;
    }
    const unreadable = this.load(raw);
    if (unreadable.length) fail(`Unreadable: ${unreadable.join(", ")}`);
    await driver.onChange((path, contents) => {
      let value;
      try {
        value = contents === null ? undefined : JSON.parse(contents);
      } catch {
        broken.add(path);
        return fail(`Unreadable: ${path}`);
      }
      broken.delete(path);
      if (value === undefined) files.delete(path);
      else files.set(path, value);
      listeners.forEach((listener) => listener(path, clone(value)));
    });
  },
  has: (path) => files.has(path),
  paths: () => [...files.keys()],
  read: (path) => clone(files.get(path)),
  write(path, value) {
    files.set(path, clone(value));
    persist(path, text(value));
  },
  remove(path) {
    if (!files.has(path)) return;
    files.delete(path);
    persist(path, null);
  },
  // Replaces every data file, e.g. on import or clear
  replaceAll(newFiles) {
    for (const path of this.paths()) if (!(path in newFiles)) this.remove(path);
    for (const [path, value] of Object.entries(newFiles)) this.write(path, value);
    return flush();
  },
  // Called with (path, value or undefined) when a file changes outside the app
  onExternalChange(listener) {
    listeners.push(listener);
  },
  // Resolves when every change is on disk
  flush: () => flushing ?? Promise.resolve(),
  // Desktop only. The app reloads to read the new folder.
  async chooseFolder(labels) {
    await this.flush();
    try {
      if (await desktop.chooseDataFolder(labels)) location.reload();
    } catch (e) {
      fail(e);
    }
  },
  async resetFolder() {
    await this.flush();
    try {
      await desktop.resetDataFolder();
      location.reload();
    } catch (e) {
      fail(e);
    }
  },
};
