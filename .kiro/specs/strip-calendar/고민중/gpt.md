# 📌 캘린더 구조 설계 고민 정리 (Weekly ↔ Monthly 전환)

## 1️⃣ 현재 요구사항

### UI 요구사항

* **Weekly 모드**

  * 가로 스와이프 또는 화살표로 주 이동
  * 한 화면에 7일 표시
  * 예: `29 | 30 | 31 | (2월) 1 | 2 | 3 | 4`

* **Monthly 모드**

  * 세로 무한 스크롤
  * 월 단위로 스크롤 가능
  * 최대 5~6주 (35~42칸)

* **Weekly ↔ Monthly 전환 애니메이션**

  * 위/아래 스와이프 기반
  * 자연스럽고 부드러운 전환 필요
  * 텍스트/도트 찌그러짐 없이 처리

---

## 2️⃣ 핵심 고민 포인트

### ❓ 1. 숨겨진 월 데이터가 계속 남아있으면 느려지지 않나?

* UI가 남아있으면 성능 저하 가능
* 하지만 **데이터(Map, 이벤트 캐시)는 남아있어도 문제 없음**
* 진짜 문제는 **렌더링되는 뷰 트리와 리렌더 비용**

---

### ❓ 2. 월을 다 렌더해두고 height 0으로 숨기는 방식은?

❌ 잘못된 방식

* opacity: 0
* height: 0
* translateY로 화면 밖 이동

이렇게 숨겨도:

* 리렌더는 계속 발생
* 레이아웃 계산 가능
* 메모리 유지

→ “숨김”은 해결이 아님
→ **Unmount / Virtualization이 정답**

---

## 4️⃣ 최적 아키텍처 제안 (권장 구조)

# ✅ Mode 분리 전략

## Weekly Mode

* Virtual 3-page 방식

  * Prev / Current / Next
* 항상 **21칸만 존재**
* Horizontal scroll
* Month UI는 존재하지 않음

---

## Monthly Mode

* Vertical Infinite Scroll
* FlashList 또는 FlatList 사용
* 아이템 구성 선택지:

### 옵션 A: Month 단위 아이템

* 1 item = 1 month (35~42칸)
* UX 자연스러움
* 약간 무거움

### 옵션 B: Week 단위 아이템

* 1 item = 1 week (7칸)
* 가장 가벼움
* 월 헤더 처리가 더 복잡

---

## 🔥 핵심 원칙

* Weekly 모드일 때 Monthly 컴포넌트는 **Unmount**
* Monthly 모드일 때 Weekly 컴포넌트는 **Unmount**
* 두 모드를 동시에 유지하지 않음

→ 항상 하나의 엔진만 동작

---

## 5️⃣ Weekly ↔ Monthly 전환 방식

### ❌ scaleY 금지

* 텍스트 찌그러짐
* 터치 영역 왜곡
* 웹 대응 어려움

### ✅ 권장 방식

* Row 단위 translateY + opacity
* 컨테이너 overflow: hidden (Masking)
* height 애니메이션은 컨테이너 1개만

---

## 6️⃣ 성능 병목 TOP 3

1. DayCell 리렌더 폭발
2. 이벤트/도트 계산을 매 렌더 수행
3. 숨겨진 월 UI가 계속 살아있음

---

## 7️⃣ 성능 안정 체크리스트

* [ ] Weekly는 항상 21칸만 존재
* [ ] Monthly는 Virtualization 적용
* [ ] 모드 전환 후 이전 모드 Unmount
* [ ] DayCell React.memo 적용
* [ ] 이벤트 데이터는 dateKey 기반 캐시(Map)
* [ ] 렌더 중 이벤트 계산 금지

---

## 8️⃣ 결론

* "보이는 곳만 줄이는 것"이 아니라
  **UI 트리를 최소화하고, 필요할 때만 렌더하는 구조가 핵심**
* 데이터는 캐시로 유지해도 괜찮음
* 가상화 + 모드 분리 + unmount 전략이 가장 안전함
* FlashList는 Monthly에서 사용, Weekly는 3-page 방식 유지가 이상적

---

# 🎯 최종 요약

> Weekly = 가로 3주 고정 (21칸)
> Monthly = 세로 가상화 리스트
> 전환 시 한쪽은 완전히 unmount
> scale 대신 translateY + masking
> 데이터는 캐시, UI는 최소

---
