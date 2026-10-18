import { languages, defaultLocale } from "../assets/languages/languages.js";
import bootstrapLtr from "bootstrap/dist/css/bootstrap.min.css?url";
import bootstrapRtl from "bootstrap/dist/css/bootstrap.rtl.min.css?url";

const bootstrapLink = document.createElement("link");
bootstrapLink.rel = "stylesheet";
// First in <head> so app styles keep overriding Bootstrap
document.head.prepend(bootstrapLink);

export default {
  // Single entry point for switching language: messages, <html lang dir>, Bootstrap LTR/RTL build
  applyLocale(i18n, lang) {
    const language = languages[lang] ?? languages[defaultLocale];
    i18n.locale = lang in languages ? lang : defaultLocale;
    document.documentElement.lang = language.intl;
    document.documentElement.dir = language.dir;
    const href = language.dir === "rtl" ? bootstrapRtl : bootstrapLtr;
    if (bootstrapLink.getAttribute("href") !== href) bootstrapLink.href = href;
  },
  dir(lang) {
    return languages[lang]?.dir ?? "ltr";
  },
};
