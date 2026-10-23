// Maps the planner data to files in the data folder (format: docs/data-format.md):
//   hapta.json                 { "format": 1 }
//   days/2026-10-23.json       { "date": "2026-10-23", "tasks": [...] }  (only days that have tasks)
//   lists.json                 { "lists": [{ "id", "name", "tasks": [...] }] }  (custom lists, in order)
//   recurring.json             { "events": { id: event }, "generated": { "2026-10-23": [id] } }
import dataStore from "./dataStore";
import storageRepository from "./storageRepository";

export const FORMAT = 1;
export const MARKER = "hapta.json";
export const LISTS = "lists.json";
export const RECURRING = "recurring.json";

// "20261023" <-> "2026-10-23"
export const isoDay = (id) => `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`;
export const dayId = (iso) => iso.replaceAll("-", "");
export const dayPath = (id) => `days/${isoDay(id)}.json`;
export const dayFromPath = (path) => /^days\/(\d{4}-\d{2}-\d{2})\.json$/.exec(path)?.[1].replaceAll("-", "");

export const readLists = () => dataStore.read(LISTS)?.lists ?? [];
export const readRecurring = () => ({ events: {}, generated: {}, ...dataStore.read(RECURRING) });

// Files for the .wtdb backup shape: { customTodoListIds, todoLists, repeating_events, repeating_events_by_date }.
// customTodoListIds is a JSON string in .wtdb files and an array in the old hapta-data.json.
export function filesFromBackup(data) {
  let ids = data.customTodoListIds ?? [];
  if (typeof ids === "string") ids = JSON.parse(ids);
  const todoLists = data.todoLists ?? {};
  const out = {
    [MARKER]: { format: FORMAT },
    [LISTS]: { lists: ids.map(({ listId, listName }) => ({ id: listId, name: listName, tasks: todoLists[listId] ?? [] })) },
    [RECURRING]: {
      events: data.repeating_events ?? {},
      generated: Object.fromEntries(
        Object.entries(data.repeating_events_by_date ?? {}).map(([id, done]) => [isoDay(id), Object.keys(done ?? {})])
      ),
    },
  };
  for (const [id, tasks] of Object.entries(todoLists)) {
    if (/^\d{8}$/.test(id) && tasks?.length) out[dayPath(id)] = { date: isoDay(id), tasks };
  }
  return out;
}

export function backupFromFiles() {
  const lists = readLists();
  const { events, generated } = readRecurring();
  const todoLists = Object.fromEntries(lists.map((l) => [l.id, l.tasks]));
  for (const path of dataStore.paths()) {
    const id = dayFromPath(path);
    if (id) todoLists[id] = dataStore.read(path).tasks;
  }
  return {
    customTodoListIds: lists.map((l) => ({ listId: l.id, listName: l.name })),
    todoLists,
    repeating_events: events,
    repeating_events_by_date: Object.fromEntries(
      Object.entries(generated).map(([iso, ids]) => [dayId(iso), Object.fromEntries(ids.map((id) => [id, true]))])
    ),
  };
}

// --- One-time migration from earlier versions (IndexedDB, or the single hapta-data.json) ---

const idbDone = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function readIndexedDb(name) {
  if (!globalThis.indexedDB?.databases) return null;
  if (!(await indexedDB.databases()).some((d) => d.name === name)) return null;
  const db = await idbDone(indexedDB.open(name));
  const tables = ["todo_lists", "repeating_events", "repeating_events_by_date"].filter((t) => db.objectStoreNames.contains(t));
  const data = {};
  if (tables.length) {
    const tx = db.transaction(tables);
    for (const table of tables) {
      const store = tx.objectStore(table);
      const [keys, values] = await Promise.all([idbDone(store.getAllKeys()), idbDone(store.getAll())]);
      data[table] = Object.fromEntries(keys.map((k, i) => [k, values[i]]));
    }
  }
  db.close();
  return data.todo_lists && Object.keys(data.todo_lists).length ? data : null;
}

// Old data is left where it was (IndexedDB "hapta"/"weekToDo", hapta-data.json) as a backup
export async function migrateIfNeeded() {
  if (dataStore.has(MARKER)) return;
  // Files in the current format without a marker (e.g. written by hand): keep them
  if (dataStore.paths().length) return dataStore.replaceAll({ ...currentFiles(), [MARKER]: { format: FORMAT } });
  let data = null;
  if (dataStore.legacy?.todoLists) {
    data = dataStore.legacy;
  } else {
    const idb = (await readIndexedDb("hapta")) ?? (await readIndexedDb("weekToDo"));
    if (idb) {
      data = {
        customTodoListIds: storageRepository.get("customTodoListIds") ?? [],
        todoLists: idb.todo_lists,
        repeating_events: idb.repeating_events,
        repeating_events_by_date: idb.repeating_events_by_date,
      };
    }
  }
  await dataStore.replaceAll(filesFromBackup(data ?? {}));
}

const currentFiles = () => Object.fromEntries(dataStore.paths().map((p) => [p, dataStore.read(p)]));
