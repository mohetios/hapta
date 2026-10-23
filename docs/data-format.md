# Hapta data folder

All planner data lives in one folder of small JSON files. The folder is chosen in
Settings → Data; by default it is the app's own data directory
(`~/.local/share/com.mohetios.hapta/data` on Linux).

The files are the source of truth. The app reads them at startup, writes only the file a
change touches, and watches the folder: a file edited from outside (a sync tool, a script,
an AI agent) shows up in the open app within a fraction of a second. Settings (theme,
language, calendar system) are per device and are not in this folder.

```
hapta.json              { "format": 1 }
days/2026-10-23.json    tasks of one day
lists.json              custom lists, in display order
recurring.json          recurring tasks
```

Dates are always Gregorian, whatever calendar the app displays.

## days/YYYY-MM-DD.json

Only days that have tasks have a file; deleting a file empties that day.

```json
{
  "date": "2026-10-23",
  "tasks": [
    {
      "text": "Dentist",
      "checked": false,
      "listId": "20261023",
      "desc": "Markdown notes",
      "subTaskList": [{ "text": "Bring the card", "checked": false, "editing": false }],
      "color": "#ed544b",
      "priority": 0,
      "tags": [],
      "time": "17:30",
      "alarm": true,
      "repeatingEvent": null
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `text` | Title (required) |
| `checked` | Done |
| `listId` | The list it is in: the day as `YYYYMMDD`, or a custom list `id` |
| `desc` | Description, Markdown |
| `subTaskList` | Subtasks: `text`, `checked`, `editing` (always `false`) |
| `color` | `"none"` or a hex color |
| `time` | `"HH:mm"` or `null` |
| `alarm` | Notify at `time` (today only) |
| `repeatingEvent` | Id in `recurring.json` if this task was generated from one, else `null` |
| `priority`, `tags` | Reserved, keep `0` and `[]` |

Task order in the array is the order on screen.

## lists.json

```json
{ "lists": [{ "id": "Work", "name": "Work", "tasks": [] }] }
```

`id` never changes (tasks refer to it through `listId`); `name` is what is shown.

## recurring.json

```json
{
  "events": {
    "1792742400000": {
      "id": "1792742400000",
      "repeating_rule": "DTSTART:20261024T000000Z\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=SA,MO,WE",
      "start_date": "2026-10-24T00:00:00.000Z",
      "end_date": "2041-10-23T00:00:00.000Z",
      "type": "5",
      "ocurrencesType": "",
      "calendar": "gregory",
      "data": { "text": "Gym", "repeatingEvent": "1792742400000", "...": "a task, as in a day file" }
    }
  },
  "generated": { "2026-10-24": ["1792742400000"] }
}
```

- `repeating_rule` is an iCalendar RRULE with `DTSTART` at UTC midnight of the first day.
- `type`: `"3"` daily, `"2"` weekly, `"4"` weekdays, `"5"` chosen weekdays, `"1"` monthly,
  `"6"` days of month, `"0"` yearly. `ocurrencesType`: `""` forever, `"ocurrences"`, `"untilDate"`.
- `calendar`: monthly and yearly rules follow this calendar system (e.g. `"persian"`: the
  1st of every Persian month).
- `generated` records which events already added their task to a day, so it isn't added
  twice. The app adds a task to each day from today on when that day is shown.

## Writing files from outside

- Write the whole file, ideally to a temporary name and then rename it over the old one.
- A file that isn't valid JSON is reported in Settings → Data and the app won't write over
  it until it is fixed.
- If the app and another writer change the same file at the same moment, the last write wins.
