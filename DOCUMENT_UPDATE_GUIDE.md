# 문서 업데이트 가이드 (빠른 체크용)

마지막 업데이트: 2026-02-13

## 1) 기본 원칙

- `AGENTS.md`: Codex 시작 문서
- `.kiro/steering/requirements.md`: Kiro 시작 문서
- `AI_COMMON_RULES.md`: Codex/Kiro 공통 규칙 원본
- `PROJECT_CONTEXT.md`: 현재 구현/동작의 사실(SOT)
- `README.md`: 외부 공개용 온보딩/실행 가이드
- `ROADMAP.md`: 완료 이력 + 다음 계획
- `.kiro/specs/<feature>/`: 기능별 요구/설계/태스크

## 2) 상황별 업데이트 대상

1. 코드 구현/동작이 바뀜:
- 필수: `PROJECT_CONTEXT.md`
- 필요 시: `README.md`, `ROADMAP.md`, 해당 feature spec

2. 실행 방법/환경변수/온보딩이 바뀜:
- 필수: `README.md`
- 필요 시: `PROJECT_CONTEXT.md`

3. 일정/우선순위/마일스톤이 바뀜:
- 필수: `ROADMAP.md`

4. 기능 요구/설계/작업 계획이 바뀜:
- 필수: `.kiro/specs/<feature>/requirements.md`
- 필수: `.kiro/specs/<feature>/design.md`
- 필수: `.kiro/specs/<feature>/tasks.md`
- 필요 시: `PROJECT_CONTEXT.md`, `README.md`, `ROADMAP.md`

5. Codex/Kiro 공통 AI 규칙이 바뀜:
- 필수: `AI_COMMON_RULES.md`
- 보통 불필요: `AGENTS.md`, `.kiro/steering/requirements.md`

6. Codex 시작 규칙만 바뀜:
- 필수: `AGENTS.md`

7. Kiro 시작 규칙만 바뀜:
- 필수: `.kiro/steering/requirements.md`

## 3) 빠른 의사결정 순서

1. 이 변경이 “공통 AI 규칙”인가?
- Yes -> `AI_COMMON_RULES.md`

2. 이 변경이 “툴 시작 규칙(Codex/Kiro 전용)”인가?
- Yes -> `AGENTS.md` 또는 `.kiro/steering/requirements.md`

3. 이 변경이 “프로젝트 실제 동작/구현”인가?
- Yes -> `PROJECT_CONTEXT.md`

4. 이 변경이 “외부 공개용 실행 안내”인가?
- Yes -> `README.md`

5. 이 변경이 “일정/계획/이력”인가?
- Yes -> `ROADMAP.md`

6. 이 변경이 “특정 기능 요구/설계/태스크”인가?
- Yes -> `.kiro/specs/<feature>/` 3종 문서

## 4) 작업 종료 전 체크리스트

- [ ] 구현 변경 사항이 `PROJECT_CONTEXT.md`에 반영되었는가?
- [ ] 사용자 실행/설치/환경변수 영향이 있으면 `README.md`를 갱신했는가?
- [ ] 마일스톤/계획이 바뀌면 `ROADMAP.md`를 갱신했는가?
- [ ] 기능 변경이면 해당 spec 3종 문서를 갱신했는가?
- [ ] 공통 AI 규칙 변경 시 `AI_COMMON_RULES.md`를 기준으로 반영했는가?

