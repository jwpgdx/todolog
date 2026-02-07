# Requirements Document

## Introduction

게스트 데이터 마이그레이션 기능은 게스트 모드로 앱을 사용하던 사용자가 기존 회원 계정으로 로그인할 때, 게스트 데이터를 기존 회원 계정으로 이전할 수 있는 기능입니다. 이를 통해 사용자는 게스트로 생성한 일정과 카테고리를 잃지 않고 기존 계정에 통합할 수 있습니다.

## Glossary

- **Guest_User**: 이메일/비밀번호 없이 앱을 사용하는 익명 사용자 (accountType: 'anonymous')
- **Regular_User**: 이메일/비밀번호 또는 소셜 로그인으로 가입한 정회원 (accountType: 'local', 'google', 'apple')
- **Migration**: 게스트 사용자의 데이터(일정, 카테고리, 완료 정보)를 기존 회원 계정으로 이전하는 프로세스
- **ActionSheet**: 사용자에게 선택지를 제공하는 모달 UI 컴포넌트
- **SQLite**: 클라이언트 로컬 데이터베이스
- **MongoDB**: 서버 데이터베이스
- **UUID**: 범용 고유 식별자 (Universally Unique Identifier)
- **Migrated_Category**: 마이그레이션된 게스트 일정을 담을 새로운 카테고리

## Requirements

### Requirement 1: 게스트 데이터 감지

**User Story:** 게스트 사용자로서, 기존 회원 계정으로 로그인할 때 내 게스트 데이터가 있다는 것을 알고 싶습니다.

#### Acceptance Criteria

1. WHEN a Guest_User attempts to log in with existing Regular_User credentials THEN THE System SHALL detect the presence of guest data in SQLite
2. WHEN guest data is detected THEN THE System SHALL count the number of todos and categories
3. WHEN the count is zero THEN THE System SHALL proceed with normal login without showing migration options

### Requirement 2: 마이그레이션 선택 UI

**User Story:** 게스트 사용자로서, 기존 회원으로 로그인할 때 게스트 데이터를 가져올지 선택하고 싶습니다.

#### Acceptance Criteria

1. WHEN guest data exists (count > 0) THEN THE System SHALL display an ActionSheet with migration options
2. THE ActionSheet SHALL show the message "n개의 일정과 m개의 카테고리를 가져오시겠습니까?" where n and m are the actual counts
3. THE ActionSheet SHALL provide three options: "가져오기", "버리기", "취소"
4. WHEN the user selects "취소" THEN THE System SHALL cancel the login process and return to the login screen
5. WHEN the user selects "버리기" THEN THE System SHALL delete guest data and proceed with login
6. WHEN the user selects "가져오기" THEN THE System SHALL initiate the migration process

### Requirement 3: 서버 마이그레이션 처리

**User Story:** 시스템 관리자로서, 클라이언트에서 전송된 게스트 데이터를 기존 회원 계정으로 병합하고 싶습니다.

#### Acceptance Criteria

1. WHEN migration is initiated THEN THE Client SHALL send a payload containing all local guest data (todos, categories, completions) to the Server
2. THE Server SHALL create a new category for the Regular_User with a localized name (e.g., "Migrated Category", "마이그레이션된 카테고리")
3. WHEN creating the migrated category THEN THE Server SHALL generate a new UUID for the category
4. THE Server SHALL **insert** all received todos with the Regular_User's `userId` into MongoDB
5. THE Server SHALL set the `categoryId` of all inserted todos to the new migrated category UUID
6. THE Server SHALL **insert** all received completions with the Regular_User's `userId` into MongoDB
7. IF guest data relied on local IDs THEN THE Server SHALL resolve them to new server-side IDs (or trust UUIDs if used)
8. WHEN data insertion is complete THEN THE Server SHALL return the result of the migration
9. (Optional) IF a temporary Guest_User account existed on server THEN THE Server SHALL delete it

### Requirement 4: 트랜잭션 보장

**User Story:** 시스템 관리자로서, 마이그레이션 중 오류 발생 시 데이터 일관성을 보장하고 싶습니다.

#### Acceptance Criteria

1. WHEN migration starts THEN THE Server SHALL begin a MongoDB transaction
2. IF any migration step fails THEN THE Server SHALL rollback all changes
3. WHEN rollback occurs THEN THE Server SHALL return an error response to the client
4. WHEN all migration steps succeed THEN THE Server SHALL commit the transaction
5. WHEN transaction is committed THEN THE Server SHALL return a success response with the updated user data

### Requirement 5: 클라이언트 동기화

**User Story:** 게스트 사용자로서, 마이그레이션 후 내 데이터가 즉시 반영되기를 원합니다.

#### Acceptance Criteria

1. WHEN migration succeeds on the server THEN THE Client SHALL clear all local SQLite data
2. WHEN SQLite is cleared THEN THE Client SHALL save the new access token and user data
3. WHEN new user data is saved THEN THE Client SHALL trigger a full sync from the server
4. WHEN sync completes THEN THE Client SHALL invalidate all React Query caches
5. WHEN caches are invalidated THEN THE Client SHALL navigate to the home screen

### Requirement 6: 게스트 데이터 삭제

**User Story:** 게스트 사용자로서, 게스트 데이터를 버리고 기존 회원으로 로그인하고 싶습니다.

#### Acceptance Criteria

1. WHEN the user selects "버리기" THEN THE Client SHALL delete all guest todos from SQLite
2. WHEN todos are deleted THEN THE Client SHALL delete all guest categories from SQLite
3. WHEN categories are deleted THEN THE Client SHALL delete all guest completions from SQLite
4. WHEN completions are deleted THEN THE Client SHALL delete all pending changes from SQLite
5. WHEN all local data is deleted THEN THE Client SHALL proceed with normal login
6. WHEN login succeeds THEN THE Client SHALL sync the Regular_User's data from the server

### Requirement 7: 오류 처리

**User Story:** 게스트 사용자로서, 마이그레이션 실패 시 명확한 오류 메시지를 받고 싶습니다.

#### Acceptance Criteria

1. IF migration fails due to network error THEN THE System SHALL display "네트워크 오류" message
2. IF migration fails due to server error THEN THE System SHALL display "마이그레이션 실패" message with details
3. IF migration fails THEN THE System SHALL keep the guest session active
4. IF migration fails THEN THE System SHALL allow the user to retry the login
5. WHEN an error occurs THEN THE System SHALL log the error details for debugging

### Requirement 8: 로딩 상태 표시

**User Story:** 게스트 사용자로서, 마이그레이션 진행 중임을 알고 싶습니다.

#### Acceptance Criteria

1. WHEN migration starts THEN THE Client SHALL display a loading indicator
2. THE loading indicator SHALL show the message "데이터를 가져오는 중..."
3. WHEN migration completes THEN THE Client SHALL hide the loading indicator
4. WHEN migration fails THEN THE Client SHALL hide the loading indicator and show an error message
5. WHILE loading THEN THE Client SHALL disable all user interactions

### Requirement 9: 데이터 무결성 검증

**User Story:** 시스템 관리자로서, 마이그레이션 후 데이터 무결성을 검증하고 싶습니다.

#### Acceptance Criteria

1. WHEN migration completes THEN THE Server SHALL verify all migrated todos have the correct userId
2. WHEN migration completes THEN THE Server SHALL verify all migrated todos have the correct categoryId
3. WHEN migration completes THEN THE Server SHALL verify all migrated completions have the correct userId
4. WHEN migration completes THEN THE Server SHALL verify the Guest_User account no longer exists
5. IF any verification fails THEN THE Server SHALL rollback the transaction and return an error
