// 00 ~ 23 시간
export const getHours = () =>
    Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

// 00 ~ 59 분
export const getMinutes = () =>
    Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

// 시작년도 ~ 끝년도
export const getYears = (start = 2020, end = 2030) =>
    Array.from({ length: end - start + 1 }, (_, i) => String(start + i));

// 01 ~ 12 월 (다국어 지원)
export const getMonths = (language = 'ko') => {
    return Array.from({ length: 12 }, (_, i) => {
        const value = String(i + 1).padStart(2, '0');
        const date = new Date(2000, i, 1); // 2000년은 윤년 영향 없음 (월은 0부터 시작)

        let label = value;
        try {
            // Intl API를 사용하여 월 이름 가져오기
            label = new Intl.DateTimeFormat(language, { month: 'short' }).format(date);
        } catch (e) {
            // Fallback: 한국어면 1월, 아니면 숫자
            if (language === 'ko') label = `${i + 1}월`;
        }

        // 한국어의 경우 "Jan" 대신 "1월" 처럼 나오도록 확실하게 (Intl이 잘 동작하지만 명시적 제어 가능)
        // Intl 결과가 '1월', 'Jan', '1월' 등 언어에 맞게 잘 나옴.

        return { label, value };
    });
};

// 특정 년/월의 일수 계산 (윤년 자동 계산)
export const getDaysInMonth = (year, month) => {
    const date = new Date(Number(year), Number(month), 0);
    const days = date.getDate();
    return Array.from({ length: days }, (_, i) => String(i + 1).padStart(2, '0'));
};