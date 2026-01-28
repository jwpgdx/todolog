# Google Calendar Sync Requirements Document

## Introduction

TODOLOG 앱의 특정날짜 할일을 구글 캘린더와 단방향으로 동기화하는 기능입니다. 사용자가 앱에서 생성한 todo(특정날짜) 타입의 할일이 구글 캘린더의 전용 "TODOLOG" 캘린더에 자동으로 추가되어, 다른 캘린더 앱에서도 일정을 확인할 수 있습니다.

## Glossary

- **TODOLOG Calendar**: 구글 캘린더에 자동 생성되는 "TODOLOG" 이름의 전용 캘린더
- **Calendar Event**: 구글 캘린더의 개별 일정 항목
- **Calendar Sync**: 할일에서 캘린더 이벤트로의 단방향 동기화
- **Access Token**: 구글 캘린더 API 호출을 위한 인증 토큰
- **Refresh Token**: Access Token 갱신을 위한 토큰
- **Todo Calendar ID**: User 모델에 저장되는 TODOLOG 캘린더의 고유 ID
- **Event ID**: Todo 모델에 저장되는 구글 캘린더 이벤트의 고유 ID
- **Sync Status**: 동기화 상태 ('synced' | 'pending' | 'failed')
- **Start Time**: 할일의 시작 시간 (HH:MM 형식)
- **End Time**: 할일의 종료 시간 (HH:MM 형식)
- **All-day Event**: 시간이 지정되지 않은 종일 이벤트
- **Timed Event**: 시작/종료 시간이 지정된 이벤트

## Requirements

### Requirement 1

**User Story:** As a user with Google account, I want to sync my todo-type tasks with Google Calendar, so that I can view my scheduled tasks in other calendar applications.

#### Acceptance Criteria

1. WHEN a user enables calendar sync for the first time, THE system SHALL create a dedicated "TODOLOG" calendar in their Google Calendar and store the calendar ID
2. WHEN a user creates a todo with type "todo" (specific date), THE system SHALL automatically create a corresponding calendar event in the TODOLOG calendar
3. WHEN a user creates a routine todo, THE system SHALL NOT create a calendar event
4. WHEN the TODOLOG calendar is not found or deleted, THE system SHALL create a new TODOLOG calendar and update the stored calendar ID
5. WHEN calendar sync fails, THE system SHALL mark the todo with sync status "failed" and continue with normal todo creation

### Requirement 2

**User Story:** As a user, I want to set specific start and end times for my todos, so that my calendar events show accurate scheduling information.

#### Acceptance Criteria

1. WHEN a user sets only a start time for a todo, THE system SHALL create a timed calendar event with 1-hour duration
2. WHEN a user sets both start time and end time for a todo, THE system SHALL create a timed calendar event with the specified duration
3. WHEN a user creates a todo without any time, THE system SHALL create an all-day calendar event
4. WHEN a user creates a period todo (with start and end dates) without times, THE system SHALL create a multi-day all-day event
5. WHEN a user creates a period todo (with start and end dates) with times, THE system SHALL create a multi-day timed event with specified start and end times

### Requirement 3

**User Story:** As a user, I want to update my synced todos and have the changes reflected in Google Calendar, so that my calendar stays current with my task modifications.

#### Acceptance Criteria

1. WHEN a user updates a synced todo's title, THE system SHALL update the corresponding calendar event's summary
2. WHEN a user updates a synced todo's memo, THE system SHALL update the corresponding calendar event's description
3. WHEN a user updates a synced todo's time, THE system SHALL update the corresponding calendar event's start and end times
4. WHEN a user updates a synced todo's date or date range, THE system SHALL update the corresponding calendar event's dates
5. WHEN calendar event update fails, THE system SHALL mark the todo with sync status "failed" and continue with normal todo update

### Requirement 4

**User Story:** As a user, I want to delete synced todos and have them removed from Google Calendar, so that my calendar stays clean and accurate.

#### Acceptance Criteria

