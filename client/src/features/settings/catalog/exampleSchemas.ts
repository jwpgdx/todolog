import type {
  PickerHostModel,
  ScreenKind,
  SelectionListModel,
  SettingsSection,
} from '../types';

type BaseCatalogExample<TFamily extends ScreenKind, TPayload> = {
  id: string;
  family: TFamily;
  title: string;
  description: string;
  notes?: string[];
  payload: TPayload;
};

export type SettingsListCatalogExample = BaseCatalogExample<
  'settingsList',
  {
    screenId: string;
    sections: SettingsSection[];
  }
>;

export type SelectionListCatalogExample = BaseCatalogExample<
  'selectionList',
  SelectionListModel
>;

export type CategoryManagerCatalogExample = BaseCatalogExample<
  'categoryManager',
  {
    screenId: string;
    sections: SettingsSection[];
  }
>;

export type PickerHostCatalogExample = BaseCatalogExample<
  'pickerHost',
  PickerHostModel
>;

export type CatalogExample =
  | SettingsListCatalogExample
  | SelectionListCatalogExample
  | CategoryManagerCatalogExample
  | PickerHostCatalogExample;

export const DEFAULT_CATALOG_FAMILY: ScreenKind = 'settingsList';

export const DEFAULT_CATALOG_SCHEMA_IDS: Record<ScreenKind, string> = {
  settingsList: 'my-page-main',
  selectionList: 'language-selection',
  categoryManager: 'category-manager',
  pickerHost: 'picker-date-time',
};

