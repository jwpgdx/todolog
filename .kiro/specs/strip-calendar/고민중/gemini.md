### 1. 요구사항 (Requirements)
1.  **Weekly Mode:** 가로 스와이프(Horizontal Swipe)로 주 단위 이동.
2.  **Monthly Mode:** 세로 스크롤(Vertical Scroll)로 무한 날짜 탐색.
3.  **Transition:** 하단 핸들을 잡아당기면(Swipe Down) 주간 → 월간으로 펼쳐짐.
4.  **성능:** 메인 화면이므로 절대 버벅이면 안 됨.

---

### 3. [나의 해결책] : 하이브리드 Swap & Expand 전략

**Step 1. Weekly 상태 (Default)**
* 가벼운 `Horizontal FlashList`만 렌더링.
* `Vertical List`(월간)는 **Unmount** 상태 (메모리 0).

**Step 2. 확장 시작 (Interaction Start)**
* 사용자가 핸들을 내리는 순간, `Vertical FlashList`를 **Mount**함.
* 이때, `initialScrollIndex`를 사용하여 **현재 주(Current Week)** 위치에 정확히 오버레이(Overlay) 함.
* 사용자 눈에는 변화가 없어 보임 (Seamless).

**Step 3. 애니메이션 (Expansion)**
* `LayoutAnimation` 또는 `Reanimated`를 사용.
* 컨테이너 `Height`를 늘리면서 마스킹된 영역을 보여줌. (`overflow: hidden`)
* 내부 콘텐츠 찌그러짐 방지를 위해 `scaleY` 대신 **`translateY` + Masking** 기법 사용.

**Step 4. Monthly 상태 (Scroll)**
* 이제부터는 **Vertical `FlashList`**가 무한 스크롤을 담당. (Dev A의 가상화 이점 활용)
* 다시 줄일 때는 반대로 동작 후 Vertical List를 Unmount.

---

### 🧐 검토 요청 (Questions)

위 [나의 해결책]에 대해 다음 3가지를 검토해 주세요.

1.  **초기 렌더링 렉(Lag) 위험:**
    스와이프 제스처가 시작되는 순간 `Vertical FlashList`를 Mount하면, 리스트 초기화 비용 때문에 **애니메이션 첫 프레임이 튀거나(Jank) 버벅일 위험**이 있지 않을까요?
    (만약 그렇다면, 미리 렌더링해놓고 `opacity: 0`으로 숨기는 게 나을까요?)

2.  **데이터 동기화:**
    두 개의 리스트(Horizontal / Vertical)가 공존하는데, `FlashList` 간의 스크롤 위치 동기화(`scrollToIndex`)가 사용자 눈에 띄지 않을 만큼 즉각적으로 이루어질까요?

3.  **최종 판정:**
    이 "Swap & Mount" 전략이 메인 화면 성능 최적화의 **Best Practice**가 맞습니까? 수정이 필요하다면 조언 부탁합니다.

