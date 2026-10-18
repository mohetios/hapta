import { createApp } from "vue";
import App from "./App.vue";
import { store } from "./store/store";

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
import "vazirmatn/Vazirmatn-Variable-font-face.css";

import "./assets/style/globalVars.scss";
import "./assets/style/main.scss";
import "./assets/style/uiComponents.scss";

const app = createApp(App);

app.use(store);
app.use(i18n);
app.mount("#app");
