import dataStore from "./dataStore";
import { LISTS, dayPath, isoDay, readLists } from "./plannerFiles";

const isDay = (id) => /^\d{8}$/.test(id);

export default {
  // Tasks of a day ("YYYYMMDD") or custom list; undefined if it has none stored
  get(toDoListId) {
    if (isDay(toDoListId)) return dataStore.read(dayPath(toDoListId))?.tasks;
    return readLists().find((l) => l.id === toDoListId)?.tasks;
  },
  update(toDoListId, toDoList) {
    const tasks = JSON.parse(JSON.stringify(toDoList ?? []));
    if (isDay(toDoListId)) {
      // Only days with tasks have a file
      if (tasks.length) dataStore.write(dayPath(toDoListId), { date: isoDay(toDoListId), tasks });
      else dataStore.remove(dayPath(toDoListId));
      return;
    }
    const lists = readLists();
    const list = lists.find((l) => l.id === toDoListId);
    if (list) list.tasks = tasks;
    else lists.push({ id: toDoListId, name: toDoListId, tasks });
    dataStore.write(LISTS, { lists });
  },
  remove(toDoListId) {
    if (isDay(toDoListId)) return dataStore.remove(dayPath(toDoListId));
    const lists = readLists();
    if (lists.some((l) => l.id === toDoListId)) dataStore.write(LISTS, { lists: lists.filter((l) => l.id !== toDoListId) });
  },
};
