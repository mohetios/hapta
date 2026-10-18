<template>
  <div
    id="reDropDown"
    class="header-menu-icons"
    type="button"
    data-bs-toggle="dropdown"
    data-bs-auto-close="outside"
    :title="$t('ui.recurringTasks')"
  >
    <i id="btnRepeatingEvent" :class="{ 'bi-arrow-clockwise': !repeatingEvent, 'bi-arrow-repeat': repeatingEvent }"></i>
  </div>

  <ul class="dropdown-menu repeating-event-dropdown" aria-labelledby="btnRepeatingEvent">
    <div class="mx-3 d-flex flex-column drop-container">
      <select
        class="form-select re-input"
        aria-label="Default select example"
        v-model="repeatingType"
        :disabled="repeatingEvent"
      >
        <option value="">{{ $t("todoDetails.noRepeat") }}</option>
        <option value="3">{{ $t("todoDetails.daily") }}</option>
        <option value="2">{{ $t("todoDetails.weekly") }}</option>
        <option value="4">{{ $t("todoDetails.weekdays") }}</option>
        <option value="5">{{ $t("todoDetails.customWeekdays") }}</option>
        <option value="1">{{ $t("todoDetails.monthly") }}</option>
        <option value="6">{{ $t("todoDetails.daysOfMonth") }}</option>
        <option value="0">{{ $t("todoDetails.yearly") }}</option>
      </select>

      <div v-if="repeatingType" class="d-flex flex-column">
        <div v-show="repeatingType == '5' || (repeatingEvent && repeatingType == '2')" class="weekDays-selector mt-3 mb-1">
          <template v-for="day in weekdayOrder" :key="day.key">
            <input type="checkbox" :disabled="repeatingEvent" :id="'weekday-' + day.key" class="weekday" v-model="weekdays[day.key]" />
            <label :for="'weekday-' + day.key">{{ day.label }}</label>
          </template>
        </div>

        <div v-show="repeatingType == '6'" class="mt-3 mb-1">
          <input
            v-model="daysOfMonth"
            type="text"
            class="form-control day-of-month"
            :disabled="repeatingEvent"
            placeholder="1,2,15"
          />
        </div>

        <div class="d-flex align-items-center justify-content-between re-input">
          <label class="opacity-50">{{ $t("todoDetails.interval") }}</label>
          <input type="number" class="form-control lex-shrink-1 counter" v-model="interval" :disabled="repeatingEvent" />
        </div>

        <select
          class="form-select re-input"
          aria-label="Default select example"
          v-model="ocurrencesType"
          :disabled="repeatingEvent"
        >
          <option value="">{{ $t("todoDetails.indefinitely") }}</option>
          <option value="ocurrences">
            {{ $t("todoDetails.occurrences") }}
          </option>
          <option value="untilDate">{{ $t("todoDetails.untilDate") }}</option>
        </select>

        <input
          v-if="ocurrencesType == 'ocurrences'"
          type="number"
          class="form-control re-input last-input"
          v-model="ocurrences"
          :disabled="repeatingEvent"
        />
        <date-picker v-if="ocurrencesType == 'untilDate'" v-model="untilDate" :disabled="!!repeatingEvent">
          <button type="button" class="form-control re-input last-input until-date" :disabled="repeatingEvent">
            {{ untilDate ? format(untilDate, { year: "numeric", month: "short", day: "numeric" }) : $t("todoDetails.untilDate") }}
          </button>
        </date-picker>
      </div>

      <div class="d-flex flex-row re-form-row re-input">
        <button v-if="!repeatingEvent" type="button" class="btn flex-fill" @click="done">
          {{ $t("todoDetails.done") }}
        </button>
        <button v-if="repeatingEvent" type="button" class="btn flex-fill" @click="split">
          {{ $t("todoDetails.split") }}
        </button>
      </div>
    </div>
  </ul>
</template>

<script>
import { RRule, rrulestr } from "rrule";
import repeatingEventRepository from "../../repositories/repeatingEventRepository";
import { format, weekdayName, weekStart, calendarSystem, idToUtcDate, utcDateToId, dateToId } from "../../helpers/dates";
import datePicker from "../../components/datePicker.vue";
import { Dropdown } from "bootstrap";
import repeatingEventHelper from "../../helpers/repeatingEvents.js";
import repeatingEventByDateRepository from "../../repositories/repeatingEventByDateRepository";

