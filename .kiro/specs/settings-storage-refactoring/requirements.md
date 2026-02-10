# Requirements: Settings Storage 통합 리팩토링

**작성일:** 2026-02-10  
**상태:** Draft  
**우선순위:** High

---

## 1. Problem Statement

### 1.1 현재 문제

사용자 설정(Settings)이 2개의 독립적인 저장소에 분리되어 있어, 설정 변경이 일부 컴포넌트에 반영되지 않는 심각한 버그가 발생하고 있습니다.

**이중 저장 구조:**
1. **AsyncStorage `@user`** (authStore 관리)
   - 저장 시점: 로그인 시, setAuth() 호출 시
   - 사용 위치: CalendarScreen, UltimateCalendar, App.js 등 6개 파일

2. **AsyncStorage `@userSettings`** (settingsStorage 관리)
   - 저장 시점: 설정 변경 시 (useUpdateSetting Hook)
   - 사용 위치: SettingsScreen, useSettings Hook

**발생하는 버그:**
- ❌ SettingsScreen에서 시작 요일 변경 → CalendarScreen에 반영 안됨
- ❌ 테마 변경 → App.js에 반영 안됨 (앱 재시작 필요)
- ❌ 기본 하루종일 설정 변경 → TodoForm에 반영 안됨
- ❌ 타임존 설정 변경 → useTimeZone Hook에 반영 안됨

### 1.2 Offline-First 아키텍처 위반

현재 구조는 Offline-First 원칙을 위반합니다:
- 설정은 로컬에서 즉시 변경되어야 함
- 서버는 선택사항 (동기화용)
- 단일 저장소에서 관리되어야 함

---

## 2. User Stories

### US-1: 설정 변경 즉시 반영
**As a** 사용자  
**I want** 설정을 변경하면 모든 화면에 즉시 반영되기를  
**So that** 앱을 재시작하지 않아도 변경사항을 확인할 수 있다

**Acceptance Criteria:**
- AC-1.1: SettingsScreen에서 시작 요일 변경 시 CalendarScreen에 즉시 반영
- AC-1.2: 테마 변경 시 App.js에 즉시 반영
- AC-1.3: 기본 하루종일 설정 변경 시 TodoForm에 즉시 반영
- AC-1.4: 타임존 설정 변경 시 useTimeZone Hook에 즉시 반영

### US-2: 오프라인 설정 변경
**As a** 오프라인 사용자  
**I want** 네트워크 없이도 설정을 변경할 수 있기를  
**So that** 언제든지 앱을 내 취향대로 사용할 수 있다

**Acceptance Criteria:**
- AC-2.1: 오프라인에서 설정 변경 시 로컬에 즉시 저장
- AC-2.2: 온라인 복귀 시 서버에 자동 동기화
- AC-2.3: 동기화 실패 시 로컬 설정 유지

### US-3: 로그인 시 서버 설정 동기화
**As a** 다른 기기에서 로그인하는 사용자  
**I want** 로그인 시 서버에 저장된 설정을 가져오기를  
**So that** 모든 기기에서 동일한 설정을 사용할 수 있다

**Acceptance Criteria:**
- AC-3.1: 로그인 시 서버에서 user.settings 가져오기
- AC-3.2: 로컬 설정과 서버 설정 병합 (서버 우선)
- AC-3.3: 게스트 모드에서는 로컬 설정만 사용

---

## 3. Acceptance Criteria (통합)

### AC-1: 단일 저장소 원칙
- AC-1.1: 모든 설정은 `authStore.user.settings`에만 저장
- AC-1.2: `settingsStorage.js` 파일 제거
- AC-1.3: AsyncStorage `@userSettings` 키 사용 안함

### AC-2: 즉시 반영
- AC-2.1: 설정 변경 시 authStore 즉시 업데이트
- AC-2.2: authStore 구독 컴포넌트 자동 재렌더링
- AC-2.3: 앱 재시작 불필요

### AC-3: Offline-First
- AC-3.1: 오프라인에서 설정 변경 가능
- AC-3.2: 로컬 우선, 서버는 동기화용
- AC-3.3: 네트워크 에러 시 로컬 설정 유지

### AC-4: 서버 동기화
- AC-4.1: 온라인일 때 서버 API 호출
- AC-4.2: 서버 응답으로 최종 업데이트
- AC-4.3: 동기화 실패 시 재시도 (선택사항)

### AC-5: 하위 호환성
- AC-5.1: 기존 `@user` 데이터 마이그레이션
- AC-5.2: 기존 `@userSettings` 데이터 병합
- AC-5.3: 마이그레이션 후 `@userSettings` 삭제

---

## 4. Glossary

| 용어 | 정의 |
|------|------|
| **authStore** | Zustand 기반 인증 상태 관리 스토어 |
| **settingsStorage** | AsyncStorage 기반 설정 저장 유틸리티 (제거 예정) |
| **user.settings** | 사용자 설정 객체 (theme, language, startDayOfWeek 등) |
| **Offline-First** | 로컬 데이터 우선, 서버는 동기화용 아키텍처 |
| **Optimistic Update** | 서버 응답 전 로컬 즉시 업데이트 |

---

## 5. Non-Functional Requirements

### 5.1 Performance
- NFR-1: 설정 변경 후 UI 반영 시간 < 100ms
- NFR-2: AsyncStorage 읽기/쓰기 < 50ms