export const SETTINGS_LIST_EXAMPLES: SettingsListCatalogExample[] = [
  {
    id: 'my-page-main',
    family: 'settingsList',
    title: 'My Page Main',
    description: '마이페이지 메뉴형 grouped list 기본형.',
    notes: [
      '마이페이지 전체 화면이 아니라 리스트 영역만 schema-driven으로 붙이는 용도다.',
      'version/static row와 action row를 같이 본다.',
    ],
    payload: {
      screenId: 'my-page-main',
      sections: [
        {
          id: 'content',
          title: '콘텐츠',
          items: [
            {
              kind: 'navigationValue',
              id: 'calendar',
              title: '일정 관리',
              destination: '/(app)/(tabs)/calendar',
            },
            {
              kind: 'navigationValue',
              id: 'google-calendar',
              title: '구글 캘린더 연동',
              destination: '/(app)/(tabs)/my-page/settings/google-calendar',
            },
          ],
        },
        {
          id: 'support',
          title: '정보 및 지원',
          footer: '실제 wiring 전까지는 mock schema로만 검증합니다.',
          items: [
            {
              kind: 'action',
              id: 'leave-review',
              title: '리뷰 남기기',
            },
            {
              kind: 'staticValue',
              id: 'app-version',
              title: '앱 버전',
              value: '1.0.0-dev',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'settings-general',
    family: 'settingsList',
    title: 'Settings General',
    description: 'toggle, menu, selectionNavigation, expandable content를 한 화면에서 본다.',
    notes: [
      'selectionNavigation은 logical selectionScreenId를 emit한다.',
      'menu는 short single-select row다.',
    ],
    payload: {
      screenId: 'settings-general',
      sections: [
        {
          id: 'preferences',
          title: '일반',
          items: [
            {
              kind: 'toggle',
              id: 'sync-over-cellular',
              title: '셀룰러에서도 동기화',
              subtitle: 'Wi-Fi가 아닌 환경에서도 백그라운드 동기화를 허용합니다.',
              value: true,
            },
            {
              kind: 'menu',
              id: 'week-start-day',
              title: '시작 요일',
              value: '월요일',
              selectedOptionId: 'monday',
              options: [
                { id: 'sunday', label: '일요일' },
                { id: 'monday', label: '월요일' },
                { id: 'saturday', label: '토요일' },
              ],
            },
            {
              kind: 'selectionNavigation',
              id: 'language',
              title: '언어',
              value: 'System',
              selectionScreenId: 'language-selection',
            },
            {
              kind: 'selectionNavigation',
              id: 'time-zone',
              title: '시간대',
              value: 'Asia/Seoul',
              selectionScreenId: 'time-zone-selection',
            },
          ],
        },
        {
          id: 'schedule',
          title: '일정',
          footer: '달력/시간 picker는 나중에 native host로 교체되며, 지금은 catalog preview로 동작합니다.',
          items: [
            {
              kind: 'expandableParent',
              id: 'default-reminder-date',
              title: '기본 리마인더 날짜',
              value: 'Inline date',
              expanded: true,
              embeddedContentId: 'default-reminder-date-inline',
            },
            {
              kind: 'embeddedContent',
              id: 'default-reminder-date-inline',
              contentType: 'date',
              temporalConfig: {
                mode: 'date',
                presentation: 'inline',
                locale: 'ko-KR',
                timeZone: 'Asia/Seoul',
              },
            },
            {
              kind: 'destructiveAction',
              id: 'reset-settings',
              title: '설정 초기화',
              confirmStyle: 'sheet',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'switch-dependent-child',
    family: 'settingsList',
    title: 'Switch Dependent Child',
    description: 'switch on/off에 따라 아래 child editor가 노출되는 패턴.',
    notes: ['toggle.childVisibilityKey가 embeddedContent.id와 연결된다.'],
    payload: {
      screenId: 'switch-dependent-child',
      sections: [
        {
          id: 'birthday-reminder',
          title: '생일 리마인더',
          footer: '실제 production wiring 전까지는 catalog mock state만 변경됩니다.',
          items: [
            {
              kind: 'toggle',
              id: 'birthday-reminder-enabled',
              title: '생일 리마인더 활성화',
              subtitle: '켜면 아래 시간 editor가 노출됩니다.',
              value: true,
              childVisibilityKey: 'birthday-reminder-time',
            },
            {
              kind: 'embeddedContent',
              id: 'birthday-reminder-time',
              contentType: 'time',
              temporalConfig: {
                mode: 'time',
                presentation: 'compact',
                minuteInterval: 5,
                locale: 'ko-KR',
              },
            },
          ],
        },
      ],
    },
  },
];

export const SELECTION_LIST_EXAMPLES: SelectionListCatalogExample[] = [
  {
    id: 'language-selection',
    family: 'selectionList',
    title: 'Language Selection',
    description: 'single-select + check indicator 기본형.',
    payload: {
      screenId: 'language-selection',
      title: '언어',
      subtitle: '한 번에 하나만 선택할 수 있습니다.',
      searchEnabled: false,
      allowsMultiple: false,
      selectedIds: ['system'],
      options: [
        { id: 'system', label: 'System', subtitle: '현재 기기 언어를 사용' },
        { id: 'en', label: 'English' },
        { id: 'ko', label: '한국어' },
        { id: 'ja', label: '日本語' },
      ],
    },
  },
  {
    id: 'time-zone-selection',
    family: 'selectionList',
    title: 'Time Zone Selection',
    description: 'search on/off와 긴 option list 목적지 화면.',
    payload: {
      screenId: 'time-zone-selection',
      title: '시간대',
      subtitle: '검색 가능한 selection screen 패턴.',
      searchEnabled: true,
      allowsMultiple: false,
      selectedIds: ['asia-seoul'],
      options: [
        { id: 'asia-seoul', label: 'Asia/Seoul', keywords: ['korea', 'seoul', 'kst'] },
        { id: 'asia-tokyo', label: 'Asia/Tokyo', keywords: ['japan', 'tokyo', 'jst'] },
        { id: 'america-la', label: 'America/Los_Angeles', keywords: ['pst', 'los angeles', 'la'] },
        { id: 'america-ny', label: 'America/New_York', keywords: ['est', 'new york', 'nyc'] },
        { id: 'europe-london', label: 'Europe/London', keywords: ['gmt', 'uk', 'london'] },
        { id: 'europe-paris', label: 'Europe/Paris', keywords: ['cet', 'paris', 'france'] },
        { id: 'asia-bangkok', label: 'Asia/Bangkok', keywords: ['ict', 'bangkok', 'thailand'] },
        { id: 'australia-sydney', label: 'Australia/Sydney', keywords: ['aest', 'sydney'] },
      ],
    },
  },
  {
    id: 'notification-categories-multi',
    family: 'selectionList',
    title: 'Multi-Select Readiness',
    description: 'v1 full delivery는 아니지만 selection renderer가 multi-select fixture를 받아도 깨지지 않아야 한다.',
    payload: {
      screenId: 'notification-categories-multi',
      title: '알림 카테고리',
      subtitle: 'multi-select readiness fixture',
      searchEnabled: false,
      allowsMultiple: true,
      selectedIds: ['work', 'health'],
      options: [
        { id: 'work', label: '업무' },
        { id: 'health', label: '건강' },
        { id: 'family', label: '가족' },
        { id: 'personal', label: '개인' },
      ],
    },
  },
];

export const CATEGORY_MANAGER_EXAMPLES: CategoryManagerCatalogExample[] = [
  {
    id: 'category-manager',
    family: 'categoryManager',
    title: 'Category Manager',
    description: 'category-specific plain interactive list scaffold.',
    notes: [
      'iOS baseline은 system-first다.',
      'Android는 swipe + trailing ... + long press reorder policy를 따른다.',
    ],
    payload: {
      screenId: 'category-manager',
      sections: [
        {
          id: 'categories',
          title: '카테고리 관리',
          footer: 'Pinned row를 포함한 최종 visible order 전체를 reorder payload로 보냅니다.',
          items: [
            {
              kind: 'interactiveCategory',
              id: 'inbox',
              title: 'Inbox',
              subtitle: '12개 일정',
              reorderable: false,
              pinned: true,
              swipeActions: [{ id: 'archive', title: '보관' }],
              menuActions: [
                { id: 'rename', title: '이름 변경' },
                { id: 'change-color', title: '색상 변경' },
              ],
            },
            {
              kind: 'interactiveCategory',
              id: 'work',
              title: '업무',
              subtitle: '24개 일정',
              reorderable: true,
              swipeActions: [
                { id: 'archive', title: '보관' },
                { id: 'delete', title: '삭제', role: 'destructive' },
              ],
              menuActions: [
                { id: 'rename', title: '이름 변경' },
                { id: 'change-color', title: '색상 변경' },
                { id: 'delete', title: '삭제', role: 'destructive' },
              ],
            },
            {
              kind: 'interactiveCategory',
              id: 'health',
              title: '건강',
              subtitle: '7개 일정',
              reorderable: true,
              swipeActions: [{ id: 'archive', title: '보관' }],
              menuActions: [
                { id: 'rename', title: '이름 변경' },
                { id: 'duplicate', title: '복제' },
              ],
            },
            {
              kind: 'interactiveCategory',
              id: 'travel',
              title: '여행',
              subtitle: '3개 일정',
              reorderable: true,
              swipeActions: [{ id: 'delete', title: '삭제', role: 'destructive' }],
              menuActions: [
                { id: 'rename', title: '이름 변경' },
                { id: 'delete', title: '삭제', role: 'destructive' },
              ],
            },
          ],
        },
      ],
    },
  },
];

export const PICKER_HOST_EXAMPLES: PickerHostCatalogExample[] = [
  {
    id: 'picker-date-time',
    family: 'pickerHost',
    title: 'Picker DateTime',
    description: 'todo form용 iOS grouped inline date/time editor fixture.',
    payload: {
      screenId: 'picker-date-time',
      pickerId: 'default-reminder-picker',
      title: '',
      subtitle: 'todo form / calendar form style',
      valueISO: '2026-03-01T15:00:00.000Z',
      allDay: false,
      allowsAllDay: true,
      expanded: true,
      activeField: 'date',
      temporalConfig: {
        mode: 'dateTime',
        presentation: 'inline',
        locale: 'ko-KR',
        timeZone: 'Asia/Seoul',
        minuteInterval: 5,
      },
    },
  },
  {
    id: 'picker-inline-date',
    family: 'pickerHost',
    title: 'Picker Inline Date',
    description: 'date + inline presentation hint fixture.',
    payload: {
      screenId: 'picker-inline-date',
      pickerId: 'inline-date-picker',
      title: '날짜 선택',
      subtitle: 'date / inline',
      valueISO: '2026-03-21T00:00:00.000Z',
      allDay: true,
      allowsAllDay: true,
      expanded: true,
      activeField: 'date',
      temporalConfig: {
        mode: 'date',
        presentation: 'inline',
        locale: 'ko-KR',
        timeZone: 'Asia/Seoul',
      },
    },
  },
  {
    id: 'picker-countdown',
    family: 'pickerHost',
    title: 'Picker Countdown Timer',
    description: 'countDownTimer fixture.',
    payload: {
      screenId: 'picker-countdown',
      pickerId: 'countdown-picker',
      title: '카운트다운',
      subtitle: 'countDownTimer / compact',
      valueISO: 'PT15M',
      temporalConfig: {
        mode: 'countDownTimer',
        presentation: 'compact',
        minuteInterval: 5,
      },
    },
  },
];

export const CATALOG_EXAMPLES: Record<ScreenKind, CatalogExample[]> = {
  settingsList: SETTINGS_LIST_EXAMPLES,
  selectionList: SELECTION_LIST_EXAMPLES,
  categoryManager: CATEGORY_MANAGER_EXAMPLES,
  pickerHost: PICKER_HOST_EXAMPLES,
};

export function cloneCatalogPayload<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}

export function getCatalogExamples(family: ScreenKind): CatalogExample[] {
  return CATALOG_EXAMPLES[family];
}

export function findSelectionExampleByScreenId(
  screenId: string
): SelectionListCatalogExample | undefined {
  return SELECTION_LIST_EXAMPLES.find((example) => example.payload.screenId === screenId);
}
