import toDoListRepository from "../repositories/toDoListRepository";
import repeatingEventByDateRepository from "../repositories/repeatingEventByDateRepository";
import { RRule, rrulestr } from "rrule";
import { createCalendar, toCalendar } from "@internationalized/date";
import { isPast, fromId, toId, utcDateToId, idToUtcDate } from "./dates";
import tasksHelper from "./tasksHelper";

export default {
  // Gregorian ids of a repeating event's occurrences strictly between two Dates (like rrule.between).
  // rrule only knows Gregorian months/years, so monthly/yearly events created under another
  // calendar system (re.calendar) are expanded in that calendar; everything else goes to rrule.
  occurrenceIds(re, from, to) {
    const rule = rrulestr(re.repeating_rule);
    const { freq, dtstart, count, until } = rule.options;
    const calendar = re.calendar ?? "gregory";
    if (calendar === "gregory" || (freq !== RRule.MONTHLY && freq !== RRule.YEARLY)) {
      return rule.between(from, to).map(utcDateToId);
    }

    const interval = rule.options.interval || 1;
    const start = toCalendar(fromId(utcDateToId(dtstart)), createCalendar(calendar));
    const startId = toId(start);
    // origOptions: rrule back-fills bymonthday from the Gregorian dtstart otherwise
    const days = freq === RRule.MONTHLY && rule.origOptions.bymonthday
      ? [].concat(rule.origOptions.bymonthday).sort((a, b) => a - b)
      : [start.day];
    const ids = [];
    let seen = 0;
    // ponytail: yearly in lunisolar calendars (Hebrew leap Adar) keeps the month number, not the named month
    for (let k = 0; ; k++) {
      const period = start.set({ day: 1 }).add(freq === RRule.YEARLY ? { years: k * interval } : { months: k * interval });
      if (idToUtcDate(toId(period)) >= to) return ids;
      const daysInMonth = period.calendar.getDaysInMonth(period);
      for (const d of days) {
        const day = d < 0 ? daysInMonth + d + 1 : d;
        if (day < 1 || day > daysInMonth) continue; // like rrule: missing days are skipped, not clamped
        const id = toId(period.set({ day }));
        if (id < startId) continue;
        const date = idToUtcDate(id);
        if ((until && date > until) || (count && ++seen > count)) return ids;
        if (date > from && date < to) ids.push(id);
      }
    }
  },
  generateRepeatingEventsIntances(listId, vue) {
    let r_events = vue.$store.getters.repeatingEventDateCache[listId] || [];
    r_events.forEach((re_id) => {
      var re = vue.$store.getters.repeatingEventList[re_id];
      var re_by_date = vue.$store.getters.repeatingEventByDate[listId];
      if (!re_by_date[re_id]) {
        var new_instanced_event = JSON.parse(JSON.stringify(re.data));
        new_instanced_event.listId = listId;
        vue.$store.commit("addTodo", new_instanced_event);

        if(vue.$store.getters.config.autoReorderTasks){
          toDoListRepository.update(listId, tasksHelper.reorderTasksList(vue.$store.getters.todoLists[listId]));
        } else {
          toDoListRepository.update(listId, vue.$store.getters.todoLists[listId]);
        }
     
        re_by_date[re_id] = true;
        repeatingEventByDateRepository.update(listId, re_by_date);
      }
    });
  },
  removeGeneratedRepeatingEvents(listId, vue) {
    vue.$store.getters.todoLists[listId].forEach((todo, index) => {
      if (todo.repeatingEvent && !vue.$store.getters.repeatingEventList[todo.repeatingEvent]) {
        if (isPast(todo.listId)) {
          todo.repeatingEvent = null;
        } else {
          vue.$store.commit("removeTodo", {
            toDoListId: todo.listId,
            index: index,
          });
        }
        toDoListRepository.update(todo.listId, vue.$store.getters.todoLists[todo.listId]);
      }
    });
  },
};
