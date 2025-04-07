import i18n from "i18next";
import { initReactI18next} from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en.json";
import ja from "@/locales/ja.json";
import {LazyStore} from "@tauri-apps/plugin-store";

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

const store = new LazyStore('store.json');

const userLang = await store.get<string>("lang");
i18n.changeLanguage(userLang ?? i18n.language);

export default i18n;