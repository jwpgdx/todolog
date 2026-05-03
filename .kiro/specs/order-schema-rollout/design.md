# Design Document: Order Schema Rollout

## Overview

본 문서는 `.kiro/specs/order-schema-rollout/requirements.md`를 구현하기 위한
데이터 계약 / 저장 구조 / sync / reorder write 설계를 정의한다.

핵심 목표:

1. order lane 을 `custom / category / favorite / category-header`로 분리한다.
2. SQLite와 서버가 같은 의미를 공유하도록 계약을 고정한다.
3. reorder / move / favorite toggle 경로가 각 lane에 맞는 필드만 갱신하도록 만든다.
4. `TODO SCREEN > 사용자 지정`을 date-scoped 임시 순서가 아니라 전역 `custom order`로 동작시킨다.

## Current State (AS-IS)

현재 코드 기준 문제:

1. SQLite `todos`에는 `custom_order / category_order / favorite_order` 컬럼이 없다.
2. 서버는 일부 경로에서 `todo.order.category`만 가정하고 있다.
3. 기존 문서/실험 코드에는 `manual` 공유 개념이 남아 있다.
4. reorder write 경로가 화면 의미별로 완전히 분리되지 않았다.
5. `TODO SCREEN` 정렬 모드 선택값 저장이 구현 계약으로 고정되어 있지 않다.

## Target State (TO-BE)

### 1) Canonical Order Fields

#### Category

- Server: `category.order`
- SQLite: `categories.order_index`

#### Todo

- Server:
  - `todo.order.custom`
  - `todo.order.category`
  - `todo.order.favorite`
- SQLite:
  - `todos.custom_order`
  - `todos.category_order`
  - `todos.favorite_order`

### 2) Lane Meaning

#### custom

- 용도: `TODO SCREEN > 사용자 지정`
- 범위: 전역 flat 순서
- 특징:
  - `selected date`는 필터 조건일 뿐, 순서는 전역 `custom_order`
  - 반복 일정 / 기간 일정도 날짜가 바뀌어도 같은 `custom_order`를 사용

#### category

- 용도:
  - `CATEGORY SCREEN`
  - `TODO SCREEN > 카테고리별 순서`
  - `ALL TODOS SCREEN`
- 범위: 카테고리 내부 순서
- 특징:
  - 다른 카테고리로 이동 시 `categoryId + category_order`를 같이 변경

#### favorite

- 용도:
  - `FAVORITE SCREEN`
  - `TODO SCREEN` 상단 즐겨찾기 그룹
- 범위: 즐겨찾기 전용 순서

### 3) SQLite Changes

`client/src/services/db/database.js`

#### categories

- keep: `order_index`

#### todos

새 컬럼:

- `custom_order REAL`
- `category_order REAL`
- `favorite_order REAL NULL`

추가 인덱스 권장:

- `idx_todos_custom_order(user_id?, custom_order, _id)` 또는 현재 로컬 패턴에 맞는 active index
- `idx_todos_category_order(category_id, category_order, _id)`
- `idx_todos_favorite_order(is_favorite, favorite_order, _id)`

비고:

- 현재는 개발 중이므로 기존 데이터 호환 migration보다 “새 구조 컬럼 추가 + 새 데이터 기준 채우기”를 우선한다.

### 4) Server Changes

대상:

- `server/src/models/Todo.js`
- `server/src/models/Category.js`
- `server/src/controllers/todoController.js`
- 필요한 DTO/validation 경로

#### Todo

최종 목표:

```js
order: {
  custom: Number,
  category: Number,
  favorite: Number | null,
}
```

현재 `order.keep`는 제거 대상이다.

### 5) Reorder Write Paths

#### custom reorder

- 화면: `TODO SCREEN > 사용자 지정`
- 변경 필드: `todo.order.custom` / `todos.custom_order`

#### category reorder

- 화면:
  - `CATEGORY SCREEN`
  - `TODO SCREEN > 카테고리별 순서`
  - `ALL TODOS SCREEN`
- 변경 필드: `todo.order.category` / `todos.category_order`

#### favorite reorder

- 화면:
  - `FAVORITE SCREEN`
  - `TODO SCREEN` 상단 즐겨찾기 그룹
- 변경 필드: `todo.order.favorite` / `todos.favorite_order`

#### moveCategory

- 변경 필드:
  - `categoryId`
  - `todo.order.category`
- 규칙:
  - target category 맨 아래 append
  - `custom_order` 유지
  - `favorite_order` 유지

### 6) Edit Form Category Change

edit form에서 카테고리를 바꾸는 경우도 같은 규칙을 쓴다.

- `categoryId` 변경
- `category_order = target category max + STEP`
- `custom_order` 유지
- `favorite_order` 유지

즉 edit form category change는 `menu moveCategory`와 같은 의미로 처리한다.

### 7) Favorite Toggle

#### add favorite

- `favorite_order = favorite max + STEP`
- `custom_order` 유지
- `category_order` 유지

#### remove favorite

- `favorite_order = null`
- `custom_order` 유지
- `category_order` 유지

### 8) Create Todo

새 todo 생성 시:

- `custom_order = global custom max + STEP`
- `category_order = target category max + STEP`
- `favorite_order = null` 또는 즐겨찾기 생성이면 `favorite max + STEP`

### 9) Order Value Strategy

기본 상수:

- `ORDER_STEP = 1024`

삽입 규칙:

- append: `max + ORDER_STEP`
- between: `(prev + next) / 2`
- gap이 너무 좁으면 해당 scope만 rebalance

rebalance scope:

- custom reorder -> custom 전체 scope
- category reorder -> 해당 category scope
- favorite reorder -> favorite scope
- category header reorder -> category scope

### 10) TODO Screen Sort Mode Persistence

정렬 모드는 서버가 아니라 로컬 저장으로 처리한다.

추천 key:

- `todo_screen_sort_mode`

복원 대상:

- `시간순`
- `사용자 지정`
- `카테고리별 순서`

## Validation Plan

1. SQLite schema 반영 후 신규 todo 생성 시 `custom/category/favorite` 값 확인
2. `TODO SCREEN > 사용자 지정` reorder 시 `custom_order`만 변하는지 확인
3. `CATEGORY SCREEN` reorder 시 `category_order`만 변하는지 확인
4. favorite 토글 시 `favorite_order`만 변하는지 확인
5. menu move / edit form category change 시 target category 맨 아래 append 되는지 확인
6. `TODO SCREEN` 정렬 모드 변경 후 재진입 시 복원되는지 확인

## Risks / Notes

1. 기존 order 관련 실험 코드(`manual`, `keep`)가 일부 경로에 남아 있을 수 있다.
2. `ALL TODOS SCREEN` / `TODO SCREEN` / `CATEGORY SCREEN`이 서로 다른 lane을 정확히 쓰도록 adapter 레벨 정리가 필요하다.
3. 서버 컨트롤러가 여전히 `order.category`만 일부 가정하고 있으므로 DTO 반영 범위를 놓치면 sync mismatch가 발생할 수 있다.
