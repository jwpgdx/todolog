# Implementation Order

Last Updated: 2026-05-16
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

- 상태: 진행 중 (핵심 기준본 안정화, polish / 후속 기능 대기)
- `NativeManagedList` 계약(contract) 고정
- iOS 기준 구현 안정화
- `My Page` 카테고리 안정화
- todo용 wrapper 방향 정리
- category / todo / favorite가 같은 iOS 엔진을 타도록 구조 정리
- category-grouped 화면은 custom drag engine 기준으로 정리
- 단일 flat list 화면은 UIKit built-in reorder 기준으로 정리
- Native List 스타일 taxonomy와 iOS preview style resolver 분리 완료

## Phase 3. iOS 화면 적용

- 상태: 진행 중
- `TODO SCREEN`
  - 정렬 모드 `시간순 / 카테고리순` UI 교체
  - 마지막 선택값 로컬 저장 / 복원
  - `시간순`은 시간이 지정된 일정을 시간순으로 상단 고정하고 reorder 불가
  - `시간순`에서 시간이 없는 일정만 하단 영역에서 iOS UIKit built-in reorder 적용
  - `시간순`에서 시간이 없는 일정을 시간 지정 영역으로 drop하면 원위치 복귀
  - `카테고리순`은 category-grouped custom drag engine 유지
  - `카테고리순`은 카테고리 헤더 reorder와 일정 cross-category reorder를 같은 화면에서 지원
  - 상태: 구현 및 수동 검증 완료
- `CATEGORY SCREEN`
  - 단일 카테고리 내부 일정 목록이므로 iOS UIKit built-in reorder 우선 적용
  - 상태: 구현 및 수동 검증 완료
- `ALL TODOS SCREEN`
  - category-grouped custom drag engine 유지
  - 상태: 구현 및 수동 검증 완료
- `FAVORITE SCREEN`
  - 단일 flat list 이므로 iOS UIKit built-in reorder 우선 적용
  - 상태: 구현 및 수동 검증 완료

## Phase 4. 즐겨찾기 기능 추가

- 상태: 핵심 구현 및 수동 검증 완료 (polish / 후속 UX 대기)
- `isFavorite` / `favorite_order` 반영
- 즐겨찾기 토글
- `FAVORITE SCREEN` 구현
  - 상태: 기본 구현 완료, 수동 검증 완료
- `TODO SCREEN` 상단 즐겨찾기 그룹
  - 상태: 구현 및 수동 검증 완료
- `ALL TODOS SCREEN` 상단 즐겨찾기 그룹
  - `TODO SCREEN > 카테고리순`과 같은 top favorites interaction model 재사용
  - 상태: 구현 및 수동 검증 완료
- native custom drag engine 즐겨찾기 drop target
  - 일반 일정 -> 상단 즐겨찾기 drop 시 `favorite_order`만 변경
  - 기존 `categoryId`, `custom_order`, `category_order` 유지
  - 상단 즐겨찾기 -> 일반 목록 drag out 시 `favorite_order = null`
  - 시간순 일반 영역으로 drag out 하면 시간 없는 일정 `custom_order` 위치 반영
  - 카테고리순 / 전체일정 일반 카테고리로 drag out 하면 대상 `categoryId` / `category_order` 위치 반영
  - 상단 즐겨찾기 그룹은 비어 있어도 header를 유지
  - 상단 즐겨찾기 그룹 접힘 / 펼침 상태는 화면별로 저장
  - 접힌 즐겨찾기 / 카테고리에 drop 성공 시 대상 그룹을 펼침 상태로 저장
  - 빈 접힌 그룹은 hover 중 자동 펼침하지 않아도 되지만 drop은 허용
  - 상태: 구현 및 수동 검증 완료

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
- 즐겨찾기 기능은 `favorite_order` 스키마, 화면 표시, drag in/out, 메뉴 해제, reorder 저장까지 반영했고 수동 검증을 완료했다.
- iOS reorder 엔진은 화면 구조에 따라 분리한다.
  - 단일 flat list: UIKit built-in reorder
  - category-grouped list: custom drag engine
- custom drag engine 핵심 UX 수정은 완료했다.
  - 카테고리 header reorder 중 전체 category group 임시 collapse
  - header long-press menu 상태에서 임시 collapse 유지
  - category header drag preview 배경 / shadow 적용
  - todo / category drop indicator full-width 적용
  - drag preview anchor 보정
  - 접힌 카테고리 hover auto-expand hit slop 보정
  - drop 후 자동 펼침 상태 유지
  - 상단 즐겨찾기 그룹 drop target / drag out 처리
  - 빈 즐겨찾기 / 빈 카테고리 drop target 처리
  - 접힌 target section drop 성공 후 펼침 상태 저장
  - cross-category reorder batch optimistic cache 반영
  - native menu action 생성 공통화
  - `group.category` / `list.todo` / `list.header` preview style resolver 분리
  - preview shadow / scale phase factory 공통화
  - category header 일정 개수 표시
  - category header 메뉴의 `카테고리로 이동`
  - menu -> reorder 전환 시 source cell restore 깜빡임 완화
