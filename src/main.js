import { createApp } from "vue";
import App from "./App.vue";
import { store } from "./store/store";
import dataStore from "./repositories/dataStore";
import { migrateIfNeeded } from "./repositories/plannerFiles";
import externalChanges from "./helpers/externalChanges";

import { createI18n } from "vue-i18n";
import { messages } from "./assets/languages/languages.js";
const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages,
});

import "bootstrap";
// Bootstrap CSS (LTR/RTL) is loaded by helpers/languageHelper.js

import "bootstrap-icons/font/bootstrap-icons.css";

import "./assets/style/globalVars.scss";
import "./assets/style/main.scss";
import "./assets/style/uiComponents.scss";

const app = createApp(App);

app.use(store);
app.use(i18n);
// Data must be in place before App.vue loads it
dataStore
  .init()
  .then(migrateIfNeeded)
  .then(() => externalChanges.watch(store))
  .catch((e) => console.error("Loading data:", e))
  .finally(() => app.mount("#app"));
