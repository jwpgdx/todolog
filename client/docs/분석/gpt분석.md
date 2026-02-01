ㅋㅋ 좋다 이 질문. 지금 딱 **“개념이 연결되는 지점”**이야.
지금 구조를 정확히 짚고, **SQLite 도입 후 구조가 어떻게 바뀌는지**를 그림 없이 머릿속에 박히게 설명해줄게.

---

# 0️⃣ 지금 니가 하고 있는 구조 (팩트 정리)

지금은 사실상 이거임 👇

```
[서버]
  └─ 모든 일정 데이터

[클라이언트]
  ├─ AsyncStorage = 전체 일정 영구 저장소 (DB 흉내)
  └─ React Query = 화면용 캐시
```

### 중요한 포인트

* **AsyncStorage가 사실상 “로컬 DB 역할”**
* React Query는 그 위에 얹힌 **뷰 캐시**
* 문제는 AsyncStorage가 **DB가 아니라 JSON 파일**이라는 것

---

# 1️⃣ SQLite로 바뀌면 “역할 분리”가 생김

SQLite 도입의 핵심은 **데이터의 역할을 분리**하는 거다.

## 🔥 핵심 구조 (정답)

```
[서버]
  └─ 전체 일정 데이터 (Delta Sync)

[클라이언트]
  ├─ SQLite = 전체 일정의 로컬 원본 (Source of Truth)
  └─ React Query = 화면에 필요한 "부분 집합" 캐시
```

👉 **“전체 저장 ↔ 화면 캐싱” 구조는 그대로**
👉 **저장소만 AsyncStorage → SQLite로 바뀜**

---

# 2️⃣ 가장 중요한 개념: 캐싱의 기준이 바뀜

## ❌ 지금 (잘못된 캐싱 단위)

```
React Query
  └─ ['todos', 'all']  ← 전부
  └─ ['completions']  ← 전부
```

이게 성능 박살의 근원임.

---

## ✅ SQLite 이후 (정상적인 캐싱 단위)

```
React Query
  ├─ ['todos', '2026-02-01']
  ├─ ['todos', '2026-02-02']
  ├─ ['calendar', '2026-02']
  └─ ['completions', '2026-02-02']
```

👉 **날짜 / 화면 단위 캐시**
👉 “보여질 것만 메모리에”

---

# 3️⃣ 실제 데이터 흐름 (중요)

## ① 서버 ↔ 로컬 동기화 (변경 없음)

```text
서버 delta-sync
  ↓
SQLite INSERT / UPDATE / DELETE
```

🔹 이 단계에서는 **React Query 아예 신경 안 써도 됨**

---

## ② 화면에서 일정 보여줄 때

### 예: 2026-02-01 일정 화면

```ts
useQuery({
  queryKey: ['todos', '2026-02-01'],
  queryFn: () => db.getTodosByDate('2026-02-01'),
});
```

### 실제 동작

```
1. React Query 캐시 있음?
   └─ YES → 바로 렌더
   └─ NO  → SQLite 쿼리

2. SQLite
   └─ SELECT * FROM todos WHERE date = '2026-02-01'
   └─ JOIN completions
```

---

## ③ Completion 토글할 때

```ts
await db.toggleCompletion(todoId, date);

queryClient.invalidateQueries(['todos', date]);
queryClient.invalidateQueries(['calendar', month]);
```

### 이게 의미하는 바

* **DB는 즉시 변경**
* **UI는 invalidate → 다시 SELECT**

👉 JSON 전체 다시 쓰는 개념 자체가 사라짐

---

# 4️⃣ “전체 일정은 어디 있냐?”라는 질문의 답

### 💡 이 질문이 핵심이다

> “그럼 전체 일정은 어디 저장돼 있음?”

👉 **SQLite 안에 항상 있음**

```
SQLite
 ├─ todos (전부)
 ├─ completions (전부)
 └─ categories
```

React Query는:

* 전체를 **가지고 있지 않음**
* 필요할 때만 slice 가져옴

---

# 5️⃣ 캘린더 화면은 어떻게 바뀌냐?

### 지금

```ts
const allTodos = queryClient.getQueryData(['todos', 'all']);
const monthTodos = filterByMonth(allTodos);
```

### SQLite 이후

```ts
SELECT date, COUNT(*) 
FROM completions
WHERE date LIKE '2026-02%'
GROUP BY date;
```

또는

```ts
useQuery(['calendar', '2026-02'], () =>
  db.getCalendarStats('2026-02')
);
```

👉 캘린더 dot 찍으려고 **5만 개를 메모리에 둘 이유가 없음**

---

# 6️⃣ 캐싱 전략 한 줄 요약 (이거 외워라)

> ❌ “전체 데이터를 캐싱하고 필터링”
> ✅ “필요한 데이터만 쿼리하고 캐싱”

---

# 7️⃣ 니 앱 기준 최종 구조 (그림으로 정리)

```
서버 (MongoDB)
   ↓ delta sync
SQLite (전체 일정 로컬 DB)
   ↓ SELECT (date / month)
React Query (화면 캐시)
   ↓
UI
```

---

# 8️⃣ 실무에서 자주 터지는 실수 (경고)

* ❌ SQLite 쓰면서도 `getAllTodos()` 만들어서 캐싱함
* ❌ React Query에 DB 전체 넣음
* ❌ invalidate 안 하고 optimistic update로만 버팀

이러면 **SQLite 도입 의미 0**임.

---

## 결론 한 줄

> **SQLite는 “전체 데이터를 저장하는 곳”이고
> React Query는 “지금 화면에 필요한 조각”만 들고 있는다.**

다음으로 갈 수 있는 선택지:

1. SQLite 쿼리 함수 구조 설계
2. todos + completions JOIN 전략
3. Calendar dot 최적 쿼리
4. Delta Sync → SQLite 적용 코드 흐름

다음 뭐 볼까?
