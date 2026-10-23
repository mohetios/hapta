// What the AI agent is told: how to work on the data folder, the file format, and the
// planner as it is right now (dates in the user's calendar, this week, lists, recurring tasks).
import dataFormat from "../../docs/data-format.md?raw";
import { languages } from "../assets/languages/languages.js";
import { todayId, addDays, fromId, format, weekStart, calendarSystem, calendarName } from "./dates";
import { isoDay, readLists, readRecurring } from "../repositories/plannerFiles";
import toDoListRepository from "../repositories/toDoListRepository";

const RULES = `You are the planning assistant inside Hapta, a weekly planner app. You manage the user's
week by reading and editing the JSON files in your current working directory: the Hapta data
folder. The app watches this folder and shows every change to the user immediately.

How to work:
- Read the files you need before changing them. Change only what the request needs and keep
  every other task, field and its order exactly as it was.
- Edit only days/YYYY-MM-DD.json, lists.json and recurring.json, in the shapes described under
  "Data format". Never touch hapta.json and never create any other file.
- Write complete, valid JSON. A new task has every task field; its "listId" is its day as
  YYYYMMDD (or the custom list's id). A day file is created when its first task is added.
- Moving a task: remove it from one file, add it to the other and update its "listId".
  Completing a task: set "checked": true (don't delete it).
- Never delete tasks, lists or recurring tasks unless the user clearly asks for it.
- A new recurring task: add the event to recurring.json with a new id (current time in ms), add
  its first task to its start day with "repeatingEvent" set to that id, and record the id under
  "generated" for that day. The app adds the following occurrences itself.
- Dates in the files are Gregorian. The user sees dates in their calendar (below) and may name
  dates that way: convert them with the table below or by calculation.
- If the request is unclear, or would remove or rewrite a lot, don't edit: ask instead.
- Finish with a short reply in the user's language: what you changed, by day, with dates in the
  user's calendar. No JSON or file names unless the user asks.`;

// "Gym 19:00 (done); Read": enough to plan without opening every file
const summary = (tasks = []) =>
  tasks.length
    ? tasks.map((t) => `${t.text}${t.time ? ` ${t.time}` : ""}${t.checked ? " (done)" : ""}`).join("; ")
    : "no tasks";

function weekLines(today) {
  // weekStart: 0 = Sunday … 6 = Saturday
  const dow = fromId(today).toDate("UTC").getUTCDay();
  const start = addDays(today, -((dow - weekStart() + 7) % 7));
  const lines = [];
  for (let i = 0; i < 14; i++) {
    const id = addDays(start, i);
    if (i === 7) lines.push("Next week:");
    const shown = format(id, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const mark = id === today ? " (today)" : "";
    lines.push(`- ${isoDay(id)}${mark} = ${shown}: ${summary(toDoListRepository.get(id))}`);
  }
  return lines.join("\n");
}

export function systemPrompt(config) {
  const today = todayId();
  const now = new Date();
  const language = languages[config.language];
  const lists = readLists();
  const events = Object.values(readRecurring().events);
  const context = `# The user's planner now

- Today: ${isoDay(today)} = ${format(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
- Local time: ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}
- Calendar shown to the user: ${calendarName(calendarSystem())} (${calendarSystem()})
- User's language: ${language?.name ?? config.language} (${config.language}); reply in it

This week (Gregorian date in files = date the user sees):
${weekLines(today)}

Custom lists: ${lists.length ? lists.map((l) => `"${l.name}" (id "${l.id}", ${summary(l.tasks)})`).join("; ") : "none"}

Recurring tasks: ${events.length ? events.map((e) => `"${e.data?.text}" (id ${e.id})`).join("; ") : "none"}`;

  return `${RULES}\n\n${context}\n\n# Data format\n\n${dataFormat}`;
}
