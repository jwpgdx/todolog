**[System Context]**
I am developing an **Offline-First Infinite Scroll Calendar** using **React Native (Expo)**, **FlashList**, and **SQLite**.

**[Current Status: Phase 1 Completed]**
* **Grid Engine:** Built with `FlashList`. Capable of scrolling 100+ months smoothly (60fps).
* **State Management:** Lightweight Zustand store (stores only metadata `{ year, month, id }`, no heavy Date objects).
* **Layout:** Fixed 6-week layout per month to prevent layout shifts.

**[Phase 2 Goal: Data Integration]**
I need to fetch Todo data from SQLite and render it on the calendar without causing frame drops during rapid scrolling.

**[Proposed Architecture for Verification]**
My current plan is a **"Lazy Loading + Map Caching"** strategy. Please review this architecture and tell me if it's optimal or if there are potential risks (e.g., Memory Leaks, Stale Data).


### 1. State Structure (Zustand)
Instead of a single giant array, I plan to use a **Map (Object)** keyed by month.
```javascript
// Store State
todosByMonth: {
  '2026-01': [ ... ], // Cached
  '2026-02': [ ... ], // Cached
  // '2026-03': undefined // Not loaded yet
}

```

### 2. Fetching Strategy (Lazy Loading)

* **Trigger:** When a `MonthSection` component mounts (via `FlashList`), it triggers a `fetchMonthTodos(year, month)` action.
* **Cache Check:**
* If `todosByMonth['2026-02']` exists → **Return immediately** (No DB Query).
* If not → **Query SQLite**.


* **Date Range Query:**
* Since a 6-week calendar includes dates from the prev/next month (padding), the query calculates the exact start/end date visible on the grid.
* Query: `SELECT * FROM todos WHERE date BETWEEN ? AND ?`



### 3. Mutation & Sync (Hybrid Strategy)

* When a user creates/updates/deletes a Todo:
1. **DB Update:** Execute SQLite Transaction.
2. **Store Update (Critical):** I will manually update the specific month's array in `todosByMonth` (Optimistic/Hybrid update).


* *Reason:* To reflect changes immediately in the UI without re-fetching from DB.



---

### [Questions for You]

1. **Performance:** Will this "Fetch-on-Mount" strategy cause stuttering when scrolling fast (e.g., flinging 12 months at once)? Should I debounce the fetch?
2. **Memory:** Storing 100+ months in a `todosByMonth` object might consume too much memory. Should I implement a "Trim/Cleanup" mechanism (e.g., keep only recent 50 months)?
3. **Alternative:** Is there a better pattern for SQLite + Infinite Scroll? (e.g., fetching large chunks like 6 months at a time vs. 1 month at a time?)

Please evaluate this architecture.

