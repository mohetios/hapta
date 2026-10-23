import dataStore from "./dataStore";
import { RECURRING, readRecurring } from "./plannerFiles";

export default {
  all() {
    return readRecurring().events;
  },
  get(repeatingEventId) {
    return readRecurring().events[repeatingEventId];
  },
  update(repeatingEventId, repeatingEvent) {
    const recurring = readRecurring();
    recurring.events[repeatingEventId] = JSON.parse(JSON.stringify(repeatingEvent));
    dataStore.write(RECURRING, recurring);
  },
  remove(repeatingEventId) {
    const recurring = readRecurring();
    if (!(repeatingEventId in recurring.events)) return;
    delete recurring.events[repeatingEventId];
    dataStore.write(RECURRING, recurring);
  },
};
