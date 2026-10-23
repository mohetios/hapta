// Keeps the task data in a folder the user picks in Settings > Data (desktop only).
// IndexedDB stays the working copy; the folder's hapta-data.json is the source of truth:
// it is loaded into IndexedDB on startup and rewritten shortly after every change.
// Config stays in localStorage, per device.
import { reactive } from "vue";
import desktop from "./desktop";
import dbRepository, { done, committed } from "../repositories/dbRepository";
import storageRepository from "../repositories/storageRepository";

// File key -> IndexedDB table, same keys as the .wtdb export
const TABLES = {
  todoLists: "todo_lists",
  repeating_events: "repeating_events",
  repeating_events_by_date: "repeating_events_by_date",
};
// ponytail: changes made in the last SAVE_DELAY before quitting from the tray are lost
const SAVE_DELAY = 500;

export const dataFolderState = reactive({ path: null, error: null });
let syncing = false;
let timer = null;
let saving = Promise.resolve();

const isData = (data) => data && typeof data === "object" && data.todoLists && typeof data.todoLists === "object";

async function snapshot() {
  const db = await done(dbRepository.open());
  const tx = db.transaction(Object.values(TABLES));
  const rows = await Promise.all(
    Object.entries(TABLES).map(([key, table]) =>
      Promise.all([key, done(tx.objectStore(table).getAllKeys()), done(tx.objectStore(table).getAll())])
    )
  );
  db.close();
  const data = { version: 1, customTodoListIds: storageRepository.get("customTodoListIds") ?? [] };
  for (const [key, keys, values] of rows) data[key] = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
  return data;
}

// Writes straight to the stores (not through dbRepository) so it doesn't schedule a save
async function restore(data) {
  const db = await done(dbRepository.open());
  const tx = db.transaction(Object.values(TABLES), "readwrite");
  for (const [key, table] of Object.entries(TABLES)) {
    const store = tx.objectStore(table);
    store.clear();
    for (const [id, value] of Object.entries(data[key] ?? {})) store.put(value, id);
  }
  await committed(tx);
  db.close();
  storageRepository.set("customTodoListIds", data.customTodoListIds ?? []);
}

function fail(error) {
  console.error("Data folder:", error);
  dataFolderState.error = String(error);
}

// Chained so an older snapshot never lands after a newer one
function save() {
  clearTimeout(timer);
  timer = null;
  saving = saving.then(async () => {
    try {
      await desktop.writeDataFile(JSON.stringify(await snapshot(), null, 2));
      dataFolderState.error = null;
    } catch (e) {
      fail(e);
    }
  });
  return saving;
}

function stop() {
  syncing = false;
  clearTimeout(timer);
  timer = null;
}

export default {
  // Before the app mounts, so the stores load the folder's data
  async init() {
    if (!desktop.isDesktop()) return;
    try {
      dataFolderState.path = await desktop.getDataFolder();
      if (!dataFolderState.path) return;
      const text = await desktop.readDataFile();
      if (text !== null) {
        const data = JSON.parse(text);
        if (!isData(data)) throw new Error("hapta-data.json is not Hapta data");
        await restore(data);
      }
      syncing = true;
      // New folder (no file yet): seed it with the current data
      if (text === null) await save();
    } catch (e) {
      // Stay off: never overwrite a folder file that couldn't be read
      fail(e);
    }
  },
  scheduleSave() {
    if (!syncing) return;
    clearTimeout(timer);
    timer = setTimeout(save, SAVE_DELAY);
  },
  // Write pending changes now, e.g. before a reload
  flush() {
    return timer ? save() : saving;
  },
  stop,
  async choose(labels) {
    await this.flush();
    const wasSyncing = syncing;
    // A pending save must not write this device's data over the new folder's file
    stop();
    const chosen = await desktop.chooseDataFolder(labels);
    if (!chosen) {
      syncing = wasSyncing;
      this.scheduleSave(); // catch up on changes made while the dialog was open
      return;
    }
    dataFolderState.path = chosen.path;
    dataFolderState.error = null;
    // init() loads the folder's data on startup
    if (chosen.hasData) return location.reload();
    syncing = true;
    await save();
  },
  // Back to app storage only; the current data and the folder's file are both kept
  async reset() {
    await this.flush();
    stop();
    await desktop.resetDataFolder();
    dataFolderState.path = null;
    dataFolderState.error = null;
  },
};
