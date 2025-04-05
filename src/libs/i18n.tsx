import i18n from "i18next";
import { initReactI18next} from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en.json";
import ja from "@/locales/ja.json";

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: "en",
        debug: import.meta.env.DEV,
        resources: {
            en: { translation: en },
            ja: { translation: ja },
        },
        interpolation: { escapeValue: false },
    });

export default i18n;