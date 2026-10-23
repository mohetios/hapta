// Brings data files changed outside the app (a sync tool, an AI agent) into the open app
import dataStore from "../repositories/dataStore";
import { LISTS, RECURRING, dayFromPath } from "../repositories/plannerFiles";
import toDoListRepository from "../repositories/toDoListRepository";
import customToDoListIdsRepository from "../repositories/customToDoListIdsRepository";
import repeatingEventHelper from "./repeatingEvents";
import notifications from "./notifications";

export default {
  watch(store) {
    // The helpers below take a component; they only use its store
    const vue = { $store: store };
    const reloadList = (id) => store.commit("loadTodoLists", { todoListId: id, todoList: toDoListRepository.get(id) ?? [] });

    dataStore.onExternalChange((path) => {
      const day = dayFromPath(path);
      if (day) {
        // Days not on screen are read when they are shown
        if (day in store.getters.todoLists) {
          reloadList(day);
          notifications.refreshDayNotifications(vue, day);
        }
      } else if (path === LISTS) {
        store.commit("loadCustomTodoListsIds", customToDoListIdsRepository.load());
        store.getters.cTodoListIds.forEach(({ listId }) => reloadList(listId));
      } else if (path === RECURRING) {
        store.dispatch("loadAllRepeatingEvent");
        store.commit("resetRepeatingEventDateCache");
        store.commit("loadRepeatingEventDateCache", store.getters.repeatingEventList);
        for (const date of Object.keys(store.getters.repeatingEventByDate)) {
          store.dispatch("loadRepeatingEventGeneratedByDate", date);
        }
        store.getters.selectedDates.forEach((date) => repeatingEventHelper.generateRepeatingEventsIntances(date, vue));
      }
    });
  },
};
