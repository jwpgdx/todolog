# Implementation Order

Last Updated: 2026-05-03
Status: In Progress

## Phase 1. Order Schema 실제 반영

- 상태: 완료
- SQLite 컬럼 추가
  - `categories.order_index`
  - `todos.custom_order`
  - `todos.category_order`
  - `todos.favorite_order`
- 서버 스키마 / DTO 반영
  - `category.order`
  - `todo.order.custom`
  - `todo.order.category`
  - `todo.order.favorite`
- sync payload / patch 구조 반영
- reorder 저장 로직 정리

## Phase 2. NativeManagedList iOS 기준본 마무리

- 상태: 다음 작업
- `NativeManagedList` 계약(contract) 고정
- iOS 기준 구현 안정화
- `My Page` 카테고리 안정화
- todo용 wrapper 방향 정리
- category / todo / favorite가 같은 iOS 엔진을 타도록 구조 정리

## Phase 3. iOS 화면 적용

- 상태: 대기
- `TODO SCREEN`
  - 정렬 모드 `시간순 / 사용자 지정 / 카테고리별 순서` UI 교체
  - 마지막 선택값 로컬 저장 / 복원
- `CATEGORY SCREEN`
- `ALL TODOS SCREEN`
- `FAVORITE SCREEN`

## Phase 4. 즐겨찾기 기능 추가

- 상태: 대기
- `isFavorite` / `favorite_order` 반영
- 즐겨찾기 토글
- `TODO SCREEN` 상단 즐겨찾기 그룹
- `FAVORITE SCREEN` 구현

## Phase 5. Android 대응

- 상태: 대기
- Android용 `NativeManagedList` 또는 fallback wrapper 구현
- iOS 구조 고정 후 Android UX 별도 적용
- Android UI / gesture 차이 반영
- Android QA

## 메모

- `ORDER_SCHEMA` 코드 반영과 create / category move smoke는 완료됐다.
- 확인 완료:
  - 새 todo 생성 시 `custom_order`, `category_order` 자동 부여
  - 기본 `favorite_order = null`
  - category move 시 `custom_order` 유지
  - category move 시 target category 맨 아래 `category_order` append
  - pending payload에 계산된 `order` 포함
- `NativeManagedList`는 먼저 iOS 기준본을 마무리한다.
- Android는 iOS 구조가 고정된 뒤 별도 구현한다.
- 즐겨찾기 기능은 `favorite_order` 스키마는 반영됐고, 실제 기능/검증은 이후 단계에서 진행한다.

## Verification

1. 서버 초기화
- `node server/src/scripts/resetDevData.js`
- `todos`, `completions`, `categories`를 비우고 각 유저의 `Inbox`를 다시 만든다.

2. 앱 재설치 / 재실행
- 시뮬레이터에 앱을 다시 설치한다.
- 로그인 후 기본 `Inbox`만 존재하는지 확인한다.

3. 카테고리 생성 확인
- `Work`, `Personal` 등 테스트용 카테고리 2개 이상 생성
- `My Page`에서 카테고리 순서와 `Inbox` 고정 동작 확인

4. 일정 생성 smoke test
- 일정 3~4개 생성
- 새 일정 생성 시 `custom_order`가 부여되는지 확인
- category 지정 시 `category_order`가 부여되는지 확인
- 결과: 완료

5. 카테고리 이동 smoke test
- 메뉴 이동 또는 edit form에서 다른 카테고리로 이동
- `category_id`가 바뀌는지 확인
- `category_order`가 target category 맨 아래로 붙는지 확인
- `custom_order`는 유지되는지 확인
- 결과: 완료

6. reorder smoke test
- 카테고리 화면 또는 공통 리스트에서 reorder 1회 수행
- 해당 lane order만 변경되는지 확인
- pending/sync payload에 order가 실리는지 확인
- 상태: `NativeManagedList` todo variant 작업 후 진행

7. TODO SCREEN 정렬 모드 확인
- `시간순`, `사용자 지정`, `카테고리별 순서` 전환 확인
- 마지막 선택값이 로컬에 저장되고 재진입 시 유지되는지 확인
- 상태: 미구현, Phase 3에서 진행
