1) Completion Coalescing

  - 목적: 같은 completion에 대한 pending queue를 압축해서 불필요한 replay를 줄이는 작업.
  - 현재 문제:
      - completion 토글할 때마다 pending_changes에 그대로 한 줄씩 쌓임
      - 같은 completionKey(todoId_date|null)에 대해 create/delete/create...가 연속으로 남을 수 있음
  - 핵심 아이디어:
      - 같은 completionKey 기준으로 pending을 합치거나 상쇄
      - 예: create -> delete는 제거, create -> delete -> create는 마지막 create만 남김
  - 기대 효과:
      - pending queue 길이 감소
      - 온라인 복귀 후 replay API 호출 감소
      - 복구 속도 개선
      - max ready queue(200) 낭비 감소
  - 성격:
      - queue 정책 최적화
      - correctness는 이미 맞고, 효율/복구 성능을 개선하는 작업
  - 권장 순서:
      - 먼저 진행

  2) Local Completion Tombstone

  - 목적: 로컬 SQLite의 completion 삭제 모델을 서버와 같은 soft delete(deleted_at) 방식으로 맞추는 작업.
  - 현재 문제:
      - 로컬 SQLite는 completion을 DELETE
      - 서버는 deletedAt soft delete 사용
      - 즉, 로컬/서버 삭제 모델이 비대칭임
  - 핵심 아이디어:
      - 로컬 completions 테이블에도 deleted_at 컬럼 추가
      - 삭제 시 hard delete 대신 tombstone 처리
      - 조회는 deleted_at IS NULL만 활성 completion으로 간주
  - 기대 효과:
      - 로컬/서버 모델 대칭화
      - delta/replay/cascade reasoning 단순화
      - 삭제/복구 추적이 더 명확해짐
      - 장기 유지보수성 개선
  - 성격:
      - DB schema migration + read/write/delete contract 변경
      - coalescing보다 훨씬 무겁고 신중해야 하는 작업
  - 권장 순서:
      - coalescing 안정화 후 나중에 별도 진행

  한 줄 요약:

  - coalescing = queue 효율 최적화
  - tombstone = 로컬 삭제 모델을 서버와 맞추는 구조 정리







  달력


  지금 5번 범위는 이렇습니다.

  파일:
  WeekFlowMonthly.js:39

  현재 값:

  - MONTHLY_VISIBLE_WEEK_COUNT = 5
  - SUMMARY_BUFFER_BEFORE_WEEKS = 4
  - SUMMARY_BUFFER_AFTER_WEEKS = 4

  즉 monthly에서 summary는:

  - 화면에 보이는 5주
  - 앞 4주
  - 뒤 4주

  합쳐서 총 13주 정도를 한 번에 active range로 잡습니다.

  계산 위치:
  WeekFlowMonthly.js:489

  대략:

  - 시작 = topWeekStart - 4주
  - 끝 = topWeekStart + (보이는 5주 + 뒤 4주) - 1일

  즉 지금은 monthly dot summary를 위해 약 3개월치 정도를 주변까지 미리 확보하는 상태입니다.
  더 가볍게 하려면 여기서 4/4를 2/2나 3/2 정도로 줄이는 식으로 가는 겁니다.