- custom drag engine 후속 polish는 별도 작업으로 둔다.
  - todo / category / header preview 시각 디자인 polish
  - 단, preview 시각 디자인 변경은 명시 요청 전까지 보류한다.

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
- `시간순`, `카테고리순` 전환 확인
- 마지막 선택값이 로컬에 저장되고 재진입 시 유지되는지 확인
- `시간순`에서 시간 지정 일정은 reorder되지 않는지 확인
- `시간순`에서 시간이 없는 일정만 reorder되고 `custom_order`에 반영되는지 확인
- `시간순`에서 시간이 없는 일정을 시간 지정 영역에 넣으면 원위치로 복귀하는지 확인
- `카테고리순`에서 카테고리 헤더 reorder와 일정 cross-category reorder 확인
- 상태: 완료

8. CATEGORY SCREEN 내부 일정 reorder 확인
- 단일 카테고리 화면에서 일정 순서 변경 가능 여부 확인
- 변경된 순서가 `category_order`에 반영되는지 확인
- `custom_order`, `favorite_order`는 변경되지 않는지 확인
- 상태: 완료

9. CUSTOM DRAG ENGINE 회귀 확인
- `TODO SCREEN > 카테고리순`에서 카테고리 header long-press menu 확인
- 메뉴가 열린 상태에서 해당 카테고리 임시 collapse 유지 확인
- 카테고리 header reorder 시작 시 전체 category group 임시 collapse 확인
- 카테고리 header reorder 시 Inbox 최상단 고정 확인
- 일정 cross-category reorder 시 drop indicator 위치대로 삽입되는지 확인
- 접힌 카테고리 hover auto-expand가 안정적으로 동작하고, drop 후 다시 닫히지 않는지 확인
- 일정 cross-category reorder 후 JS/DB 반영 과정에서 한 텀 늦게 정렬되는 느낌이 줄었는지 확인
- 일정 / 카테고리 drop indicator가 list 전체 폭으로 보이는지 확인
- 상태: `TODO SCREEN > 카테고리순`, `ALL TODOS SCREEN` 수동 검증 완료

10. FAVORITE SCREEN 확인
- `My Page > 즐겨찾기` 진입 확인
- `favorite_order`가 있는 일정만 표시되는지 확인
- 즐겨찾기 순서 변경 시 `favorite_order`만 변경되는지 확인
- 완료 토글이 동작하고 완료 항목이 label dim 처리되는지 확인
- 메뉴에서 `즐겨찾기 해제` 시 DB의 `favorite_order`가 `null`로 바뀌는지 확인
- 즐겨찾기 해제 후 해당 항목이 현재 화면에서 바로 사라지는지 확인
- 상태: 수동 검증 완료

11. TODO SCREEN 상단 즐겨찾기 그룹 확인
- 즐겨찾기 일정이 `시간순`, `카테고리순` 모두에서 상단 그룹으로 표시되는지 확인
- 즐겨찾기 일정이 날짜별 일반 목록 / 카테고리 목록에서는 중복 표시되지 않는지 확인
- 일반 일정 메뉴에서 `즐겨찾기 추가` 시 상단 그룹으로 이동하는지 확인
- `카테고리순`에서 일반 일정을 상단 즐겨찾기 그룹으로 drop 하면 `favorite_order`만 생기고 기존 `categoryId`, `custom_order`, `category_order`가 유지되는지 확인
- `시간순`에서 시간이 있는 일정도 상단 즐겨찾기 그룹으로는 drop 가능하고, 시간순 위치 변경 없이 `favorite_order`만 생기는지 확인
- 상단 즐겨찾기 메뉴에서 `즐겨찾기 해제` 시 상단 그룹에서 사라지고 일반 목록 조건에 맞으면 아래 목록에 다시 표시되는지 확인
- 상단 즐겨찾기 그룹 내부 reorder 시 `favorite_order`만 변경되는지 확인
- 상단 즐겨찾기에서 시간순 일반 일정 영역으로 drag out 하면 `favorite_order`가 `null`이 되고 `custom_order`가 반영되는지 확인
- 상단 즐겨찾기에서 시간순 시간 지정 영역으로 drag out 하면 시간 없는 일반 일정 영역 맨 위로 들어가는지 확인
- 상단 즐겨찾기에서 카테고리순 일반 카테고리로 drag out 하면 `favorite_order`가 `null`이 되고 `categoryId` / `category_order`가 반영되는지 확인
- 상태: 수동 검증 완료

12. ALL TODOS SCREEN 상단 즐겨찾기 그룹 확인
- 즐겨찾기 일정이 상단 그룹에만 표시되고 일반 카테고리 목록에는 중복 표시되지 않는지 확인
- 일반 일정을 상단 즐겨찾기 그룹으로 drop 하면 `favorite_order`만 생기고 기존 `categoryId`, `custom_order`, `category_order`가 유지되는지 확인
- 상단 즐겨찾기 그룹 내부 reorder 시 `favorite_order`만 변경되는지 확인
- 상단 즐겨찾기에서 일반 카테고리 목록으로 drag out 하면 `favorite_order`가 `null`이 되고 `categoryId` / `category_order`가 반영되는지 확인
- 상태: 수동 검증 완료
