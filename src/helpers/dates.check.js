// Self-check for helpers/dates.js — run: pnpm check:dates
import assert from "node:assert/strict";
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
  ssr: { noExternal: ["rrule"] }, // CommonJS, named imports need bundling
});
try {
  const { store } = await vite.ssrLoadModule("/src/store/store.js");
  const d = await vite.ssrLoadModule("/src/helpers/dates.js");
  const use = (language, calendarSystem, weekStart = 1) =>
    store.commit("loadConfig", { language, calendarSystem, weekStart });

  // ids
  assert.equal(d.addDays("20241231", 1), "20250101");
  assert.equal(d.addDays("20240301", -1), "20240229");
  assert.equal(d.addDays("20240101", "5"), "20240106");
  assert.equal(d.diffDays("20250101", "20241225"), 7);
  assert.equal(d.diffDays("20250101", "2024-12-25"), 7); // legacy lastDayOpened format
  assert.equal(d.utcDateToId(d.idToUtcDate("20261018")), "20261018");
  assert.equal(d.dateToId(new Date(2026, 9, 18, 23, 59)), "20261018");
  assert.ok(d.isDayId("20261018") && !d.isDayId("20261018T1760000000000"));

  // Nowruz 1404 = 2025-03-21
  use("fa", "persian");
  const nowruz = d.inCalendar("20250321");
  assert.deepEqual([nowruz.year, nowruz.month, nowruz.day], [1404, 1, 1]);
  assert.equal(d.toId(nowruz.subtract({ days: 1 })), "20250320");
  assert.equal(d.toId(nowruz.add({ months: 1 })), "20250421"); // 1 Ordibehesht
  assert.match(d.format("20250321", { month: "long" }), /فروردین/);
  assert.equal(d.weekdayName(6), "شنبه");

  // other calendars round-trip through Gregorian ids
  for (const cal of d.calendarSystems) {
    use("en", cal);
    assert.equal(d.toId(d.inCalendar("20261018")), "20261018", cal);
    assert.ok(d.format("20261018", { year: "numeric", month: "long", day: "numeric" }), cal);
  }

  use("en", "gregory");
  assert.equal(d.format("20261018", { weekday: "long" }), "Sunday");
  assert.equal(d.defaultCalendarFor("fa"), "persian");
  assert.equal(d.defaultWeekStartFor("fa"), 6);
  assert.equal(d.localeTag(), "en-u-ca-gregory");

  // recurrence in the event's calendar system
  const { RRule } = await vite.ssrLoadModule("rrule");
  const { default: rep } = await vite.ssrLoadModule("/src/helpers/repeatingEvents.js");
  const all = (calendar, options) =>
    rep.occurrenceIds({ calendar, repeating_rule: new RRule(options).toString() }, new Date(0), new Date(8.64e15));
  const persianDay = (id) => { use("fa", "persian"); const p = d.inCalendar(id); return [p.year, p.month, p.day]; };

  assert.deepEqual(all("persian", { freq: RRule.MONTHLY, dtstart: d.idToUtcDate("20250321"), count: 3 }),
    ["20250321", "20250421", "20250522"]); // 1 Farvardin, 1 Ordibehesht, 1 Khordad
  const on31 = all("persian", { freq: RRule.MONTHLY, bymonthday: [31], dtstart: d.idToUtcDate("20250922"), count: 2 });
  assert.deepEqual(on31.map(persianDay), [[1404, 6, 31], [1405, 1, 31]]); // 30-day months skipped
  const nowruz3 = all("persian", { freq: RRule.YEARLY, dtstart: d.idToUtcDate("20250321"), count: 3 });
  assert.deepEqual(nowruz3.map(persianDay), [[1404, 1, 1], [1405, 1, 1], [1406, 1, 1]]);
  const untilRule = { freq: RRule.MONTHLY, dtstart: d.idToUtcDate("20250321"), until: d.idToUtcDate("20250521") };
  assert.deepEqual(all("persian", untilRule), ["20250321", "20250421"]);
  // Gregorian and legacy events (no calendar) still match rrule exactly
  const greg = { freq: RRule.MONTHLY, bymonthday: [31], dtstart: d.idToUtcDate("20250131"), count: 4 };
  assert.deepEqual(all("gregory", greg), ["20250131", "20250331", "20250531", "20250731"]);
  assert.deepEqual(all(undefined, greg), all("gregory", greg));

  console.log("dates.js: all checks passed");
} finally {
  await vite.close();
}
