# 📋 Todolog 로드맵

**최종 업데이트**: 2026-01-29

---

## ✅ 완료된 기능

### Phase 1: 기본 기능 (2025 Q4)
- [x] 할일 CRUD (생성, 읽기, 수정, 삭제)
- [x] 카테고리 관리
- [x] 반복 일정 (RRULE 기반)
- [x] Google Calendar 동기화
- [x] 오프라인 지원 (AsyncStorage)
- [x] 델타 동기화 (변경사항만 전송)

### Phase 2: 성능 최적화 (2026 Q1)
- [x] 캐시 전략 개선 (3중 캐시 → 단일 캐시)
- [x] Cache-First 패턴 적용
- [x] 성능 개선: 5초 → 0.1ms (50,000배)
- [x] 메모리 사용량 66% 감소
- [x] DebugScreen 성능 테스트 도구 추가

---

## 🚧 진행 중

### Phase 3: 사용자 경험 개선 (2026 Q1)
- [ ] 게스트 모드 (로그인 없이 사용)
  - [ ] 로컬 전용 모드로 앱 사용
  - [ ] 나중에 로그인 시 데이터 마이그레이션
  - [ ] 게스트 → 회원 전환 플로우
- [ ] 다국어 지원 확장
  - [x] 한국어, 영어, 일본어
  - [ ] 중국어 (간체/번체)
  - [ ] 스페인어
- [ ] 다크 모드 개선
  - [x] 기본 다크 모드
  - [ ] 색상 테마 커스터마이징

---

## 📅 계획된 기능

### Phase 4: 고급 기능 (2026 Q2)
- [ ] 할일 공유 기능
  - [ ] 가족/팀원과 할일 공유
  - [ ] 권한 관리 (읽기/쓰기)
  - [ ] 실시간 동기화
- [ ] 알림 개선
  - [x] 기본 푸시 알림
  - [ ] 스마트 알림 (위치 기반, 시간 기반)
  - [ ] 반복 알림 커스터마이징
- [ ] 위젯 지원
  - [ ] iOS 홈 화면 위젯
  - [ ] Android 홈 화면 위젯
  - [ ] 잠금 화면 위젯

### Phase 5: AI 기능 (2026 Q3)
- [ ] 자연어 입력
  - [ ] "내일 오후 3시에 회의" → 자동 파싱
  - [ ] 음성 입력 지원
- [ ] 스마트 추천
  - [ ] 할일 우선순위 자동 제안
  - [ ] 최적 시간대 추천
  - [ ] 반복 패턴 학습
- [ ] 생산성 분석
  - [ ] 완료율 통계
  - [ ] 시간대별 생산성 분석
  - [ ] 주간/월간 리포트

### Phase 6: 통합 기능 (2026 Q4)
- [ ] 다른 캘린더 서비스 지원
  - [x] Google Calendar
  - [ ] Apple Calendar (iCloud)
  - [ ] Outlook Calendar
  - [ ] Notion Calendar
- [ ] 써드파티 통합
  - [ ] Slack 알림
  - [ ] Discord 알림
  - [ ] Zapier 연동
- [ ] 웹 버전
  - [ ] React 웹 앱
  - [ ] 데스크톱 앱 (Electron)

---

## 🔧 기술 부채 & 리팩토링

### 우선순위: 높음
- [ ] TypeScript 마이그레이션
  - [ ] 서버 코드 TypeScript 전환
  - [ ] 클라이언트 코드 TypeScript 전환
- [ ] 테스트 코드 작성
  - [ ] 유닛 테스트 (Jest)
  - [ ] E2E 테스트 (Detox)
  - [ ] API 테스트 (Supertest)

### 우선순위: 중간
- [ ] 에러 핸들링 개선
  - [ ] Sentry 통합
  - [ ] 에러 로깅 체계화
  - [ ] 사용자 친화적 에러 메시지
- [ ] 코드 품질 개선
  - [ ] ESLint 설정 강화
  - [ ] Prettier 자동 포맷팅
  - [ ] Husky pre-commit 훅

### 우선순위: 낮음
- [ ] 문서화 개선
  - [x] README.md 업데이트
  - [x] 아키텍처 문서 작성
  - [ ] API 문서 자동 생성 (Swagger)
  - [ ] 컴포넌트 스토리북

---

## 💡 아이디어 백로그

### 사용자 요청 기능
- [ ] 할일 템플릿 (자주 쓰는 할일 저장)
- [ ] 포모도로 타이머 통합
- [ ] 습관 트래커
- [ ] 목표 설정 및 추적
- [ ] 서브태스크 (할일 안에 할일)

### 실험적 기능
- [ ] 오프라인 AI (로컬 LLM)
- [ ] AR 할일 표시 (공간 컴퓨팅)
- [ ] 웨어러블 지원 (Apple Watch, Galaxy Watch)
- [ ] 음성 어시스턴트 통합 (Siri, Google Assistant)

---

## 🎯 2026년 목표

### Q1 (1-3월)
- ✅ Cache-First 최적화 완료
- 🚧 게스트 모드 구현
- 🚧 다국어 지원 확장

### Q2 (4-6월)
- 할일 공유 기능
- 알림 개선
- 위젯 지원

### Q3 (7-9월)
- AI 기능 (자연어 입력, 스마트 추천)
- 생산성 분석

### Q4 (10-12월)
- 다른 캘린더 서비스 지원
- 써드파티 통합
- 웹 버전 출시

---

## 📝 참고 사항

### 게스트 모드 구현 계획

**목표**: 로그인 없이 앱 사용 가능, 나중에 로그인 시 데이터 마이그레이션

**구현 단계**:
1. **로그인 화면 수정**
   - "로그인 없이 사용" 버튼 추가
   - 게스트 모드 설명 추가

2. **게스트 상태 관리**
   ```javascript
   // authStore.js
   const useAuthStore = create((set) => ({
     user: null,
     isGuest: false,
     setGuestMode: () => set({ isGuest: true }),
   }));
   ```

3. **데이터 분리**
   - 게스트 데이터: `AsyncStorage` 키에 `guest_` 접두사
   - 회원 데이터: 기존 키 유지

4. **마이그레이션 플로우**
   ```javascript
   // 게스트 → 회원 전환 시
   const migrateGuestData = async (userId) => {
     const guestTodos = await loadTodos('guest_');
     await todoAPI.bulkCreate(guestTodos);
     await clearGuestData();
   };
   ```

5. **UI/UX 고려사항**
   - 게스트 모드 배너 표시
   - 동기화 불가 안내
   - 로그인 유도 (데이터 백업 강조)

**예상 소요 시간**: 2-3일

**우선순위**: 높음 (사용자 진입 장벽 낮춤)

---

## 🔗 관련 문서

- [README.md](../../README.md) - 프로젝트 개요
- [CACHE_STRATEGY_ANALYSIS.md](./CACHE_STRATEGY_ANALYSIS.md) - 캐시 전략 분석
- [CACHE_FIRST_IMPLEMENTATION_COMPLETE.md](./CACHE_FIRST_IMPLEMENTATION_COMPLETE.md) - Cache-First 구현 완료
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 아키텍처 상세 문서 (예정)
