import dataStore from "./dataStore";
import { LISTS, readLists } from "./plannerFiles";

export default {
  load() {
    return readLists().map((l) => ({ listId: l.id, listName: l.name }));
  },
  // Order and names; a list's tasks stay with it, removed lists are dropped
  update(customToDoList) {
    const tasks = Object.fromEntries(readLists().map((l) => [l.id, l.tasks]));
    dataStore.write(LISTS, {
      lists: customToDoList.map(({ listId, listName }) => ({ id: listId, name: listName, tasks: tasks[listId] ?? [] })),
    });
  },
};
