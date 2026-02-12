# Archive Index

> **Purpose**: Reference for deprecated/replaced implementations  
> **Status**: Do Not Use in Production

## 📦 Archived Projects

### 1. UltimateCalendar (2026-02-12)

**Location**: `client/src/_archive/ultimate-calendar/`

**Reason**: Replaced by new todo-calendar implementation

**Key Issues**:
- 복잡한 주별 스크롤 아키텍처
- SQLite/서버 동기화 시 카테고리 색상 불일치
- 6주 패딩 로직과 이벤트 캐싱 얽힘

**Replacement**: `client/src/features/todo-calendar/`

**Documentation**: See `ultimate-calendar/README.md`

---

### 2. Calendar Test Files (2026-02-12)

**Location**: `client/src/_archive/test/`

**Reason**: Phase 1 (Infinite Scroll Calendar) 테스트 완료

**Archived Files**:
- `CalendarPerformanceBenchmark.js` - 성능 벤치마크
- `CalendarCheckpoint.js` - 체크포인트 검증
- `verifyCalendarCheckpoint.js` - 자동화 검증

**Test Results**: ✅ All tests passed

**Documentation**: See `test/README.md`

---

## 🔍 How to Use This Archive

1. **참고용으로만 사용**: 프로덕션 코드에 사용하지 마세요
2. **새 구현 확인**: 각 아카이브의 README.md에서 새 구현 위치 확인
3. **마이그레이션 가이드**: 아카이브별 Migration Guide 참고

---

## 📝 Archive Guidelines

새 코드를 아카이브할 때:

1. `_archive/{project-name}/` 폴더 생성
2. 관련 파일 모두 이동
3. `README.md` 작성:
   - 아카이브 이유
   - 새 구현 위치
   - 주요 참고 포인트
   - 마이그레이션 가이드
4. 이 파일에 인덱스 추가

---

**Last Updated**: 2026-02-12
