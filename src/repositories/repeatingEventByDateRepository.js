// Which recurring events already put their task on a day, so it isn't added twice
import dataStore from "./dataStore";
import { RECURRING, isoDay, readRecurring } from "./plannerFiles";
import { todayId } from "../helpers/dates";

export default {
  // { [repeatingEventId]: true }
  get(date) {
    return Object.fromEntries((readRecurring().generated[isoDay(date)] ?? []).map((id) => [id, true]));
  },
  update(date, generatedRepeatingEvents) {
    const recurring = readRecurring();
    // Tasks are only generated from today on, so older days need no record
    const today = isoDay(todayId());
    for (const day of Object.keys(recurring.generated)) if (day < today) delete recurring.generated[day];
    recurring.generated[isoDay(date)] = Object.keys(generatedRepeatingEvents);
    dataStore.write(RECURRING, recurring);
  },
};
