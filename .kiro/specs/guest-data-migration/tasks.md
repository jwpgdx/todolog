# Implementation Plan: Guest Data Migration

## Overview

게스트 데이터 마이그레이션 기능을 구현합니다. 게스트 모드로 앱을 사용하던 사용자가 기존 회원 계정으로 로그인할 때, 게스트 데이터(일정, 카테고리, 완료 정보)를 기존 계정으로 이전하는 기능입니다.

구현은 서버 기반 작업(MongoDB 모델, API 엔드포인트)부터 시작하여 클라이언트 구현(UI, Store, API 클라이언트), 그리고 통합 및 테스트 순서로 진행됩니다.

## Tasks

- [x] 1. Server: Completion Model 생성
  - `server/src/models/Completion.js` 파일 생성
  - Completion 스키마 정의 (key, todoId, userId, date, completedAt)
  - 복합 인덱스 설정 (userId + date)
  - _Requirements: 3.6_

- [ ]* 1.1 Write property test for Completion Model
  - **Property 12: Migrated Category UUID Validity**
  - **Validates: Requirements 3.3**

- [ ] 2. Server: Auth Controller 확장 - Migration API
  - [x] 2.1 `server/src/controllers/authController.js`에 `migrateGuestData` 메서드 추가
    - 사용자 인증 (email, password)
    - MongoDB 트랜잭션 시작
    - 마이그레이션된 카테고리 생성 (UUID 생성, 다국어 이름)
    - Todos 삽입 (userId, categoryId 설정)
    - Completions 삽입 (userId 설정)
    - 데이터 무결성 검증
    - 트랜잭션 커밋
    - JWT 토큰 생성 및 응답
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 4.1, 4.4, 4.5, 9.1, 9.2, 9.3_

  - [ ]* 2.2 Write property test for Transaction Atomicity
    - **Property 5: Transaction Atomicity**
    - **Validates: Requirements 4.2, 4.3, 9.5**

  - [ ]* 2.3 Write property test for Server Data Insertion
    - **Property 4: Server Data Insertion with Correct Ownership**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6, 9.1, 9.2, 9.3**

  - [ ]* 2.4 Write property test for Migration Response Completeness
    - **Property 6: Migration Response Completeness**
    - **Validates: Requirements 3.8, 4.5**

- [x] 3. Server: Routes 추가
  - `server/src/routes/auth.js`에 `POST /auth/migrate-guest-data` 라우트 추가
  - authController.migrateGuestData 연결
  - _Requirements: 3.1_

- [ ] 4. Server: Error Handling 및 Logging
  - [x] 4.1 트랜잭션 롤백 로직 구현
    - 모든 에러 케이스에서 session.abortTransaction() 호출
    - 에러 로그 출력 (userId, email, error message, stack trace)
    - _Requirements: 4.2, 4.3, 7.5_

  - [ ]* 4.2 Write unit tests for error scenarios
    - 사용자 없음 (404)
    - 비밀번호 불일치 (401)
    - 네트워크 오류 (500)
    - UUID 충돌 (500)
    - _Requirements: 7.1, 7.2_

- [x] 5. Checkpoint - Server Implementation Complete
  - 서버 테스트 실행 및 확인
  - MongoDB 연결 확인
  - 사용자에게 질문이 있으면 물어보기

- [ ] 6. Client: SQLite Helper Functions
  - [x] 6.1 `client/src/db/todoService.js`에 헬퍼 함수 추가
    - `getTodoCount()`: 삭제되지 않은 일정 개수 반환
    - `getAllTodos()`: 삭제되지 않은 모든 일정 반환
    - _Requirements: 1.2, 3.1_

  - [x] 6.2 `client/src/db/categoryService.js`에 헬퍼 함수 추가
    - `getCategoryCount()`: 삭제되지 않은 카테고리 개수 반환
    - `getAllCategories()`: 삭제되지 않은 모든 카테고리 반환
    - _Requirements: 1.2, 3.1_

  - [x] 6.3 `client/src/db/completionService.js`에 헬퍼 함수 추가
    - `getAllCompletions()`: 모든 완료 정보 반환 (Map → Array 변환)
    - _Requirements: 3.1_

  - [x] 6.4 `client/src/db/database.js`에 `clearAllData()` 함수 추가
    - 모든 테이블 데이터 삭제 (todos, categories, completions, pending_changes)
    - _Requirements: 5.1, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.5 Write property test for Guest Data Detection
    - **Property 1: Guest Data Detection Accuracy**
    - **Validates: Requirements 1.1, 1.3**

  - [ ]* 6.6 Write property test for Data Count Correctness
    - **Property 2: Data Count Correctness**
    - **Validates: Requirements 1.2**

  - [ ]* 6.7 Write property test for Migration Payload Completeness
    - **Property 3: Migration Payload Completeness**
    - **Validates: Requirements 3.1**