1. WHEN a user deletes a synced todo, THE system SHALL delete the corresponding calendar event from Google Calendar
2. WHEN calendar event deletion fails, THE system SHALL log the error but continue with normal todo deletion
3. WHEN a todo is deleted successfully but calendar event deletion fails, THE system SHALL not prevent the todo deletion
4. WHEN a calendar event is manually deleted from Google Calendar, THE system SHALL handle API errors gracefully during todo deletion
5. WHEN deleting a todo without a stored event ID, THE system SHALL complete the deletion without attempting calendar operations

### Requirement 5

**User Story:** As a user, I want to control calendar synchronization settings, so that I can manage my privacy and calendar organization.

#### Acceptance Criteria

1. WHEN a user toggles calendar sync ON, THE system SHALL request calendar permissions and store access tokens
2. WHEN a user toggles calendar sync OFF, THE system SHALL stop creating new calendar events but preserve existing ones
3. WHEN a user disconnects calendar access, THE system SHALL delete stored tokens and the TODOLOG calendar ID
4. WHEN calendar sync is disabled, THE system SHALL continue normal todo operations without calendar integration
5. WHEN calendar API calls fail, THE system SHALL log errors but continue todo operations normally

### Requirement 6

**User Story:** As a user, I want my calendar events to contain meaningful information, so that I can understand my tasks from the calendar view.

#### Acceptance Criteria

1. WHEN creating a calendar event, THE system SHALL use the todo title as the event summary
2. WHEN a todo has a memo, THE system SHALL include it as the event description
3. WHEN creating events, THE system SHALL set the timezone to Asia/Seoul
4. WHEN creating all-day events, THE system SHALL use date format without time
5. WHEN creating timed events, THE system SHALL use ISO 8601 datetime format with timezone

### Requirement 7

**User Story:** As a system administrator, I want robust error handling for calendar operations, so that calendar failures don't affect core todo functionality.

#### Acceptance Criteria

1. WHEN an access token expires, THE system SHALL automatically refresh it using the refresh token
2. WHEN calendar API returns 401 Unauthorized, THE system SHALL attempt token refresh and retry the operation once
3. WHEN calendar API returns 403 Forbidden, THE system SHALL log the error and disable calendar sync for the user
4. WHEN calendar operations fail, THE system SHALL complete todo operations successfully and log detailed error information
5. WHEN network connectivity issues occur, THE system SHALL mark sync status as "failed" for retry later

### Requirement 8

**User Story:** As a user, I want to retry failed calendar synchronizations, so that I can ensure all my tasks are properly synced to Google Calendar.

#### Acceptance Criteria

1. WHEN a todo has sync status "failed", THE system SHALL display a retry button next to the todo item in the home screen
2. WHEN a user clicks the retry button, THE system SHALL attempt to sync the todo to Google Calendar again
3. WHEN retry succeeds, THE system SHALL update the sync status to "synced" and remove the retry button
4. WHEN retry fails, THE system SHALL keep the sync status as "failed" and show an error message
5. WHEN multiple todos have failed sync, THE system SHALL provide a batch retry option in the settings screen

### Requirement 9

**User Story:** As a user, I want calendar sync to work only for specific todo types, so that my calendar doesn't get cluttered with inappropriate items.

#### Acceptance Criteria


2. WHEN a todo type is "todo" with single date, THE system SHALL create a single-day event in Google Calendar
3. WHEN a todo type is "todo" with date range, THE system SHALL create a multi-day event spanning the entire period
4. WHEN a todo type is "routine", THE system SHALL NOT create any calendar event
5. WHEN changing todo type from "todo" to "routine", THE system SHALL delete the existing calendar event

### Requirement 10

**User Story:** As a developer, I want to track calendar synchronization state, so that the system can handle sync failures and retries properly.

#### Acceptance Criteria

1. WHEN a todo is created with calendar sync enabled, THE system SHALL store the Google Calendar event ID in the todo record
2. WHEN calendar sync succeeds, THE system SHALL set sync status to "synced" and store the event ID
3. WHEN calendar sync fails, THE system SHALL set sync status to "failed" and store the error timestamp
4. WHEN a todo is pending sync, THE system SHALL set sync status to "pending" until completion
5. WHEN displaying todos, THE system SHALL show sync status indicators for failed syncs only