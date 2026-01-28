import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/ja';
import 'dayjs/locale/en';

import ko from '../locales/ko.json';
import en from '../locales/en.json';
import ja from '../locales/ja.json';

const resources = {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja },
};

// 시스템 언어 감지
const getSystemLanguage = () => {
    try {
        const locales = Localization.getLocales();
        const systemCode = locales[0]?.languageCode;
        console.log('📱 Detected System Language:', systemCode);
        return systemCode || 'ko'; // 기본값 한국어
    } catch (error) {
        console.warn('Failed to detect system language:', error);
        return 'ko';
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: getSystemLanguage(), // 초기 언어 설정 (나중에 AuthStore 로딩 후 변경됨)
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false, // React Native에서는 필수
        },
    });

// dayjs 초기 설정을 i18n 초기 설정과 맞춤
dayjs.locale(i18n.language === 'system' ? getSystemLanguage() : i18n.language);

// 언어 변경 시 dayjs 로케일도 변경
i18n.on('languageChanged', (lng) => {
    const targetLang = lng === 'system' ? getSystemLanguage() : lng;
    dayjs.locale(targetLang);
    console.log(`🌍 Language changed to: ${targetLang}, Dayjs locale: ${dayjs.locale()}`);
});

export default i18n;