- [x] 7. Client: API Client 확장
  - `client/src/api/auth.js`에 `migrateGuestData` 메서드 추가
  - POST /auth/migrate-guest-data 호출
  - _Requirements: 3.1_

- [ ] 8. Client: Auth Store 확장
  - [x] 8.1 `client/src/store/authStore.js`에 메서드 추가
    - `checkGuestData()`: SQLite에서 게스트 데이터 개수 확인
    - `migrateGuestData(credentials)`: 마이그레이션 프로세스 실행
    - `discardGuestData()`: 게스트 데이터 삭제
    - _Requirements: 1.1, 1.2, 3.1, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 8.2 Write property test for Client Data Cleanup
    - **Property 7: Client Data Cleanup After Migration**
    - **Validates: Requirements 5.1**

  - [ ]* 8.3 Write property test for Client State Update
    - **Property 8: Client State Update After Migration**
    - **Validates: Requirements 5.2**

  - [ ]* 8.4 Write property test for Guest Data Discard
    - **Property 9: Guest Data Discard Completeness**
    - **Validates: Requirements 2.5, 6.1, 6.2, 6.3, 6.4**

- [ ] 9. Client: LoginScreen 수정
  - [x] 9.1 `client/src/screens/LoginScreen.js` 수정
    - 로그인 전 게스트 데이터 확인 로직 추가
    - ActionSheet 표시 로직 추가 (iOS/Android 분기)
    - 마이그레이션 처리 로직 추가
    - 게스트 데이터 삭제 처리 로직 추가
    - 로딩 상태 관리
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 9.2 Write unit tests for LoginScreen UI
    - ActionSheet 표시 테스트
    - 버튼 클릭 테스트 (가져오기, 버리기, 취소)
    - 로딩 인디케이터 테스트
    - _Requirements: 2.1, 2.2, 2.3, 8.1, 8.2_

- [ ] 10. Client: Error Handling
  - [x] 10.1 에러 처리 로직 구현
    - 네트워크 오류 처리 (Toast 메시지)
    - 인증 오류 처리 (Toast 메시지)
    - 서버 오류 처리 (Toast 메시지)
    - 게스트 세션 유지 로직
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 10.2 Write property test for Error Preservation
    - **Property 10: Error Preservation of Guest Session**
    - **Validates: Requirements 7.3**

  - [ ]* 10.3 Write unit tests for error scenarios
    - 네트워크 오류 시나리오
    - 인증 실패 시나리오
    - 서버 오류 시나리오
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11. Checkpoint - Client Implementation Complete
  - 클라이언트 테스트 실행 및 확인
  - SQLite 헬퍼 함수 동작 확인
  - 사용자에게 질문이 있으면 물어보기

- [ ] 12. Integration: End-to-End Testing
  - [x] 12.1 통합 테스트 시나리오 작성
    - 게스트 데이터 생성 → 로그인 → 마이그레이션 → 검증
    - 게스트 데이터 생성 → 로그인 → 삭제 → 검증
    - 빈 게스트 데이터 → 로그인 → 정상 로그인 검증
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.6, 3.1, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 6.5, 6.6_

  - [ ]* 12.2 Write integration tests
    - 전체 마이그레이션 플로우 테스트
    - 전체 삭제 플로우 테스트
    - 에러 복구 플로우 테스트

- [ ] 13. Optional: Guest User Cleanup
  - [ ] 13.1 서버에서 게스트 계정 삭제 로직 추가 (Optional)
    - 마이그레이션 완료 후 guest_${UUID} 계정 삭제
    - _Requirements: 3.9, 9.4_

  - [ ]* 13.2 Write property test for Guest User Cleanup
    - **Property 11: Guest User Cleanup**
    - **Validates: Requirements 3.9, 9.4**

- [x] 14. Final Checkpoint - Complete Feature
  - 모든 테스트 통과 확인
  - 수동 테스트 수행 (실제 앱에서 마이그레이션 시도)
  - 문서 업데이트 (ROADMAP.md, README.md)
  - 사용자에게 최종 확인 요청

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- Property-based testing library: `fast-check` (JavaScript)
- Tag format for property tests: `Feature: guest-data-migration, Property {N}: {property_text}`
