# Categories Cache-First 테스트 가이드

## 🧪 테스트 시나리오

### 시나리오 1: 온라인 정상 작동 테스트
**목적**: Cache-First 전략이 정상 작동하는지 확인

**단계**:
1. 앱 재시작
2. 콘솔 로그 확인

**예상 로그**:
```
⚡ [useSyncTodos] 초기 Todos 캐시 준비: X개
⚡ [useSyncTodos] 초기 Categories 캐시 준비: X개
⚡ [useAllTodos] 캐시 즉시 반환: X개
⚡ [useCategories] 캐시 즉시 반환: X개
🔄 [useAllTodos] 백그라운드 업데이트 완료
🔄 [useCategories] 백그라운드 업데이트 완료
```

**확인 사항**:
- ✅ UltimateCalendar 이벤트 dot 색상 정상 표시
- ✅ 회색 dot 없음
- ✅ 첫 렌더링부터 올바른 색상

---

### 시나리오 2: 오프라인 테스트
**목적**: 오프라인 시에도 색상이 정상 표시되는지 확인

**단계**:
1. 비행기 모드 활성화 (또는 Wi-Fi 끄기)
2. 앱 재시작
3. 콘솔 로그 확인

**예상 로그**:
```
⚡ [useSyncTodos] 초기 Todos 캐시 준비: X개
⚡ [useSyncTodos] 초기 Categories 캐시 준비: X개
⚡ [useAllTodos] 캐시 즉시 반환: X개
⚡ [useCategories] 캐시 즉시 반환: X개
📵 [useSyncTodos] 오프라인 - 로컬 데이터만 사용
```

**확인 사항**:
- ✅ UltimateCalendar 이벤트 dot 색상 정상 표시
- ✅ 회색 dot 없음
- ✅ 오프라인 상태에서도 정상 작동

---

### 시나리오 3: 서버 다운 테스트
**목적**: 서버가 다운되어도 AsyncStorage fallback이 작동하는지 확인

**단계**:
1. 서버 중지 (server 폴더에서 Ctrl+C)
2. 앱 재시작
3. 콘솔 로그 확인

**예상 로그**:
```
⚡ [useSyncTodos] 초기 Todos 캐시 준비: X개
⚡ [useSyncTodos] 초기 Categories 캐시 준비: X개
⚡ [useAllTodos] 캐시 즉시 반환: X개
⚡ [useCategories] 캐시 즉시 반환: X개
⚠️ [useSyncTodos] 서버 요청 실패 - AsyncStorage 확인
```

**확인 사항**:
- ✅ UltimateCalendar 이벤트 dot 색상 정상 표시
- ✅ 회색 dot 없음
- ✅ 서버 다운 시에도 정상 작동

---

### 시나리오 4: 캐시 없는 상태 테스트 (최초 설치)
**목적**: AsyncStorage도 없고 캐시도 없을 때 서버에서 정상 로드되는지 확인

**단계**:
1. AsyncStorage 초기화 (앱 삭제 후 재설치)
2. 로그인
3. 콘솔 로그 확인

**예상 로그**:
```
⚠️ [useSyncTodos] 로컬 Todos 없음
⚠️ [useSyncTodos] 로컬 Categories 없음
🌐 [useAllTodos] 캐시 없음 - 서버 요청
🌐 [useCategories] 캐시 없음 - 서버 요청
✅ [useSyncTodos] 최초 동기화 완료: X개
```

**확인 사항**:
- ✅ 서버에서 데이터 로드 후 색상 정상 표시
- ✅ AsyncStorage에 저장됨
- ✅ 다음 실행 시 캐시 사용

---

## 📝 DebugScreen 테스트 버튼 사용법

### 1. 캐시 상태 확인
```
버튼: "💾 캐시 확인"
```
- Todos 캐시 개수 확인
- Categories 캐시 개수 확인

### 2. 로컬 저장소 확인
```
버튼: "📦 로컬 저장소"
```
- AsyncStorage Todos 개수 확인
- AsyncStorage Categories 개수 확인 (추가 필요)

### 3. 네트워크 상태 확인
```
버튼: "🌐 네트워크 상태"
```
- 온라인/오프라인 상태 확인

### 4. 캐시 클리어 (테스트용)
```
버튼: "💾 캐시만 클리어"
```
- React Query 캐시만 클리어
- AsyncStorage는 유지
- 오프라인 최초 실행 시뮬레이션에 사용

### 5. 강제 전체 동기화
```
버튼: "🔄 강제 전체 동기화"
```
- 서버에서 전체 데이터 다시 로드
- AsyncStorage 업데이트
- 캐시 업데이트

---

## 🎯 테스트 순서 (권장)

### Phase 1: 온라인 테스트
1. 앱 재시작
2. 콘솔 로그 확인
3. UltimateCalendar 색상 확인
4. DebugScreen → "💾 캐시 확인" 버튼 클릭
5. DebugScreen → "📦 로컬 저장소" 버튼 클릭

### Phase 2: 오프라인 테스트
1. 비행기 모드 활성화
2. 앱 재시작
3. 콘솔 로그 확인
4. UltimateCalendar 색상 확인
5. DebugScreen → "🌐 네트워크 상태" 버튼 클릭

