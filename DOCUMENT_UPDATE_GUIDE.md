# 문서 업데이트 가이드 (빠른 체크용)

마지막 업데이트: 2026-02-22

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

5. 날짜 선택/오늘 표시/타임존 반응 로직이 바뀜:
- 필수: `PROJECT_CONTEXT.md`
- 필수: 해당 feature spec (`.kiro/specs/<feature>/requirements.md`)
- 필요 시: `README.md`, `ROADMAP.md`
- 메모: `currentDate`(selected)와 `todayDate`(derived)를 분리해 문서에 명시

6. Codex/Kiro 공통 AI 규칙이 바뀜:
- 필수: `AI_COMMON_RULES.md`
- 보통 불필요: `AGENTS.md`, `.kiro/steering/requirements.md`

7. Codex 시작 규칙만 바뀜:
- 필수: `AGENTS.md`

8. Kiro 시작 규칙만 바뀜:
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
- [ ] 날짜 로직 변경 시 `currentDate`(selected) / `todayDate`(derived) 분리가 문서에 명시되었는가?
- [ ] 외부 AI 검토를 사용했다면 finding을 `must-fix / optional / reject`로 분류하고, 근거와 처리결과를 리뷰 문서에 기록했는가?

## 5) AI 검토 프롬프트 운영 규칙

1. "공통 운영 원칙"은 `AI_COMMON_RULES.md`에 저장한다.
2. "복붙용 프롬프트 템플릿"은 이 문서(`DOCUMENT_UPDATE_GUIDE.md`)에 저장한다.
3. `AGENTS.md`에는 긴 프롬프트 템플릿을 넣지 않는다. (시작 규칙만 유지)
4. 검토 결과 파일은 해당 스펙 폴더(`.kiro/specs/<feature>/`)에 저장한다.
5. 검토 후 구현 착수 전 `must-fix / optional / reject` triage를 수행하고, `must-fix` 처리 여부를 명시한다.

## 6) 부록: 엄격 스펙 검토 프롬프트 템플릿 (EN)

아래 템플릿에서 경로/범위만 바꿔 사용한다.

```text
Role:
You are a senior React Native offline-first architecture reviewer.
Your goal is strict spec-quality validation only. Do NOT propose implementation code.

Context (hard constraints):
1) TO-BE-first principle
2) Current phase status and target scope

Primary docs to review:
1. <requirements.md path>
2. <design.md path>
3. <tasks.md path>

Reference docs:
1. <related upstream/downstream spec path>
2. <ROADMAP / PROJECT_CONTEXT path>
3. <pre-spec baseline path>

Review criteria:
A) Principle compliance
B) Architectural correctness
C) Test/operational safety
D) Overdesign vs underdesign

Output format (must follow exactly):
1) Findings first, ordered by severity
- [Critical]/[High]/[Medium]/[Low]
- include file + section/sentence evidence
- why problem + risk + 1-2 line fix direction
2) Open Questions (must-decide only)
3) Patch Proposal (copy-pastable add/replace/delete text)
4) Final Verdict: "Ready to implement" / "Conditionally ready" / "Needs rewrite"

Hard rules:
1) No evidence-free claims.
2) No vague statements.
3) If gap exists, provide exact replacement/addition wording.
4) Focus on defects/risks/corrections.
5) No unrelated large-scope feature proposals.
```
