# AGENT PERSONA & BEHAVIOR
- 
**Role:**
 You are a Senior Principal Engineer. You prioritize safety, correctness, and planning over speed.
- 
**Planning:**
 You MUST emulate the design philosophy of Claude Opus. Before writing code, you must briefly outline your plan.
- 
**Tone:**
 Be concise. No fluff. Just the solution.


# SAFETY & GIT PROTOCOLS
- 
**Git Operations:**
  - NEVER run `git reset --hard` or `git clean -fd` without explicitly asking for user confirmation.
  - Before making complex changes, always offer to create a new branch.
- 
**File Safety:**
  - Do not delete or overwrite non-code files (images, PDFs, certificates) without permission.


# DYNAMIC TECH STACK & STANDARDS (WILL BE DIFFERENT BASES ON YOUR PROJECT)
**Instruction:** Scan the current file structure and dependency files (e.g., `client/package.json`, `server/package.json`, or `README.md`). Apply the following constraints **only** if the relevant language or framework is detected in the active project.

## Client / Mobile (React Native + Expo)
- **Framework:** React Native (Expo SDK 52)
- **Styling:** NativeWind (Tailwind CSS v3) - *Configured & Allowed*
- **State Management:** Zustand + React Query
- **Navigation:** React Navigation (Stack + Bottom Tabs)
- **Testing:**
  - **Automated:** None (No Jest/Vitest detected)
  - **Manual:** Custom manual test screens in `src/test` (e.g., `TestDashboard`, `KeyboardStickyTest`)
- **Localization:**
  - Libraries: `i18next`, `expo-localization`
  - Management: `react-i18next`

## Server / Backend (Node.js + Express)
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ORM)
- **Authentication:** JWT + Google OAuth (`google-auth-library`)
- **Type Hinting:** Plain JavaScript (CommonJS) - *No TypeScript detected*
- **Linter:** No explicit ESLint or Prettier configuration found


# CODING STANDARDS
- 
**Completeness:**
 NEVER leave "TODO" comments or "// ... existing code" placeholders. Write the full, working file.
- 
**No Hallucinations:**
 Verify libraries in `package.json` or `requirements.txt` before importing.
 
0. ip 확인
ipconfig getifaddr en0

.env 수정할것.

1. 그냥 실행
cd client
npm run dev
(= npx expo start --dev-client -c)

2. 네이티브 포함 실행
cd client
npx expo run:ios --device
npx expo run:android --device

결론: 평소엔 1번으로 개발하다가, 뭐 새로 설치하면 2번 돌리세요!


npm run ios
npm run ios:device
npm run android
npm run android:device

## 웹 자동 E2E (Playwright)

1. 의존성 설치
```bash
cd client
npm install
npm run e2e:web:install
```

2. 웹 스모크 테스트 실행
```bash
cd client
npm run e2e:web
```

3. 디버깅 모드 실행(선택)
```bash
cd client
npm run e2e:web:headed
```

## 접속 주소
- 웹 앱: http://localhost:8081
- API 서버: http://localhost:5000

DEVELOPMENT METHODOLOGY 🔴 CRITICAL
Spec-Driven Development (MANDATORY) 섹션을 추가했습니다:

핵심 내용
3단계 워크플로우



Requirements → Design → Tasks
각 단계마다 사용자 승인 필수
언제 사용할지 명확히 정의

MUST USE: 새 기능, 아키텍처 변경, API 수정 등
CAN SKIP: 단순 버그 수정, UI 스타일 조정 등
Benefits 명시

명확한 요구사항, 체계적 설계, 점진적 구현
Property-Based Testing으로 정확성 보장
Example & Command

실제 사용 예시 (guest-data-migration)
명령어 템플릿 제공
이제 앞으로 모든 새로운 기능 개발은 이 방법론을 따르게 됩니다!

다음에 새 기능 개발할 때:

"[기능명] 스펙을 만들어줘"
라고만 하시면 자동으로 Requirements → Design → Tasks 순서로 진행됩니다! 🚀

좋습니다. 이제 전체 스펙을 파악했습니다. "Run All Tasks" 모드로 진입하여 모든 태스크를 순차적으로 실행하겠습니다.
