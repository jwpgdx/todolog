# 화면어댑터 레이어 프리스펙 베이스라인

작성일: 2026-02-21
상태: Draft

## 목적

공통 조회/집계 레이어 출력(Handoff DTO)을 화면별 렌더 shape로 변환하는 규칙을 분리 관리한다.

## 범위

1. TodoScreen/TodoCalendar/StripCalendar 변환 규칙
2. 화면별 표시 메타(예: day cap, overflow, dot dedupe)
3. DebugScreen 화면 비교 검증

## 비범위

1. 공통 조회/판정/병합 로직
2. recurrenceEngine 내부
3. 서버/Sync 파이프라인

## 선행조건

1. 공통 조회/집계 레이어 체크포인트 완료
2. handoff DTO 계약 확정

## 연결 문서

1. `.kiro/specs/common-query-aggregation-layer/design.md`
2. `.kiro/specs/screen-adapter-layer/requirements.md`
3. `.kiro/specs/screen-adapter-layer/tasks.md`
