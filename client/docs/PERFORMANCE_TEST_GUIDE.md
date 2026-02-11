# 성능 테스트 실행 가이드

## 🚀 테스트 준비

### 1. 앱 실행
```bash
cd client
npm start
```

### 2. 테스트 화면 접근
1. 앱 실행 후 **Settings (설정)** 탭 이동
2. 하단 "개발자 테스트" 섹션에서 **"📊 캘린더 성능 벤치마크"** 클릭

---

## 📊 벤치마크 테스트 실행

### Test 1: 초기화 성능
**목표**: < 10ms

1. **"Test 1: 초기화"** 버튼 클릭
2. 결과 확인:
   - 초기화 시간: **X.XX ms**
   - 생성된 월 수: **5개월**
   - Pass/Fail: ✅ < 10ms

### Test 2: 미래 월 추가 성능
**목표**: 평균 < 5ms, 최대 < 10ms

1. **"Test 2: 미래 월"** 버튼 클릭
2. 결과 확인:
   - 평균 시간: **X.XX ms**
   - 최대 시간: **X.XX ms**
   - 총 월 수: **65개월**
   - Pass/Fail: ✅ 평균 < 5ms

### Test 3: 과거 월 추가 성능
**목표**: 평균 < 5ms, 최대 < 10ms

1. **"Test 3: 과거 월"** 버튼 클릭
2. 결과 확인:
   - 평균 시간: **X.XX ms**
   - 최대 시간: **X.XX ms**
   - 총 월 수: **65개월**
   - Pass/Fail: ✅ 평균 < 5ms

### Test 4: 메모리 사용량
**목표**: 100개월 < 100KB

1. **"Test 4: 메모리"** 버튼 클릭
2. 결과 확인:
   - 5개월: **X.XX KB**
   - 50개월: **X.XX KB**
   - 100개월: **X.XX KB** (자동 Trim → 50개월 유지)
   - Pass/Fail: ✅ < 100KB

### Test 5: 100개월 시뮬레이션
**목표**: 총 소요 시간 < 100ms

1. **"Test 5: 100개월"** 버튼 클릭
2. 결과 확인:
   - 초기화: **X.XX ms**
   - 미래 50개월 추가: **X.XX ms**
   - 과거 50개월 추가: **X.XX ms**
   - 총 소요 시간: **X.XX ms**
   - 총 월 수: **100개월** (자동 Trim 발동 가능)
   - 상태 크기: **X.XX KB**
   - Pass/Fail: ✅ < 100ms

### 전체 테스트 실행
1. **"🚀 전체 실행"** 버튼 클릭
2. 모든 테스트 결과 확인

---

## 🎯 실제 캘린더 스크롤 테스트

### 1. 캘린더 화면 접근
1. Settings → **"무한 스크롤 캘린더 테스트"** 클릭
2. TodoCalendar 화면 진입

### 2. 하단 스크롤 테스트
**목표**: 빈 화면 없음, 60fps 유지

1. **빠르게 아래로 스크롤** (100개월 이상)
2. 확인 사항:
   - ✅ 빈 화면 없음 (drawDistance=960 효과)
   - ✅ 60fps 유지 (부드러운 스크롤)
   - ✅ 콘솔 로그 확인:
     ```
     [useInfiniteCalendar] Add 6 future months: X.XX ms
     ```

### 3. 상단 스크롤 테스트
**목표**: 화면 점프 없음

1. **빠르게 위로 스크롤** (과거 월)
2. 확인 사항:
   - ✅ 화면 점프 없음 (maintainVisibleContentPosition 효과)
   - ✅ 과거 월이 자연스럽게 추가됨
   - ✅ 콘솔 로그 확인:
     ```
     [useInfiniteCalendar] Add 6 past months: X.XX ms
     ```

### 4. 메모리 제한 테스트
**목표**: 100개월 초과 시 자동 Trim

1. **계속 스크롤하여 100개월 초과**
2. 콘솔 로그 확인:
   ```
   [CalendarStore] Memory limit exceeded (105 months), trimming to 50 months
   ```

---

## 📱 Expo Performance Monitor 확인

### 1. 활성화
- **iOS Simulator**: Cmd + D → "Show Performance Monitor"
- **Android Emulator**: Cmd + M → "Show Performance Monitor"
- **실제 디바이스**: 디바이스 흔들기 → "Show Performance Monitor"

### 2. 확인 항목
- **JS FPS**: 60fps 유지 확인
- **UI FPS**: 60fps 유지 확인
- **RAM**: 메모리 사용량 안정적 유지

---

## 📝 테스트 결과 보고 양식

```markdown
## 성능 벤치마크 결과

### 환경
- 디바이스: [iOS/Android/Simulator]
- OS 버전: [예: iOS 17.2]
- React Native 버전: 0.76.5
- Expo SDK: 52

### Test 1: 초기화
- 초기화 시간: [X.XX] ms
- Pass/Fail: [✅/❌]

### Test 2: 미래 월 추가
- 평균 시간: [X.XX] ms
- 최대 시간: [X.XX] ms
- Pass/Fail: [✅/❌]

### Test 3: 과거 월 추가
- 평균 시간: [X.XX] ms
- 최대 시간: [X.XX] ms
- Pass/Fail: [✅/❌]

### Test 4: 메모리 사용량
- 5개월: [X.XX] KB
- 50개월: [X.XX] KB
- 100개월: [X.XX] KB
- Pass/Fail: [✅/❌]

### Test 5: 100개월 시뮬레이션
- 총 소요 시간: [X.XX] ms
- Pass/Fail: [✅/❌]

### 실제 스크롤 테스트
- 빠른 스크롤: [빈 화면 없음/있음]
- 상단 스크롤: [점프 없음/있음]
- Pass/Fail: [✅/❌]

### Expo Performance Monitor
- JS FPS: [XX] fps
- UI FPS: [XX] fps
- RAM: [XXX] MB

### 종합 평가
- 전체 Pass/Fail: [✅/❌]
- 추가 의견: [...]
```

---

## ✅ Pass 기준

| Metric | 목표 | Pass 기준 |
|--------|------|-----------|
| 초기화 | < 10ms | ✅ |
| 월 추가 평균 | < 5ms | ✅ |
| 100개월 시뮬레이션 | < 100ms | ✅ |
| 메모리 사용량 | < 100KB | ✅ |
| 빠른 스크롤 | 빈 화면 없음 | ✅ |
| 상단 스크롤 | 화면 점프 없음 | ✅ |
| FPS | 60fps | ✅ |

**전체 Pass 조건**: 위 7가지 항목 모두 ✅

---

## 🔧 Fail 시 조치

### 초기화 > 10ms
- `generateWeeks()` 함수 최적화 필요
- Day.js 연산 최소화

### 월 추가 > 5ms
- Zustand 상태 업데이트 최적화
- 배열 연산 최적화

### 빈 화면 발생
- `drawDistance` 증가 (960 → 1440)
- `estimatedItemSize` 정확도 확인

### 화면 점프 발생
- `maintainVisibleContentPosition` 설정 확인
- `minIndexForVisible` 값 조정

### FPS < 60
- React.memo 적용 확인
- 불필요한 리렌더링 제거
- useMemo/useCallback 최적화

---

## 📚 참고 문서

- **INFINITE_SCROLL_CALENDAR_FINAL_CHECKPOINT.md**: 최종 Checkpoint 보고서
- **TASK_14_PERFORMANCE_VERIFICATION.md**: 검증 절차 상세
- **CALENDAR_PERFORMANCE_GUIDE.md**: 최적화 가이드

---

**작성일**: 2025-02-03  
**버전**: 1.0.0
