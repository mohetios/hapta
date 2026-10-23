// Self-check for helpers/dataFolder.js and the weekToDo -> hapta database rename — run: pnpm check:data
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { createServer } from "vite";

// Stand-ins for the browser and the Tauri commands in src-tauri/src/main.rs
const local = new Map();
globalThis.localStorage = {
  getItem: (k) => local.get(k) ?? null,
  setItem: (k, v) => local.set(k, String(v)),
  removeItem: (k) => local.delete(k),
  clear: () => local.clear(),
};
let reloads = 0;
globalThis.location = { reload: () => reloads++ };
// One hapta-data.json per folder; fs.file is the current folder's
const files = {};
const fs = {
  folder: null,
  chosen: null,
  get file() {
    return files[this.folder] ?? null;
  },
  set file(contents) {
    files[this.folder] = contents;
  },
};
const commands = {
  get_data_folder: () => fs.folder,
  read_data_file: () => fs.file,
  write_data_file: ({ contents }) => {
    if (!fs.folder) throw "no data folder set";
    fs.file = contents;
  },
  choose_data_folder: () => {
    if (fs.chosen) fs.folder = fs.chosen.path;
    return fs.chosen;
  },
  reset_data_folder: () => (fs.folder = null),
};
globalThis.window = { __TAURI__: { core: { invoke: async (cmd, args) => commands[cmd](args) } } };

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { default: db, done } = await vite.ssrLoadModule("/src/repositories/dbRepository.js");
  const { default: dataFolder, dataFolderState } = await vite.ssrLoadModule("/src/helpers/dataFolder.js");
  const customLists = (await vite.ssrLoadModule("/src/repositories/customToDoListIdsRepository.js")).default;

  const getList = async (id) => {
    const conn = await done(db.open());
    const value = await done(db.get(conn, "todo_lists", id));
    conn.close();
    return value;
  };
  const putList = async (id, list) => {
    const conn = await done(db.open());
    await done(db.update(conn, "todo_lists", id, list));
    conn.close();
  };
  const fileData = () => JSON.parse(fs.file);

  // Rename: legacy data is copied once, then the old database is dropped
  const legacy = await new Promise((resolve) => {
    const req = indexedDB.open("weekToDo", 4);
    req.onupgradeneeded = () => db.TABLES.forEach((t) => req.result.createObjectStore(t));
    req.onsuccess = () => resolve(req.result);
  });
  const tx = legacy.transaction(["todo_lists", "repeating_events"], "readwrite");
  tx.objectStore("todo_lists").put([{ text: "old task" }], "20261023");
  tx.objectStore("repeating_events").put({ id: "1" }, "1");
  await new Promise((r) => (tx.oncomplete = r));
  legacy.close();
  await db.migrateLegacyName();
  assert.deepEqual(await getList("20261023"), [{ text: "old task" }]);
  await new Promise((r) => setTimeout(r, 10)); // delete is not awaited
  assert.ok(!(await indexedDB.databases()).some((d) => d.name === "weekToDo"));
  await db.migrateLegacyName(); // no legacy db: no-op

  // No folder: nothing is written
  await dataFolder.init();
  await putList("20261024", [{ text: "a" }]);
  await dataFolder.flush();
  assert.deepEqual(files, {});

  // Choosing an empty folder seeds it with the current data
  fs.chosen = { path: "/sync", hasData: false };
  await dataFolder.choose({});
  assert.equal(dataFolderState.path, "/sync");
  assert.deepEqual(fileData().todoLists["20261024"], [{ text: "a" }]);
  assert.deepEqual(fileData().repeating_events, { 1: { id: "1" } });

  // Changes (IndexedDB and custom list ids) reach the file after the debounce
  await putList("20261024", [{ text: "b" }]);
  customLists.update([{ listId: "Work", listName: "Work" }]);
  await new Promise((r) => setTimeout(r, 700));
  await dataFolder.flush();
  assert.deepEqual(fileData().todoLists["20261024"], [{ text: "b" }]);
  assert.deepEqual(fileData().customTodoListIds, [{ listId: "Work", listName: "Work" }]);

  // Startup loads the folder file over the local data
  const fromOtherDevice = fileData();
  fromOtherDevice.todoLists = { 20261025: [{ text: "from sync" }] };
  fromOtherDevice.customTodoListIds = [];
  fs.file = JSON.stringify(fromOtherDevice);
  await dataFolder.init();
  assert.equal(await getList("20261024"), undefined);
  assert.deepEqual(await getList("20261025"), [{ text: "from sync" }]);
  assert.equal(localStorage.getItem("customTodoListIds"), "[]");

  // A folder that already has data: reload to load it, and nothing written over it meanwhile
  files["/other"] = '{"todoLists":{}}';
  await putList("20261026", [{ text: "pending" }]); // save still pending
  fs.chosen = { path: "/other", hasData: true };
  await dataFolder.choose({});
  assert.equal(reloads, 1);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(files["/other"], '{"todoLists":{}}');
  assert.deepEqual(JSON.parse(files["/sync"]).todoLists["20261026"], [{ text: "pending" }]);

  // An unreadable file is never overwritten
  dataFolder.stop();
  fs.file = "not json";
  await dataFolder.init();
  assert.ok(dataFolderState.error);
  await putList("20261027", []);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(fs.file, "not json");

  // Reset keeps the local data and stops writing
  fs.file = '{"todoLists":{}}';
  await dataFolder.init();
  await dataFolder.reset();
  assert.equal(dataFolderState.path, null);
  await putList("20261028", [{ text: "local" }]);
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(files["/other"], '{"todoLists":{}}');
  assert.deepEqual(await getList("20261028"), [{ text: "local" }]);

  console.log("dataFolder: all checks passed");
} finally {
  await vite.close();
}
