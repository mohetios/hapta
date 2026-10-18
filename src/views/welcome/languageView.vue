<template>
  <div class="row">
    <div class="col-md-4">
      <img class="logo info-image" src="/img/hapta-icon.png" alt="Hapta" title="Hapta Logo" width="110" />
    </div>
    <div class="col-md-8">
      <div>
        <h4>{{ $t("welcome.welcome") }}</h4>
        <text> {{ $t("welcome.welcomeText") }}</text>
        <div>
          <label for="wizard-language" class="form-label"></label>
          <select
            id="wizard-language"
            class="col-sm-9 form-select"
            aria-label="Default select example"
            v-model="language"
            @change="changeLanguage"
          >
            <option v-for="(lang, key) in languages" :key="key" :value="key">{{ lang.name }}</option>
          </select>
        </div>
      </div>
    </div>
  </div>
  <div class="d-flex btn-footer mt-3">
    <button type="button" class="btn flex-fill invisible">
      <i class="bi-chevron-double-left"></i>
      {{ $t("welcome.back") }}
    </button>
    <button type="button" class="btn flex-fill" @click="next">
      {{ $t("welcome.next") }} <i class="bi-chevron-double-right"></i>
    </button>
  </div>
</template>

<script>
import configRepository from "../../repositories/configRepository";
import languageHelper from "../../helpers/languageHelper";
import { languages } from "../../assets/languages/languages.js";
import { defaultCalendarFor, defaultWeekStartFor } from "../../helpers/dates";
import desktop from "../../helpers/desktop";

export default {
  name: "languageView",
  data() {
    return {
      language: this.$store.getters.config.language,
      languages,
    };
  },
  methods: {
    changeLanguage: function () {
      this.$nextTick(function () {
        this.$store.commit("updateConfig", { val: this.language, key: "language" });
        // First run: follow the language's regional calendar, e.g. fa -> Persian, Saturday
        this.$store.commit("updateConfig", { val: defaultCalendarFor(this.language), key: "calendarSystem" });
        this.$store.commit("updateConfig", { val: defaultWeekStartFor(this.language), key: "weekStart" });
        configRepository.update(this.$store.getters.config);
        languageHelper.applyLocale(this.$i18n, this.language);

        if (desktop.isDesktop()) {
          desktop.setTrayContextMenuLabel({ open: this.$t("ui.open"), quit: this.$t("ui.quit") });
        }
      });
    },
    next: function () {
      document.getElementById("welcome-2-tab").click();
    },
  },
};
</script>

<style scoped>
.info-image {
  margin-top: 20px;
  margin-inline-start: 10px;
}

.btn-footer {
  border-top: 1px solid #dee2e6;
  padding-top: 6px;
}

.dark-theme .btn-footer {
  border-top: 1px solid #999da1;
}

.form-select:focus {
  box-shadow: none;
}
</style>