### 5.2 Reliability
- NFR-3: 오프라인에서 100% 동작
- NFR-4: 설정 손실 0% (로컬 저장 보장)

### 5.3 Maintainability
- NFR-5: 단일 저장소로 코드 복잡도 감소
- NFR-6: 명확한 데이터 흐름

---

## 6. Out of Scope

다음 항목은 이번 리팩토링 범위에 포함되지 않습니다:

- ❌ SQLite로 설정 저장 (AsyncStorage 유지)
- ❌ 설정 동기화 큐 구현 (단순 재시도)
- ❌ 설정 변경 히스토리 추적
- ❌ 다중 기기 실시간 동기화

---

## 7. Dependencies

### 7.1 기존 시스템
- authStore (Zustand)
- AsyncStorage (@react-native-async-storage/async-storage)
- React Query (useSettings Hook)
- Expo Crypto (UUID 생성)

### 7.2 영향 받는 컴포넌트 (10개)

**useSettings/useUpdateSetting을 직접 사용하는 파일:**

1. `client/src/screens/SettingsScreen.js` - 메인 설정 화면
2. `client/src/screens/settings/ThemeSettingsScreen.js` - 테마 설정 ⚠️ 추가
3. `client/src/screens/settings/TimeZoneSettingsScreen.js` - 타임존 설정 ⚠️ 추가
4. `client/src/screens/settings/LanguageSettingsScreen.js` - 언어 설정 ⚠️ 추가
5. `client/src/screens/settings/StartDaySettingsScreen.js` - 시작 요일 설정 ⚠️ 추가
6. `client/src/features/todo/form/useTodoFormLogic.js` - defaultIsAllDay 사용
7. `client/src/features/todo/form/components/DetailedForm.js` - 캘린더 동기화 토글 ⚠️ 추가
8. `client/src/hooks/useTimeZone.js` - timeZone, timeZoneAuto 사용

**authStore.user.settings를 직접 사용하는 파일:**

9. `client/src/screens/CalendarScreen.js` - startDayOfWeek 사용
10. `client/src/components/ui/ultimate-calendar/UltimateCalendar.js` - startDayOfWeek 사용
11. `client/App.js` - theme, language 사용

**⚠️ 중요:** 
- useSettings 반환 인터페이스(`data`, `isLoading`, `isError`)를 유지하면 설정 하위 화면들은 수정 불필요
- React Query 전용 메서드(`refetch`, `status` 등)는 제거되므로 사용처 확인 필요

### 7.3 수정 필요 파일 (3개)

1. `client/src/store/authStore.js` - updateSettings 메서드 추가, loadAuth 마이그레이션 로직 추가
2. `client/src/hooks/queries/useSettings.js` - authStore 기반으로 전면 수정
3. `client/src/storage/settingsStorage.js` - 삭제 예정

### 7.4 제거 대상 (미사용 함수)

- `useUpdateSettings` (복수형) - 실제 사용처 없음, 삭제 예정

---

## 8. Risks & Mitigation

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| 기존 사용자 설정 손실 | High | 마이그레이션 로직 구현 |
| 컴포넌트 재렌더링 과다 | Medium | Zustand selector 최적화 |
| 서버 동기화 실패 | Low | 로컬 설정 유지, 재시도 |
| 하위 호환성 문제 | Medium | 점진적 마이그레이션 |

---

## 9. Success Metrics

### 9.1 기능 지표
- ✅ 설정 변경 즉시 반영률: 100%
- ✅ 오프라인 설정 변경 성공률: 100%
- ✅ 마이그레이션 성공률: 100%

### 9.2 코드 지표
- ✅ 중복 코드 제거: settingsStorage.js 삭제
- ✅ 파일 수 감소: 1개 (settingsStorage.js)
- ✅ 코드 라인 감소: ~100줄

---

## 10. Testing Strategy

### 10.1 Manual Test Cases

**Test Case 1: 설정 변경 즉시 반영**
- SettingsScreen에서 시작 요일 변경 (일요일 → 월요일)
- CalendarScreen 열기
- ✅ 월요일부터 시작하는지 확인

**Test Case 2: 오프라인 설정 변경**
- 네트워크 끄기
- SettingsScreen에서 테마 변경 (시스템 → 다크)
- ✅ 앱 테마가 즉시 변경되는지 확인
- 네트워크 켜기
- ✅ 서버에 동기화되는지 확인

**Test Case 3: 로그인/로그아웃**
- 로그아웃
- 로그인
- ✅ 서버에서 가져온 settings가 적용되는지 확인

**Test Case 4: 게스트 모드**
- 게스트로 로그인
- 설정 변경
- ✅ 로컬에만 저장되고 서버 호출 안하는지 확인

### 10.2 Regression Test

모든 설정 항목에 대해 변경 후 즉시 반영 확인:
- theme (시스템/라이트/다크)
- language (시스템/한국어/영어/일본어)
- startDayOfWeek (일요일/월요일)
- showCompleted (true/false)
- calendarSyncEnabled (true/false)
- timeZone (Asia/Seoul 등)
- timeZoneAuto (true/false)
- defaultIsAllDay (true/false)
- notification (알림 설정 객체)

---

**작성자:** Kiro AI Assistant  
**검토자:** (개발자님 검토 필요)  
**승인자:** (개발자님 승인 필요)