export default {
  name: "RepatingEvent",
  components: { datePicker },
  emits: ["repeatingEventSelected"],
  data() {
    return {
      repeatingType: "",
      interval: 1,
      ocurrencesType: "",
      ocurrences: 1,
      untilDate: null,
      daysOfMonth: "",
      weekdays: { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false },
    };
  },
  props: {
    repeatingEvent: { required: true, type: [String, null] },
    todo: { required: true, type: [Object, null] },
  },
  methods: {
    done() {
      const rule = this.repeatingEventRule();
      var repeatingEventId = this.repeatingEvent ? this.repeatingEvent : String(Date.now());
      if (rule) {
        let date = this.todo.listId;
        var re_by_date = this.$store.getters.repeatingEventByDate[date];
        if (!re_by_date) re_by_date = {};
        re_by_date[repeatingEventId] = true;
        repeatingEventByDateRepository.update(date, re_by_date);
        const re_event = this.generateRepeatingEvent(rule, repeatingEventId);
        repeatingEventRepository.update(repeatingEventId, re_event);
        this.$store.commit("updateRepeatingEvent", { key: repeatingEventId, val: re_event });
        this.$store.commit("addRepeatingEventToDateCache", re_event);
        this.$store.getters.selectedDates.forEach((date) => {
          repeatingEventHelper.generateRepeatingEventsIntances(date, this);
        });
      } else {
        repeatingEventRepository.remove(repeatingEventId);
        repeatingEventId = null;
      }

      let reDropDown = document.getElementById("reDropDown");
      let dropdown = new Dropdown(reDropDown);
      dropdown.hide();

      this.$emit("repeatingEventSelected", repeatingEventId);
    },
    split() {
      repeatingEventRepository.remove(this.repeatingEvent);
      let reDropDown = document.getElementById("reDropDown");
      let dropdown = new Dropdown(reDropDown);
      dropdown.hide();
      this.$emit("repeatingEventSelected", null);
    },
    repeatingEventRule() {
      if (!this.repeatingType) return null;

      var ruleOptions = {
        freq: this.repeatingType,
        interval: this.interval,
        dtstart: idToUtcDate(this.todo.listId),
      };

      if (this.repeatingType == 4) {
        ruleOptions.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
        ruleOptions.freq = 2;
      }

      if (this.repeatingType == 5) {
        ruleOptions.byweekday = [];
        this.weekdays.mon && ruleOptions.byweekday.push(RRule.MO);
        this.weekdays.tue && ruleOptions.byweekday.push(RRule.TU);
        this.weekdays.wed && ruleOptions.byweekday.push(RRule.WE);
        this.weekdays.thu && ruleOptions.byweekday.push(RRule.TH);
        this.weekdays.fri && ruleOptions.byweekday.push(RRule.FR);
        this.weekdays.sat && ruleOptions.byweekday.push(RRule.SA);
        this.weekdays.sun && ruleOptions.byweekday.push(RRule.SU);
        ruleOptions.freq = 2;
      }

      if (this.repeatingType == 6) {
        const daysOfMonthArray = this.daysOfMonth.split(",").map((num) => parseInt(num));
        ruleOptions.bymonthday = daysOfMonthArray;
        ruleOptions.freq = 1;
      }

      if (this.ocurrencesType == "ocurrences") {
        ruleOptions.count = this.ocurrences;
      } else if (this.ocurrencesType == "untilDate") {
        // UTC midnight like dtstart, so the until day is included in every timezone
        ruleOptions.until = idToUtcDate(this.untilDate);
      }
      return new RRule(ruleOptions);
    },
    generateRepeatingEvent(rule, repeatingEventId) {
      var todo_data = JSON.parse(JSON.stringify(this.todo));
      todo_data.repeatingEvent = repeatingEventId;
      var re_event = {
        start_date: rule.options.dtstart,
        repeating_rule: rule.toString(),
        type: this.repeatingType,
        ocurrencesType: this.ocurrencesType,
        data: todo_data,
        id: repeatingEventId,
        // Monthly/yearly repeats follow the calendar system active when the event was created
        calendar: calendarSystem(),
      };

      if (this.ocurrencesType == "ocurrences") {
        re_event.end_date = idToUtcDate(repeatingEventHelper.occurrenceIds(re_event, new Date(0), new Date(8.64e15)).at(-1));
      } else if (this.ocurrencesType == "untilDate") {
        re_event.end_date = rule.options.until;
      } else {
        var date = new Date();
        date.setFullYear(date.getFullYear() + 15);
        re_event.end_date = date;
      }

      return re_event;
    },
    format,
  },
  watch: {
    repeatingEvent: function (newVal) {
      let re = this.$store.getters.repeatingEventList[newVal];
      this.weekdays = { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false };
      if (re) {
        const rule = rrulestr(re.repeating_rule);
        this.repeatingType = rule.options.freq;
        this.interval = rule.options.interval;
        this.ocurrences = rule.options.count;
        this.ocurrencesType = re.ocurrencesType;
        const until = rule.options.until;
        // Older rules stored local midnight, newer ones UTC midnight
        this.untilDate = !until
          ? null
          : until.getUTCHours() || until.getUTCMinutes()
            ? dateToId(until)
            : utcDateToId(until);
        if (rule.options.byweekday) {
          rule.options.byweekday.includes(0) && (this.weekdays.mon = true);
          rule.options.byweekday.includes(1) && (this.weekdays.tue = true);
          rule.options.byweekday.includes(2) && (this.weekdays.wed = true);
          rule.options.byweekday.includes(3) && (this.weekdays.thu = true);
          rule.options.byweekday.includes(4) && (this.weekdays.fri = true);
          rule.options.byweekday.includes(5) && (this.weekdays.sat = true);
          rule.options.byweekday.includes(6) && (this.weekdays.sun = true);
          this.repeatingType = 5;
        }
        if (rule.options.bymonthday.length > 0) {
          this.repeatingType = 6;
          this.daysOfMonth = rule.options.bymonthday.join(",");
        }
      } else {
        this.repeatingType = "";
        this.ocurrencesType = "";
        this.daysOfMonth = "";
        this.interval = 1;
        this.ocurrences = null;
        this.untilDate = null;
      }
    },
  },
  computed: {
    // ISO weekday per key; checkboxes start on the configured first day of the week
    weekdayOrder: function () {
      const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      return Array.from({ length: 7 }, (_, i) => {
        const day = (weekStart() + i) % 7;
        return { key: keys[day], label: weekdayName(day || 7, "narrow") };
      });
    },
  },
};
</script>

