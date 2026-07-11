# Custom Drag Engine Fix

Last Updated: 2026-05-14
Status: 핵심 UX 수정 완료, Todo Screen 카테고리순에서 수동 검증 완료, 상단 즐겨찾기 drop 확장 진행 중

## 완료

1. 카테고리 header reorder 시작 시 이동 중인 카테고리만 접는 대신, 펼쳐져 있던 전체 카테고리 group을 임시로 접도록 수정했다.
2. 카테고리 header를 꾹 눌러 메뉴가 열린 상태에서 손을 떼도, 메뉴가 열려 있는 동안에는 해당 카테고리가 임시로 접힌 상태를 유지하도록 수정했다.
3. 카테고리 header drag preview가 텍스트만 떠 보이지 않도록, 배경과 shadow가 있는 snapshot wrapper를 적용했다.
4. 일정과 카테고리 drag 중 표시되는 drop indicator line을 list 전체 폭 기준으로 표시하도록 수정했다.
5. 메뉴에서 drag로 전환할 때 손가락과 preview 사이가 벌어지는 문제를 줄이기 위해, threshold를 넘은 위치가 아니라 원래 long-press 지점을 drag anchor로 사용하도록 수정했다.
6. 카테고리 이동 중 header가 사라져 보이는 증상은 snapshot wrapper와 drag anchor 수정 후 재현되지 않는 상태로 확인했다.
7. 접힌 카테고리 hover auto-expand 판정을 `indexPathForItem(at:)` 단일 hit-test 대신 section header frame + hit slop 기준으로 바꿨다. 헤더 경계나 gap 근처에서 timer가 끊겨 자동 펼침이 불안정한 문제를 줄이기 위한 수정이다.
8. 접힌 카테고리가 drag hover로 자동 펼쳐진 뒤 drop하면 다시 닫히는 문제를 막기 위해, reorder commit보다 section expand event를 먼저 JS로 보낸다.
9. 다른 카테고리로 일정 이동 후 한 텀 늦게 정렬되는 느낌을 줄이기 위해, batch reorder에서도 React Query optimistic cache update를 적용했다.

## 진행 중

1. `TODO SCREEN > 카테고리순`, `ALL TODOS SCREEN`은 상단 `favorites` section을 같은 top favorites interaction model로 사용한다.
2. `TODO SCREEN > 시간순`은 기본적으로 flat list 규칙을 유지하되, 일반 일정이나 시간 지정 일정을 상단 `favorites` section으로 drop 하는 경우만 custom drag engine으로 처리한다.
3. `favorites` section으로 drop 할 때는 `dropTargetable=false`인 시간 지정 일정도 허용한다. 이 경우 시간순 / 카테고리순 위치는 바꾸지 않고 `favorite_order`만 저장한다.
4. `favorites` section에서 일반 목록으로 drag out 하면 즐겨찾기를 해제한다. JS는 `favorite_order = null`을 저장하고, 대상 화면 규칙에 맞는 `custom_order` 또는 `category_order`만 추가로 반영한다.
5. 시간순에서 `favorites` 항목을 시간 지정 영역으로 drag out 하면, 시간 있는 일정 사이에 삽입하지 않고 시간 없는 일반 일정 영역의 첫 위치로 보정한다.
6. native reorder payload는 `fromSectionId`, `toSectionId`, `sections[].orderedItemIds`를 기준으로 JS가 저장 대상을 판단한다. `toSectionId === "favorites"`이면 JS는 `favorite_order`만 변경하고, `fromSectionId === "favorites"`이면 JS는 `favorite_order`를 비운다.

## 후속

1. 메뉴에서 reorder로 전환되는 순간의 딜레이/끊김은 별도 polish로 남긴다. 현재는 메뉴 제거, drag preview 생성, list collapse가 한 번에 일어나서 구조적으로 약간 끊겨 보일 수 있다.
2. 향후 개선 방향은 long-press 시점의 lifted preview를 drag preview로 재사용하고, 손가락에 preview를 먼저 붙인 뒤 list collapse를 뒤에서 처리하는 방식이다.
3. Native menu 공통화는 별도 작업으로 남긴다. 현재 iOS 메뉴는 `NativeListInteractions` 내부 Swift overlay이며, 앱 전체 공통 메뉴 컴포넌트와 직접 공유되는 구조는 아니다.
4. 일정 item preview와 카테고리 header preview 디자인은 나중에 분리한다. 현재는 동작 안정성이 우선이다.
5. 카테고리 header의 일정 개수 표시는 expand/collapse 아이콘 왼쪽에 넣는 방향으로 별도 처리한다.
6. 일정 full-swipe 삭제는 오동작 위험이 있으므로 별도 UX 결정 후 진행한다.
7. 카테고리 header 메뉴의 `카테고리로 이동` 액션은 나중에 CategoryTodosScreen 진입 기능으로 추가한다.
8. 열림/닫힘 아이콘 애니메이션과 최종 visual polish는 후순위로 둔다.
