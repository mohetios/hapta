import dataFolder from "../helpers/dataFolder";

const DB_NAME = 'hapta';
// Name used before the rename to Hapta, see migrateLegacyName()
const LEGACY_DB_NAME = 'weekToDo';
const TABLES = ['todo_lists', 'repeating_events', 'repeating_events_by_date'];

// IDBRequest -> Promise of its result
export const done = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

export const committed = (tx) => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
});

export default {
    TABLES,
    open() {
        var req = indexedDB.open(DB_NAME, 4);
        req.onupgradeneeded = function (event) {
            var db = event.target.result;
            if (!db.objectStoreNames.contains("todo_lists")) {
                db.createObjectStore('todo_lists', {autoIncrement: false});
            }

            if (!db.objectStoreNames.contains("repeating_events")) {
                db.createObjectStore('repeating_events', {autoIncrement: false});
            }

            if (!db.objectStoreNames.contains("repeating_events_by_date")) {
                db.createObjectStore('repeating_events_by_date', {autoIncrement: false});
            }
        }
        req.onerror = function (event) {
            console.log('error opening database ' + event.target.errorCode);
        }
        return req;
    },
    get(db, table, id) {
        let tx = db.transaction([table], 'readonly');
        let store = tx.objectStore(table);
        let req = store.get(id);
        return req;
    },
    add(db, table, id, obj) {
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let req = store.add(obj, id);
        dataFolder.scheduleSave();
        return req;
    },
    update(db, table, id, obj) {
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let new_obj = JSON.parse(JSON.stringify(obj));
        let req = store.put(new_obj,id);
        dataFolder.scheduleSave();
        return req;
    },
    delete(db, table, id) {
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let req = store.delete(id);
        dataFolder.scheduleSave();
        return req;
    },
    selectAll(db, table){
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let req = store.openCursor();
        return req;
    },
    clear(db, table){
        let tx = db.transaction([table], 'readwrite');
        let store = tx.objectStore(table);
        let req = store.clear();
        dataFolder.scheduleSave();
        return req;
    },
    // Copies the old "weekToDo" database into "hapta" once, then deletes it.
    // Only copies into an empty database, so a re-run never overwrites newer data.
    async migrateLegacyName() {
        const dbs = (await indexedDB.databases?.()) ?? [];
        if (!dbs.some((d) => d.name === LEGACY_DB_NAME)) return;
        const legacy = await done(indexedDB.open(LEGACY_DB_NAME));
        const db = await done(this.open());
        const tables = TABLES.filter((t) => legacy.objectStoreNames.contains(t));
        if (tables.length && (await done(db.transaction('todo_lists').objectStore('todo_lists').count())) === 0) {
            const read = legacy.transaction(tables);
            const rows = await Promise.all(tables.map((t) =>
                Promise.all([done(read.objectStore(t).getAllKeys()), done(read.objectStore(t).getAll())])));
            const write = db.transaction(tables, 'readwrite');
            tables.forEach((t, i) => rows[i][0].forEach((key, j) => write.objectStore(t).put(rows[i][1][j], key)));
            await committed(write);
        }
        legacy.close();
        db.close();
        // Not awaited: another open tab (web build) would block the delete and stall startup
        indexedDB.deleteDatabase(LEGACY_DB_NAME);
    }
};
