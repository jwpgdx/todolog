# Zeego Menus (DropdownMenu/ContextMenu) — Tasks

## Task 1: Dependencies

- `client/package.json`에 Zeego 및 필수 peer dependencies 추가
- `client/package-lock.json` 갱신
- (로컬 검증) `npm run web`로 웹 번들링 에러 없는지 확인
- (로컬 검증) iOS/Android는 `npm run ios`, `npm run android`로 빌드 가능 여부 확인

## Task 2: Zeego Test Route

- `client/src/test/ZeegoMenuTestScreen.js` 추가
  - DropdownMenu 샘플
  - ContextMenu 샘플
  - Native gesture playground (`swipe + menu + reorder`)
  - 이벤트 로그 UI 포함
- `client/app/(app)/test/zeego-menu.js` 라우트 추가 (위 스크린 export)

## Task 3 (Optional): Debug Entry Point

- `client/src/screens/DebugScreen.js`에 테스트 화면 진입 버튼 추가:
  - `router.push('/test/zeego-menu')`

## Checkpoints

- Web에서:
  - 페이지 렌더링 성공
  - DropdownMenu 열림/아이템 선택 로그 확인
  - ContextMenu(우클릭) 열림/아이템 선택 로그 확인
- Native(iOS/Android)에서:
  - DropdownMenu 열림/아이템 선택 로그 확인
  - ContextMenu(롱프레스) 열림/아이템 선택 로그 확인
