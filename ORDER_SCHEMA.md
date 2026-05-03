# Order Schema 정리

Last Updated: 2026-04-30  
Status: Draft

## 1. 목적

이 문서는 카테고리와 일정의 순서(`order`)를 어떤 기준으로 저장하고,
각 화면이 그 순서를 어떻게 공유하는지 정의한다.

이 문서는 UX 문서인 [메뉴 구조.md](/Users/admin/Documents/github/todo/메뉴%20구조.md) 와 분리한다.  
[메뉴 구조.md](/Users/admin/Documents/github/todo/메뉴%20구조.md) 는 화면 동작을 다루고,
이 문서는 실제 데이터 구조와 저장 규칙을 다룬다.

## 2. 핵심 원칙

### 2.1 시간순은 저장하지 않는다

- `시간순`은 DB에 order를 저장하지 않는다.
- 시간, 날짜, 생성순 등의 계산 정렬로만 표시한다.

### 2.2 순서 lane은 4개로 분리한다

- 카테고리 헤더 순서
- 사용자 지정 flat 순서
- 카테고리 내부 순서
- 즐겨찾기 순서

이 네 가지는 사용자 의미가 다르므로 서로 다른 order lane으로 관리한다.

### 2.3 사용자 지정 순서는 todo 원본의 전역 custom order를 사용한다

- `TODO SCREEN > 사용자 지정`은 `selected date`의 일반 일정만 필터해서 보여준다.
- 하지만 순서는 날짜별 별도 row가 아니라 `todo.order.custom`을 사용한다.
- 반복 일정 / 기간 일정은 날짜가 바뀌어 다시 보여도 같은 todo의 `custom order`를 그대로 따른다.

### 2.4 카테고리 내부 순서는 별도로 관리한다

- `CATEGORY SCREEN`
- `TODO SCREEN > 카테고리별 순서`
- `ALL TODOS SCREEN`

위 화면들은 모두 같은 카테고리 내부 순서(`todo.order.category`)를 공유한다.

### 2.5 즐겨찾기 순서는 별도로 관리한다

- `FAVORITE SCREEN`
- `TODO SCREEN`의 상단 즐겨찾기 그룹

위 화면들은 모두 같은 즐겨찾기 순서(`todo.order.favorite`)를 공유한다.

## 3. 최종 권장 도메인 구조

### Category

```ts
category.order
```

### Todo

```ts
todo.order.custom
todo.order.category
todo.order.favorite
```

### 의미

- `category.order`
  - 카테고리 헤더 자체 순서
- `todo.order.custom`
  - 사용자 지정 flat 순서
  - `TODO SCREEN > 사용자 지정`에서 사용
- `todo.order.category`
  - 카테고리 내부 순서
  - 아래 화면들이 공유
  - `CATEGORY SCREEN`
  - `TODO SCREEN > 카테고리별 순서`
  - `ALL TODOS SCREEN`
- `todo.order.favorite`
  - 즐겨찾기 전용 순서
  - 아래 화면들이 공유
  - `FAVORITE SCREEN`
  - `TODO SCREEN` 상단 즐겨찾기 그룹

## 4. 화면별 순서 사용 규칙

| 화면 | 사용하는 순서 |
|---|---|
| `TODO SCREEN > 시간순` | 저장 안 함, 계산 정렬 |
| `TODO SCREEN > 사용자 지정` | `todo.order.custom` |
| `TODO SCREEN > 카테고리별 순서` | `todo.order.category` |
| `CATEGORY SCREEN` | `todo.order.category` |
| `ALL TODOS SCREEN` | `todo.order.category` |
| `FAVORITE SCREEN` | `todo.order.favorite` |
| `My Page` 카테고리 | `category.order` |

## 5. 서버 스키마 권장안

### Category

```js
order: Number
```

### Todo

```js
order: {
  custom: Number,
  category: Number,
  favorite: Number | null,
}
```

### 비고

