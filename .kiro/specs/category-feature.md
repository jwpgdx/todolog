# 카테고리 기능 명세서

## 1. 개요
할일을 체계적으로 관리하기 위해 카테고리 기능을 도입합니다. 사용자는 색상과 이름으로 구분된 카테고리를 생성하고 할일에 지정할 수 있습니다.

## 2. 데이터 구조

### Category 객체
```javascript
{
  _id: "string",
  userId: "string",
  name: "string",      // 카테고리 이름 (예: "개인", "업무", "운동")
  color: "string",     // 색상 코드 (예: "#FF5733")
  isDefault: boolean,  // 기본 카테고리 여부 (삭제 불가)
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

### Todo 객체 변경
- `categoryId`: Category ID 참조 필드 추가 (필수 권장, 마이그레이션 시 기본 카테고리 할당)

## 3. 기능 상세

### 카테고리 관리
- **생성**: 이름, 색상 선택하여 생성
- **수정**: 이름, 색상 수정 가능
- **삭제**: 기본 카테고리는 삭제 불가. 삭제 시 소속된 할일 처리 방안(삭제 막기 또는 기본 카테고리로 이동) 필요. 현재는 삭제 시 경고.
- **조회**: 사용자별 카테고리 목록 조회

### 카테고리 지정
- **할일 추가/수정**: Bottom Sheet 내에서 인라인으로 카테고리 선택 UI 제공
- **UI**: 색상 도트와 이름으로 표시

## 4. UI/UX
- **CategorySelectionBottomSheet**: (삭제됨, AddTodo로 통합) -> AddTodoBottomSheet 내 슬라이드 오버 뷰로 구현
- **ManageCategoryScreen**: 카테고리 목록 관리, 추가, 수정, 삭제 기능

## 5. API
- `GET /api/categories`: 목록 조회
- `POST /api/categories`: 생성
- `PUT /api/categories/:id`: 수정
- `DELETE /api/categories/:id`: 삭제

## 6. 구현 현황 (2025-12-13)
- [x] 카테고리 모델 및 컨트롤러 구현
- [x] 카테고리 관리 화면 구현
- [x] 할일 추가/수정 시 카테고리 선택 (인라인 슬라이드 UI)
- [x] 기존 데이터 마이그레이션 (기본 카테고리 자동 생성)
