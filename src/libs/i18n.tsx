import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import {logging} from "@/libs/logging.tsx";
import { userDataStore } from "./userDataStore";

export const resources = {
  en: { translation: en },
  ja: { translation: ja },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: import.meta.env.DEV,
    resources: resources,
    interpolation: { escapeValue: false },
  });

userDataStore.getLanguage()
  .then((userLang) => {
    i18n.changeLanguage(userLang ?? i18n.language);
  })
  .catch((e) => {
    logging.error(e);
  });

export default i18n;