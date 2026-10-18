# Calendar systems, localization & RTL — checklist

Goal: user picks any calendar system (Gregorian, Jalali, Hijri, Hebrew, …) and any
language; the whole app (week view, headers, date pickers, recurrence) follows that
calendar, and the layout follows the language direction (LTR/RTL).

## Ground rules

- **Storage stays Gregorian.** Day list ids remain `YYYYMMDD` (ISO/Gregorian) in
  IndexedDB, exports and rrule. The calendar system is a display + navigation concern.
  No data migration of todo lists.
- **Libraries:** `@internationalized/date` (calendar-aware math, 13 calendars),
  `reka-ui` Calendar (headless Vue date picker on top of it), native `Intl` for
  formatting. Remove `moment`, `date-fns`, `vue3-datepicker`.
- `DateValue` objects must never become Vue reactive proxies (they lose their
  prototype → wrong calendar/year jumps). Keep `YYYYMMDD` strings in state; create
  `DateValue`s locally, or use `shallowRef`/`markRaw`.
- Supported calendars (all from `@internationalized/date`): `gregory`, `persian`,
  `islamic-umalqura`, `islamic-civil`, `islamic-tbla`, `hebrew`, `buddhist`,
  `japanese`, `roc`, `indian`, `coptic`, `ethiopic`, `ethioaa`.

---

## Phase 0 — Tooling
- [x] Replace yarn with pnpm (lockfile, CI, Dockerfile, Tauri hooks, docs)
- [x] `pnpm add @internationalized/date reka-ui`

## Phase 1 — Date helper, remove moment
- [x] `src/helpers/dates.js`: `todayId`, `toId`, `fromId`, `addDays`, `diffDays`,
      `isBeforeToday`, `format(id, options)`, `formatTime("HH:mm")`, `weekdayName`,
      `msUntilMidnight`, `nowId` (timestamp ids)
- [x] Replace moment in: `App.vue`, `listHeader.vue`, `toDoList.vue`, `toDoItem.vue`,
      `activeToDo.vue`, `sideBar.vue`, `toDoModal.vue`, `repeatingEvent.vue`,
      `RecurrentEventsModal.vue`, `notifications.js`, `repeatingEvents.js`,
      `initialDataCreator.js`, `migrations.js`, `configRepository.js`,
      `repeatingEventDateCache.store.js`
- [x] Self-check: `20250321` ⇄ Persian `1404-01-01`; add/diff days across DST and
      year boundaries
- [x] `pnpm remove moment`

## Phase 2 — Language registry with direction
- [x] `languages.js` — one entry per language: `{ name, dir, intl, messages }`
- [x] Mark RTL: `ar`, `he`, `fa`
- [x] Add `fa.json` (Persian translation)
- [x] Language `<select>` in `configModal.vue` and `welcome/languageView.vue`
      generated from the registry
- [x] Delete `languageHelper.js`; `pnpm remove date-fns`

## Phase 3 — Settings: calendar system & week start
- [x] Config keys `calendarSystem` (default from `Intl` for the language, else
      `gregory`) and `weekStart` (0–6, 0 = Sunday)
- [x] Migration: `weekStartOnMonday` → `weekStart` (true → 1, false → 0); add
      `calendarSystem: "gregory"`
- [x] Settings modal: new "Calendar" section — calendar system select (all 13) +
      week-start select
- [x] Welcome wizard: choosing a language suggests its calendar (fa → persian)
- [x] i18n keys for the new settings in `en.json` (others fall back to en)

## Phase 4 — Date picker
- [x] `src/components/datePicker.vue` on reka-ui `CalendarRoot`; `v-model` is
      `YYYYMMDD`; uses `calendarSystem`, locale, `weekStart`, `dir`
- [x] Replace `vue3-datepicker` in `sideBar.vue` and `toDoModal.vue`
- [x] Replace native `<input type="date">` (repeat-until) in `repeatingEvent.vue`
- [x] `pnpm remove vue3-datepicker`

## Phase 5 — RTL layout
- [x] `applyLocale(lang)`: sets `<html lang dir>` and swaps
      `bootstrap.min.css` ⇄ `bootstrap.rtl.min.css`; called on boot, settings and
      welcome wizard
- [x] Convert physical CSS (`margin-left`, `padding-right`, `left:`, `right:`,
      `text-align: left|right`, `float`) to logical properties across components
- [x] Mirror direction-meaning icons (chevrons, arrows) in RTL
- [x] `App.vue` week/custom slider: `scrollLeft` is ≤ 0 in RTL — apply direction sign
- [ ] Keyboard/drag sanity check in RTL (needs a real session)

## Phase 6 — Recurrence in non-Gregorian calendars
- [x] Daily / weekly / weekdays: unchanged (calendar-independent)
- [x] Weekday checkboxes ordered by `weekStart`, labels from `Intl`
- [x] Monthly / yearly / days-of-month when `calendarSystem !== "gregory"`: expand
      occurrences with `@internationalized/date` in that calendar (store the
      calendar id on the repeating event); rrule stays for Gregorian
- [x] `RecurrentEventsModal` summary text formatted in the active calendar

## Phase 6b — Fonts
- [x] Vazirmatn variable font bundled in `src/assets/fonts` (OFL) for RTL via
      `--bs-body-font-family`; only downloaded
      when Arabic-script glyphs render

## Phase 7 — Verification
- [x] `pnpm lint`, `pnpm build`, `pnpm check:dates`
- [x] Headless Chrome smoke test: en/gregory, fa/persian, ar/islamic-umalqura,
      he/hebrew, ja/japanese — week view, today, RTL scroll, sidebar + task pickers,
      runtime calendar/language switch
- [ ] Manual run in the Tauri webviews (WebKitGTK, WKWebView, WebView2) incl.
      notifications and drag & drop in RTL
- [ ] Translate the 3 new `settings.*` keys (`region`, `calendarSystem`, `weekStart`)
      for languages other than en/fa (Crowdin)
- [x] Existing user data (old config without new keys) loads correctly