<style scoped lang="scss">
@import "/src/assets/style/globalVars.scss";

.header-menu-icons {
  margin-inline-start: 6px;
  @include btn-icon;
}

.repeating-event-dropdown {
  margin-inline-start: -80px !important;
  width: 200px;
}

.re-input {
  margin-top: 10px;
  font-size: 15px;
}

.counter {
  width: 60px;
  border: none;
  border-bottom: 1px solid #ced4da;
  border-radius: unset;
  padding: unset;
}

.last-input {
  border: none;
  border-bottom: 1px solid #ced4da;
  border-radius: unset;
  padding: 5ps;
}

.form-control:focus,
.form-select:focus {
  box-shadow: unset;
}

.until-date {
  text-align: start;
  background-color: transparent;
  color: inherit;
}

.dark-theme input {
  background-color: #21262d;
  color: #c9d1d9;
  border-bottom: 1px solid #464647;
}

.dark-theme .day-of-month {
  background-color: #15161e;
  border: 1px solid #464647;
}

.day-of-month::placeholder {
  color: #9b9b9b;
}

.dark-theme .day-of-month::placeholder {
  color: #838383;
}

.weekDays-selector {
  display: flex;
  justify-content: center;
}

.weekDays-selector input {
  display: none !important;
}

.weekDays-selector input[type="checkbox"] + label {
  display: inline-block;
  border-radius: 3px;
  background: #eaecef;
  height: 20px;
  width: 20px;
  margin-inline-end: 3px;
  line-height: 20px;
  text-align: center;
  cursor: pointer;
  font-size: 12px;
  text-transform: uppercase;
}

.dark-theme .weekDays-selector input[type="checkbox"] + label {
  background: #15161e;
  color: #ffffff;
}

.weekDays-selector input[type="checkbox"]:disabled + label {
  cursor: unset;
  opacity: 0.6;
}

.weekDays-selector input[type="checkbox"]:checked + label {
  background: #5c5c5c;
  color: #ffffff;
}
</style>
