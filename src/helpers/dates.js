// Day list ids are always Gregorian "YYYYMMDD" (storage, rrule, exports).
// The calendar system only changes how days are displayed and navigated.
import {
  CalendarDate,
  GregorianCalendar,
  createCalendar,
  toCalendar,
  today,
  getLocalTimeZone,
} from "@internationalized/date";
import { store } from "../store/store";
import { languages } from "../assets/languages/languages.js";

export const calendarSystems = [
  "gregory",
  "persian",
  "islamic-umalqura",
  "islamic-civil",
  "islamic-tbla",
  "hebrew",
  "buddhist",
  "japanese",
  "roc",
  "indian",
  "coptic",
  "ethiopic",
  "ethioaa",
];

const gregorian = new GregorianCalendar();
const pad = (n, width = 2) => String(n).padStart(width, "0");

// Read lazily so Vue tracks config changes when called during render
const config = () => store.getters.config;
export const intlLocale = (lang = config().language) => languages[lang]?.intl ?? "en";
export const calendarSystem = () => config().calendarSystem ?? "gregory";
export const weekStart = () => config().weekStart ?? 1;
// Locale tag carrying the calendar, e.g. "fa-u-ca-persian"
export const localeTag = () => `${intlLocale()}-u-ca-${calendarSystem()}`;

// Accepts "YYYYMMDD" and legacy "YYYY-MM-DD"
export function fromId(id) {
  const s = String(id).replaceAll("-", "");
  return new CalendarDate(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8));
}

export function toId(date) {
  const d = toCalendar(date, gregorian);
  return pad(d.year, 4) + pad(d.month) + pad(d.day);
}

// Local calendar day of a JS Date
export const dateToId = (date) => toId(new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate()));

export const isDayId = (id) => /^\d{8}$/.test(id);
export const todayId = () => toId(today(getLocalTimeZone()));
// days may arrive as a string from config (e.g. columns)
export const addDays = (id, days) => toId(fromId(id).add({ days: +days }));
// Whole days from b to a (positive when a is after b)
export const diffDays = (a, b) => fromId(a).compare(fromId(b));
export const isPast = (id) => id < todayId();

// rrule works with "UTC midnight" Dates
export const idToUtcDate = (id) => fromId(id).toDate("UTC");
export const utcDateToId = (date) => new Date(date).toISOString().slice(0, 10).replaceAll("-", "");

// Day in the active calendar system, for calendar-aware math and pickers
export const inCalendar = (id) => toCalendar(fromId(id), createCalendar(calendarSystem()));

export function format(id, options) {
  return new Intl.DateTimeFormat(localeTag(), { ...options, timeZone: "UTC" }).format(idToUtcDate(id));
}

// isoDay: 1 = Monday … 7 = Sunday (2024-01-01 was a Monday)
export const weekdayName = (isoDay, weekday = "long") => format(addDays("20240101", isoDay - 1), { weekday });

// "HH:mm" -> Date today at that time
export function timeToday(time) {
  const [h, m] = time.split(":");
  const d = new Date();
  d.setHours(+h, +m, 0, 0);
  return d;
}

export const formatTime = (time) =>
  time ? new Intl.DateTimeFormat(intlLocale(), { hour: "numeric", minute: "2-digit" }).format(timeToday(time)) : "";

export function msUntilMidnight() {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return midnight - Date.now();
}

// Calendar the language's region uses by default, e.g. "fa" -> "persian"
export function defaultCalendarFor(lang) {
  const cal = new Intl.DateTimeFormat(intlLocale(lang)).resolvedOptions().calendar;
  return calendarSystems.includes(cal) ? cal : "gregory";
}

// 0 = Sunday … 6 = Saturday; Intl weekInfo uses 1 = Monday … 7 = Sunday
export function defaultWeekStartFor(lang) {
  const locale = new Intl.Locale(intlLocale(lang)).maximize();
  const info = locale.getWeekInfo?.() ?? locale.weekInfo;
  return info ? info.firstDay % 7 : 1;
}

export const calendarName =(cal) => new Intl.DisplayNames(intlLocale(), { type: "calendar" }).of(cal);
