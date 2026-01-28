export const CATEGORY_PALETTE = [
    { id: '1', value: '#7986CB', name: 'lavender' },  // 라벤더 (API ID: 1)
    { id: '2', value: '#33B679', name: 'sage' },      // 세이지 (API ID: 2)
    { id: '3', value: '#8E24AA', name: 'grape' },     // 포도 (API ID: 3)
    { id: '4', value: '#E67C73', name: 'flamingo' },  // 플라밍고 (API ID: 4)
    { id: '5', value: '#F6BF26', name: 'banana' },    // 바나나 (API ID: 5)
    { id: '6', value: '#F4511E', name: 'tangerine' }, // 탠저린 (API ID: 6)
    { id: '7', value: '#039BE5', name: 'peacock' },   // 피콕 (API ID: 7)
    { id: '8', value: '#616161', name: 'graphite' },  // 흑연 (API ID: 8)
    { id: '9', value: '#3F51B5', name: 'blueberry' }, // 블루베리 (API ID: 9)
    { id: '10', value: '#0B8043', name: 'basil' },    // 바질 (API ID: 10)
    { id: '11', value: '#D50000', name: 'tomato' },   // 토마토 (API ID: 11)
];

// 기본 색상은 보통 '피콕(파랑)'이나 '흑연(회색)'을 많이 씁니다.
export const DEFAULT_COLOR = CATEGORY_PALETTE[6].value; // Peacock (#039BE5)