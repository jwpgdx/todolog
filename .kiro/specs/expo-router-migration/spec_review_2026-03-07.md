# Spec Review: Expo Router Migration

**Reviewer:** External review (LLM)
**Date:** 2026-03-07
**Documents reviewed:**
1. `requirements.md`
2. `design.md`
3. `tasks.md`

---

## 1) Findings triage

### Summary

- Critical: 없음
- High: 없음
- Medium/Low 성격의 “구현 착수 전 문서/엔트리 정합성” 이슈들만 존재

### Must-fix (처리 완료)

1. **`GestureHandlerRootView` 적용**
   - 왜: gesture/bottom-sheet/action-sheet 계열의 루트 요구사항 충족
   - 처리: `client/app/_layout.js`에 `GestureHandlerRootView`를 루트로 적용

2. **Root provider 순서/구성 문서화 + 구현 일치**
   - 왜: expo-router entry 전환 시 provider/side-effect가 분산되면 초기화/라우팅 플리커 발생 위험
   - 처리: `client/app/_layout.js`로 provider/side-effect를 이관하고, `design.md`에 최종 구조를 명시

3. **`CategoryForm -> CategoryColor` “발신 측 callback param” 제거**
   - 왜: Expo Router에서 function/callback param 기반 네비게이션은 직렬화 불가(웹 포함)로 blocker
   - 처리: `client/src/store/categoryFormDraftStore` 기반으로 교체, `client/app/(app)/category/color.js` route로 연결

4. **Route 파일 `.js` 확장자 정책 준수**
   - 왜: 라우트 엔트리/번들링/팀 컨벤션 정합성 유지
   - 처리: `client/app/` 하위 route 파일을 `.js`로 유지 (spec에 명시)

5. **Debug / CalendarServiceTest canonical route 정리**
   - 왜: 기존 route-name 기반 스크린들을 file-based route로 일관된 canonical path로 고정 필요
   - 처리: 탭 route로 `client/app/(app)/(tabs)/debug.js`, `client/app/(app)/(tabs)/test.js`를 canonical로 문서/구현 반영

### Optional / Reject

- Optional: 없음
- Reject: 없음

---

## 2) Implementation snapshot

- Code + docs shipped in commit `4c98148` (branch `main`).

