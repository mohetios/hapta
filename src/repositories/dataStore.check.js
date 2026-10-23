// Self-check for the data folder storage (dataStore, plannerFiles, repositories) — run: pnpm check:data
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { createServer } from "vite";

const local = new Map();
globalThis.localStorage = {
  getItem: (k) => local.get(k) ?? null,
  setItem: (k, v) => local.set(k, String(v)),
  removeItem: (k) => local.delete(k),
  clear: () => local.clear(),
  key: (i) => [...local.keys()][i],
  get length() {
    return local.size;
  },
};
// Object.keys(localStorage) is used by the web driver
globalThis.localStorage = new Proxy(globalThis.localStorage, { ownKeys: () => [...local.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });

globalThis.window = {}; // web build: no Tauri

// The folder, as src-tauri/src/data.rs would hold it
const disk = {};
let external = null;
const writes = [];
const driver = {
  readAll: async () => ({ ...disk }),
  write: async (path, contents) => {
    await new Promise((r) => setTimeout(r, 1));
    writes.push(path);
    disk[path] = contents;
  },
  remove: async (path) => delete disk[path],
  onChange: (callback) => (external = callback),
};
const json = (path) => JSON.parse(disk[path]);

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error", ssr: { noExternal: ["rrule"] } });
const load = (m) => vite.ssrLoadModule(m);
try {
  const { default: dataStore, dataStoreState } = await load("/src/repositories/dataStore.js");
  const files = await load("/src/repositories/plannerFiles.js");
  const lists = (await load("/src/repositories/toDoListRepository.js")).default;
  const customLists = (await load("/src/repositories/customToDoListIdsRepository.js")).default;
  const events = (await load("/src/repositories/repeatingEventRepository.js")).default;
  const generated = (await load("/src/repositories/repeatingEventByDateRepository.js")).default;
  const { store } = await load("/src/store/store.js");
  const externalChanges = (await load("/src/helpers/externalChanges.js")).default;
  const { todayId, addDays } = await load("/src/helpers/dates.js");
  store.commit("loadConfig", { language: "en", calendarSystem: "gregory", weekStart: 1 });

  // What main.js does on startup
  async function start() {
    await dataStore.init(driver);
    await files.migrateIfNeeded();
    await dataStore.flush();
  }

  // Migration from IndexedDB ("weekToDo"), custom list names from localStorage
  const db = await new Promise((resolve) => {
    const req = indexedDB.open("weekToDo", 4);
    req.onupgradeneeded = () => ["todo_lists", "repeating_events", "repeating_events_by_date"].forEach((t) => req.result.createObjectStore(t));
    req.onsuccess = () => resolve(req.result);
  });
  const tx = db.transaction(["todo_lists", "repeating_events", "repeating_events_by_date"], "readwrite");
  tx.objectStore("todo_lists").put([{ text: "old", listId: "20261023" }], "20261023");
  tx.objectStore("todo_lists").put([], "20261024");
  tx.objectStore("todo_lists").put([{ text: "milk", listId: "Shop" }], "Shop");
  tx.objectStore("repeating_events").put({ id: "7", repeating_rule: "RRULE:FREQ=DAILY" }, "7");
  tx.objectStore("repeating_events_by_date").put({ 7: true }, "20261023");
  await new Promise((r) => (tx.oncomplete = r));
  db.close();
  localStorage.setItem("customTodoListIds", JSON.stringify([{ listId: "Shop", listName: "Shopping" }]));
  await start();
  assert.deepEqual(json("hapta.json"), { format: 1 });
  assert.deepEqual(json("days/2026-10-23.json"), { date: "2026-10-23", tasks: [{ text: "old", listId: "20261023" }] });
  assert.equal(disk["days/2026-10-24.json"], undefined, "empty days get no file");
  assert.deepEqual(json("lists.json"), { lists: [{ id: "Shop", name: "Shopping", tasks: [{ text: "milk", listId: "Shop" }] }] });
  assert.deepEqual(json("recurring.json").generated, { "2026-10-23": ["7"] });
  await start(); // marker present: no second migration
  assert.equal(json("lists.json").lists.length, 1);

  // Migration from the single hapta-data.json, which is left in place
  for (const k of Object.keys(disk)) delete disk[k];
  disk["hapta-data.json"] = JSON.stringify({ customTodoListIds: [{ listId: "A", listName: "A" }], todoLists: { 20261101: [{ text: "x" }], A: [] } });
  await start();
  assert.ok(disk["hapta-data.json"]);
  assert.deepEqual(json("days/2026-11-01.json").tasks, [{ text: "x" }]);
  assert.deepEqual(customLists.load(), [{ listId: "A", listName: "A" }]);

  // Repositories write only the affected file; the latest change wins
  writes.length = 0;
  for (let i = 1; i <= 5; i++) lists.update("20261102", Array.from({ length: i }, (_, j) => ({ text: `t${j}` })));
  await dataStore.flush();
  assert.equal(json("days/2026-11-02.json").tasks.length, 5);
  assert.ok(writes.length < 5, "queued writes to one file are coalesced");
  assert.deepEqual(writes.filter((p) => p !== "days/2026-11-02.json"), []);
  lists.update("20261102", []);
  await dataStore.flush();
  assert.equal(disk["days/2026-11-02.json"], undefined);
  assert.equal(lists.get("20261102"), undefined);

  customLists.update([{ listId: "B", listName: "Books" }, { listId: "A", listName: "A" }]);
  lists.update("B", [{ text: "Dune" }]);
  await dataStore.flush();
  assert.deepEqual(json("lists.json").lists.map((l) => l.id), ["B", "A"]);
  assert.deepEqual(lists.get("B"), [{ text: "Dune" }]);
  customLists.update([{ listId: "B", listName: "Books" }]);
  await dataStore.flush();
  assert.deepEqual(json("lists.json").lists, [{ id: "B", name: "Books", tasks: [{ text: "Dune" }] }]);

  // Reads are copies: changing them doesn't touch stored data
  lists.get("B").push({ text: "leak" });
  assert.equal(lists.get("B").length, 1);

  events.update("9", { id: "9", repeating_rule: "RRULE:FREQ=WEEKLY", start_date: new Date("2026-10-01T00:00:00Z") });
  generated.update(todayId(), { 9: true });
  generated.update(addDays(todayId(), -3), { 9: true }); // past days are dropped on the next update
  generated.update(addDays(todayId(), 1), { 9: true });
  await dataStore.flush();
  assert.equal(events.get("9").start_date, "2026-10-01T00:00:00.000Z");
  assert.deepEqual(generated.get(todayId()), { 9: true });
  assert.deepEqual(Object.keys(json("recurring.json").generated).length, 2);
  events.remove("9");
  await dataStore.flush();
  assert.deepEqual(json("recurring.json").events, {});

  // Backup round trip
  const backup = files.backupFromFiles();
  assert.deepEqual(backup.customTodoListIds, [{ listId: "B", listName: "Books" }]);
  const restored = files.filesFromBackup({ ...backup, customTodoListIds: JSON.stringify(backup.customTodoListIds) });
  assert.deepEqual(restored["lists.json"], json("lists.json"));
  assert.deepEqual(restored["days/2026-11-01.json"], json("days/2026-11-01.json"));

  // Changes from outside (sync tool, AI agent) reach the open app
  externalChanges.watch(store);
  store.commit("loadTodoLists", { todoListId: "20261101", todoList: [] });
  const outside = (path, value) => {
    disk[path] = JSON.stringify(value);
    external(path, disk[path]); // the data-changed event from data.rs
  };
  outside("days/2026-11-01.json", { date: "2026-11-01", tasks: [{ text: "from agent", listId: "20261101" }] });
  assert.deepEqual(store.getters.todoLists["20261101"], [{ text: "from agent", listId: "20261101" }]);
  assert.deepEqual(lists.get("20261101"), [{ text: "from agent", listId: "20261101" }]);
  outside("lists.json", { lists: [{ id: "C", name: "Chores", tasks: [{ text: "dishes" }] }] });
  assert.deepEqual(store.getters.cTodoListIds, [{ listId: "C", listName: "Chores" }]);
  assert.deepEqual(store.getters.todoLists.C, [{ text: "dishes" }]);
  delete disk["days/2026-11-01.json"];
  external("days/2026-11-01.json", null);
  assert.deepEqual(store.getters.todoLists["20261101"], []);
  external("lists.json", "{half written"); // reported, not applied
  assert.deepEqual(store.getters.cTodoListIds, [{ listId: "C", listName: "Chores" }]);
  assert.match(dataStoreState.error, /lists\.json/);
  // ...and the app won't write over it until it's fixed
  customLists.update([{ listId: "Z", listName: "Z" }]);
  await dataStore.flush();
  assert.equal(disk["lists.json"], JSON.stringify({ lists: [{ id: "C", name: "Chores", tasks: [{ text: "dishes" }] }] }));
  outside("lists.json", { lists: [] });
  customLists.update([{ listId: "Z", listName: "Z" }]);
  await dataStore.flush();
  assert.deepEqual(json("lists.json").lists.map((l) => l.id), ["Z"]);

  // Unreadable at startup: never written over, and no migration over it
  disk["lists.json"] = "{oops";
  await start();
  customLists.update([{ listId: "Y", listName: "Y" }]);
  await dataStore.flush();
  assert.equal(disk["lists.json"], "{oops");
  assert.match(dataStoreState.error, /lists\.json/);

  console.log("dataStore: all checks passed");
} finally {
  await vite.close();
}