- 현재 서버에 있는 `todo.order.category`는 유지 방향이다.
- 현재 서버에 있는 `todo.order.keep`는 의미가 불명확하므로 정리 대상이다.
- `todo.order.manual` 같은 공용 수동 순서는 사용하지 않는다.
- custom order도 todo row의 일부로 서버까지 sync 한다.

## 6. SQLite 스키마 권장안

### categories

```sql
order_index REAL
```

### todos

```sql
custom_order REAL
category_order REAL
favorite_order REAL NULL
```

### 비고

- SQLite는 flat table 구조이므로 Mongo처럼 중첩 object를 그대로 쓰지 않는다.
- 의미만 서버와 동일하게 유지한다.
- 컬럼명은 snake_case로 관리한다.

## 7. sync / 매핑 규칙

### 서버 -> 로컬

- `category.order` -> `categories.order_index`
- `todo.order.custom` -> `todos.custom_order`
- `todo.order.category` -> `todos.category_order`
- `todo.order.favorite` -> `todos.favorite_order`

### 로컬 -> 서버

- `categories.order_index` -> `category.order`
- `todos.custom_order` -> `todo.order.custom`
- `todos.category_order` -> `todo.order.category`
- `todos.favorite_order` -> `todo.order.favorite`

### sync 원칙

- custom order도 서버까지 sync 한다.
- sync는 문서 전체 replace가 아니라 patch / op 단위로 처리한다.
- `categoryId` 와 `category_order` 는 같은 transaction / 같은 sync op 에서 변경한다.

## 8. reorder / 생성 저장 규칙

### 8.1 카테고리 reorder

- 카테고리 이동 시 `category.order`만 변경한다.
- todo 순서는 건드리지 않는다.

### 8.2 custom reorder

- `TODO SCREEN > 사용자 지정`에서 보이는 일반 일정 reorder

위 경우 `todo.order.custom`을 갱신한다.

### 8.3 category reorder

- 같은 카테고리 안 reorder
- 다른 카테고리로 이동
- `TODO SCREEN > 카테고리별 순서`
- `CATEGORY SCREEN`
- `ALL TODOS SCREEN`

위 경우 `todo.order.category`를 갱신한다.

### 8.4 favorite reorder

- 즐겨찾기 화면 reorder
- `TODO SCREEN` 상단 즐겨찾기 그룹 reorder

위 경우 `todo.order.favorite`를 갱신한다.

### 8.5 새 todo 생성

- 새 todo 생성 시 `todo.order.custom`은 전체 custom order의 `max + STEP`
- 새 todo 생성 시 `todo.order.category`는 대상 카테고리의 `max + STEP`
- 새 todo 생성 시 `todo.order.favorite`는
  - 즐겨찾기면 `favorite max + STEP`
  - 아니면 `null`

### 8.6 메뉴 이동

- 메뉴의 `이동`은 target category 맨 아래 append 로 처리한다.
- 즉 `categoryId`를 바꾸면서, 대상 카테고리의 마지막 `category order` 뒤 값을 부여한다.
- precise 위치 조정은 reorder 가능한 화면에서 drag 로 처리한다.
- 메뉴 이동 시 `custom order`는 유지한다.

### 8.7 편집 화면에서 카테고리 변경

- edit form 에서 카테고리를 변경하는 경우도 메뉴 이동과 동일하게 처리한다.
- 즉 `categoryId`를 바꾸면서, 대상 카테고리의 마지막 `category order` 뒤 값을 부여한다.
- `custom order`는 유지한다.
- `favorite order`는 유지한다.

### 8.8 즐겨찾기 추가 / 해제

- 즐겨찾기 추가 시 `favorite_order = favorite max + STEP`
- 즐겨찾기 해제 시 `favorite_order = null`
- 즐겨찾기 추가 / 해제 시 `custom order`와 `category order`는 유지한다.

## 9. custom order 규칙

### 9.1 custom order의 범위

- `todo.order.custom`은 날짜별 order가 아니다.
- 전역 flat 순서이며, `TODO SCREEN > 사용자 지정`에서는 `selected date` 필터만 적용하고 순서는 그대로 사용한다.

