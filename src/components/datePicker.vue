<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child :disabled="disabled">
      <slot></slot>
    </PopoverTrigger>
    <!-- No portal: stays inside Bootstrap modals/dropdowns so their focus trap and auto-close keep working -->
    <PopoverContent class="date-picker-popover" :side="side" align="start" :side-offset="6" :dir="dir">
      <CalendarRoot
        v-slot="{ weekDays, grid }"
        :model-value="value"
        :default-placeholder="value || inCalendar(todayId())"
        :locale="locale"
        :week-starts-on="weekStart"
        :dir="dir"
        fixed-weeks
        initial-focus
        @update:model-value="select"
      >
        <CalendarHeader class="dp-header">
          <CalendarPrev class="dp-nav"><i class="bi-chevron-left"></i></CalendarPrev>
          <CalendarHeading class="dp-heading" />
          <CalendarNext class="dp-nav"><i class="bi-chevron-right"></i></CalendarNext>
        </CalendarHeader>
        <CalendarGrid v-for="month in grid" :key="month.value.toString()" class="dp-grid">
          <CalendarGridHead>
            <CalendarGridRow>
              <CalendarHeadCell v-for="day in weekDays" :key="day" class="dp-weekday">{{ day }}</CalendarHeadCell>
            </CalendarGridRow>
          </CalendarGridHead>
          <CalendarGridBody>
            <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="index">
              <CalendarCell v-for="weekDate in weekDates" :key="weekDate.toString()" :date="weekDate">
                <CalendarCellTrigger :day="weekDate" :month="month.value" class="dp-day" />
              </CalendarCell>
            </CalendarGridRow>
          </CalendarGridBody>
        </CalendarGrid>
      </CalendarRoot>
    </PopoverContent>
  </PopoverRoot>
</template>

<script>
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  CalendarRoot,
  CalendarHeader,
  CalendarPrev,
  CalendarHeading,
  CalendarNext,
  CalendarGrid,
  CalendarGridHead,
  CalendarGridBody,
  CalendarGridRow,
  CalendarHeadCell,
  CalendarCell,
  CalendarCellTrigger,
} from "reka-ui";
import { inCalendar, todayId, toId, localeTag, weekStart } from "../helpers/dates";
import languageHelper from "../helpers/languageHelper";

// v-model is a Gregorian "YYYYMMDD" id; the grid is shown in the configured calendar system.
// DateValue objects are only created in computeds/props (never stored in reactive data),
// since Vue proxies strip their prototype and break the calendar.
export default {
  name: "datePicker",
  components: {
    PopoverRoot,
    PopoverTrigger,
    PopoverContent,
    CalendarRoot,
    CalendarHeader,
    CalendarPrev,
    CalendarHeading,
    CalendarNext,
    CalendarGrid,
    CalendarGridHead,
    CalendarGridBody,
    CalendarGridRow,
    CalendarHeadCell,
    CalendarCell,
    CalendarCellTrigger,
  },
  props: {
    modelValue: { type: String, default: null },
    side: { type: String, default: "bottom" },
    disabled: { type: Boolean, default: false },
  },
  emits: ["update:modelValue"],
  data() {
    return { open: false };
  },
  methods: {
    inCalendar,
    todayId,
    select(date) {
      if (!date) return;
      this.open = false;
      this.$emit("update:modelValue", toId(date));
    },
  },
  computed: {
    value() {
      return this.modelValue ? inCalendar(this.modelValue) : null;
    },
    locale() {
      return localeTag();
    },
    weekStart() {
      return weekStart();
    },
    dir() {
      return languageHelper.dir(this.$store.getters.config.language);
    },
  },
};
</script>

<style lang="scss">
@import "/src/assets/style/globalVars.scss";

.date-picker-popover {
  z-index: 1060;
  padding: 10px;
  border-radius: 7px;
  background-color: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  color: $text-color;

  .dark-theme & {
    background-color: #21262d;
    border: 1px solid #30363d;
    color: #c9d1d9;
    box-shadow: none;
  }

  .dp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .dp-heading {
    font-weight: 500;
  }

  .dp-nav,
  .dp-day {
    border: none;
    background: none;
    color: inherit;
    border-radius: 5px;
  }

  .dp-nav {
    padding: 4px 8px;
  }

  .dp-grid {
    border-collapse: collapse;
  }

  .dp-weekday {
    width: 34px;
    font-size: 12px;
    font-weight: normal;
    text-align: center;
    opacity: 0.6;
  }

  .dp-day {
    width: 34px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    cursor: pointer;

    &[data-outside-view] {
      opacity: 0.35;
    }

    &[data-today] {
      font-weight: 700;
      color: #3f377e;

      .dark-theme & {
        color: #8b83d6;
      }
    }

    &[data-selected] {
      background-color: #3f377e;
      color: white;
    }
  }

  .dp-nav:hover,
  .dp-day:not([data-selected]):hover {
    background-color: $btn-hover-bg-color;

    .dark-theme & {
      background-color: $dt-btn-hover-bg-color;
    }
  }
}
</style>