### Phase 3: 서버 다운 테스트
1. 서버 중지 (server 폴더에서 Ctrl+C)
2. 앱 재시작
3. 콘솔 로그 확인
4. UltimateCalendar 색상 확인
5. 서버 재시작

### Phase 4: 캐시 없는 상태 테스트
1. DebugScreen → "💾 캐시만 클리어" 버튼 클릭
2. 앱 재시작
3. 콘솔 로그 확인
4. UltimateCalendar 색상 확인

---

## 🔍 로그 분석 가이드

### 정상 로그 패턴
```
⚡ [useSyncTodos] 초기 Todos 캐시 준비: 50개
⚡ [useSyncTodos] 초기 Categories 캐시 준비: 5개
⚡ [useAllTodos] 캐시 즉시 반환: 50개
⚡ [useCategories] 캐시 즉시 반환: 5개
```
→ ✅ 정상: 캐시 히트, 즉시 반환

### 오프라인 로그 패턴
```
⚡ [useSyncTodos] 초기 Todos 캐시 준비: 50개
⚡ [useSyncTodos] 초기 Categories 캐시 준비: 5개
⚡ [useAllTodos] 캐시 즉시 반환: 50개
⚡ [useCategories] 캐시 즉시 반환: 5개
📵 [useSyncTodos] 오프라인 - 로컬 데이터만 사용
```
→ ✅ 정상: 오프라인에서도 캐시 사용

### 서버 다운 로그 패턴
```
⚡ [useSyncTodos] 초기 Todos 캐시 준비: 50개
⚡ [useSyncTodos] 초기 Categories 캐시 준비: 5개
⚡ [useAllTodos] 캐시 즉시 반환: 50개
⚡ [useCategories] 캐시 즉시 반환: 5개
⚠️ [useSyncTodos] 서버 요청 실패 - AsyncStorage 확인
```
→ ✅ 정상: 서버 다운 시 AsyncStorage fallback

### 캐시 없는 상태 로그 패턴
```
⚠️ [useSyncTodos] 로컬 Todos 없음
⚠️ [useSyncTodos] 로컬 Categories 없음
🌐 [useAllTodos] 캐시 없음 - 서버 요청
🌐 [useCategories] 캐시 없음 - 서버 요청
✅ [useSyncTodos] 최초 동기화 완료: 50개
```
→ ✅ 정상: 서버에서 로드 후 캐시 저장

### 문제 로그 패턴
```
⚡ [useSyncTodos] 초기 Todos 캐시 준비: 50개
⚠️ [useSyncTodos] 로컬 Categories 없음
⚡ [useAllTodos] 캐시 즉시 반환: 50개
🌐 [useCategories] 캐시 없음 - 서버 요청
```
→ ❌ 문제: Categories가 AsyncStorage에 없음

---

## 📊 성능 목표

### 초기 로딩
- **목표**: 0ms (캐시 히트)
- **허용**: 5ms 이하
- **문제**: 10ms 이상

### 백그라운드 업데이트
- **목표**: 사용자 경험 방해 없음
- **허용**: 비동기 실행
- **문제**: 동기 실행 (블로킹)

### 오프라인 대응
- **목표**: 즉시 표시 (캐시 사용)
- **허용**: AsyncStorage fallback (10ms 이하)
- **문제**: 빈 화면 또는 회색 dot

---

## ✅ 성공 기준

1. **온라인**: 첫 렌더링부터 올바른 색상 표시
2. **오프라인**: 캐시 사용하여 즉시 색상 표시
3. **서버 다운**: AsyncStorage fallback으로 색상 표시
4. **캐시 없음**: 서버에서 로드 후 색상 표시
5. **성능**: 초기 로딩 5ms 이하
6. **안정성**: 회색 dot 없음

---

## 🐛 문제 해결

### 문제 1: 회색 dot 표시
**원인**: Categories 캐시 없음
**해결**: 
1. DebugScreen → "💾 캐시 확인" 버튼 클릭
2. Categories 캐시 개수 확인
3. 0개면 "🔄 강제 전체 동기화" 버튼 클릭

### 문제 2: 오프라인 시 색상 없음
**원인**: AsyncStorage에 Categories 없음
**해결**:
1. 온라인 상태에서 앱 실행
2. "🔄 강제 전체 동기화" 버튼 클릭
3. AsyncStorage에 저장 확인
4. 오프라인 전환 후 재테스트

### 문제 3: 서버 다운 시 색상 없음
**원인**: AsyncStorage fallback 실패
**해결**:
1. useCategories queryFn 코드 확인
2. try-catch 블록 확인
3. loadCategories() 호출 확인

---

## 📝 테스트 체크리스트

- [ ] 온라인 정상 작동
- [ ] 오프라인 정상 작동
- [ ] 서버 다운 정상 작동
- [ ] 캐시 없는 상태 정상 작동
- [ ] 첫 렌더링 색상 정상
- [ ] 회색 dot 없음
- [ ] 성능 목표 달성 (5ms 이하)
- [ ] 백그라운드 업데이트 정상
- [ ] AsyncStorage 저장 확인
- [ ] 캐시 히트 확인