### 9.2 반복 일정 / 기간 일정

- 반복 일정 / 기간 일정이 다른 날짜에 다시 보여도 같은 todo의 `custom order`를 그대로 따른다.
- 날짜가 바뀌어 보이게 되었다고 해서 새 custom row를 만들지 않는다.
- 따라서 `appearance_key`나 별도 date-scoped custom order table은 사용하지 않는다.

### 9.3 사용자 지정 첫 진입 seed 의미

- `TODO SCREEN > 사용자 지정`에 처음 진입할 때 별도 materialize 작업은 필요 없다.
- 이미 저장된 `todo.order.custom` 순서를 그대로 사용한다.
- 현재 개발 단계에서는 기존 계정 / 기존 일정 데이터를 초기화할 예정이므로 legacy custom order 복원은 고려하지 않는다.
- 새 구조 적용 시 필요한 초기 custom order 는 새 데이터 기준으로 다시 채운다.

## 10. 정렬 규칙

### 10.1 custom order를 쓰는 화면

대상:

- `TODO SCREEN > 사용자 지정`

정렬 규칙:

1. `custom_order ASC`
2. `id ASC`

### 10.2 category order를 쓰는 화면

대상:

- `CATEGORY SCREEN`
- `TODO SCREEN > 카테고리별 순서`
- `ALL TODOS SCREEN`

정렬 규칙:

1. `category_order ASC`
2. `id ASC`

### 10.3 favorite order를 쓰는 화면

대상:

- `FAVORITE SCREEN`
- `TODO SCREEN` 상단 즐겨찾기 그룹

정렬 규칙:

1. `favorite_order ASC`
2. `id ASC`

## 11. 값 타입 규칙

- order 값은 `REAL` / `Number` 기준으로 관리한다.
- 이유:
  - 아이템 사이 중간값 삽입이 쉬움
  - drag/drop reorder 시 전체 재정렬 빈도를 줄일 수 있음

예시:

- A = `1024`
- B = `2048`
- C = `3072`

B와 C 사이에 새 위치 삽입:

- X = `2560`

값이 너무 촘촘해지면 해당 scope 만 재정렬한다.

## 12. 의도적으로 하지 않는 것

### 12.1 시간순 order 저장 안 함

- 시간순은 계산 정렬만 사용한다.
- 별도 `timeOrder` 같은 필드는 만들지 않는다.

### 12.2 공용 manual order 사용 안 함

다음 구조는 사용하지 않는다.

```ts
todo.order.manual
```

이유:

- `사용자 지정`
- `카테고리 내부 순서`
- `즐겨찾기 순서`

이 세 가지는 사용자 의미가 다르므로 같은 order를 공유하면 UX 와 데이터가 충돌한다.

### 12.3 date-scoped custom order table 사용 안 함

다음 구조는 사용하지 않는다.

```ts
todoDateCustomOrder
appearanceKey
```

이유:

- 현재 프로젝트에서 `사용자 지정`은 날짜별 임시 순서가 아니라 todo 원본의 전역 custom 순서다.
- 반복 일정 / 기간 일정도 날짜가 바뀌어도 같은 custom 순서를 유지해야 한다.

## 13. 현재 기준 정리 대상

### 서버

현재:

```js
todo.order.category
todo.order.keep
```

정리 목표:

```js
todo.order.custom
todo.order.category
todo.order.favorite
```

### SQLite

현재:

- todo order 컬럼 없음

정리 목표:

```sql
custom_order REAL
category_order REAL
favorite_order REAL NULL
```

## 14. 최종 결론

최종 order 구조는 아래 4개로 간다.

```ts
category.order
todo.order.custom
todo.order.category
todo.order.favorite
```

- `시간순`은 저장하지 않는다.
- `사용자 지정`은 `todo.order.custom`을 사용한다.
- `카테고리 내부 순서`는 `todo.order.category`를 사용한다.
- `즐겨찾기 순서`는 `todo.order.favorite`를 사용한다.
- custom order도 서버까지 sync 한다.
