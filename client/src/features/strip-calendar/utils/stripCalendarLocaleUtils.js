import i18n from '../../../utils/i18n';

const WEEKDAY_LABELS = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ja: ['日', '月', '火', '水', '木', '金', '土'],
};

const MONTH_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function resolveCalendarLanguage(settingsLanguage) {
  if (settingsLanguage && settingsLanguage !== 'system') {
    return settingsLanguage;
  }

  const resolved = (i18n.resolvedLanguage || i18n.language || 'ko').toLowerCase();

  if (resolved.startsWith('ja')) return 'ja';
  if (resolved.startsWith('en')) return 'en';
  return 'ko';
}

export function getWeekdayLabels(language, startDayOfWeek) {
  const lang = resolveCalendarLanguage(language);
  const labels = WEEKDAY_LABELS[lang] || WEEKDAY_LABELS.ko;

  if (startDayOfWeek === 'monday') {
    return [...labels.slice(1), labels[0]];
  }

  return labels;
}

export function formatHeaderYearMonth(year, month, language) {
  const lang = resolveCalendarLanguage(language);

  if (lang === 'en') {
    return `${MONTH_SHORT_EN[month - 1]} ${year}`;
  }

  if (lang === 'ja') {
    return `${year}年 ${month}月`;
  }

  return `${year}년 ${month}월`;
}
