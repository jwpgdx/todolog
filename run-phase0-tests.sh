#!/bin/bash

export BASE_URL="http://localhost:5001/api"
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxZGFhYmEyOC05ZjcwLTRlNGUtOTNiMS01YTc0MzNkZjU1NTkiLCJpYXQiOjE3NzE0MDk2MTksImV4cCI6MTc3MjAxNDQxOX0.F3N8UxEx1hPFOLgvQDRuNnqjbxlNwqip5ygZqxISF7o"

echo "========================================="
echo "Phase 0 Contract Validation Test Suite"
echo "========================================="
echo ""

# Setup: Create test category and todos
echo "--- Setup: Creating test data ---"
NEW_CAT=$(curl -s -X POST "$BASE_URL/categories" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Phase0TestCat","color":"#00FF00"}')
NEW_CAT_ID=$(echo $NEW_CAT | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created category: $NEW_CAT_ID"

TODO1=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"P0Test Todo 1\",\"startDate\":\"2026-02-21\",\"categoryId\":\"$NEW_CAT_ID\",\"isAllDay\":true}")
TODO1_ID=$(echo $TODO1 | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created todo 1: $TODO1_ID"

TODO2=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"P0Test Todo 2\",\"startDate\":\"2026-02-22\",\"categoryId\":\"$NEW_CAT_ID\",\"isAllDay\":true}")
TODO2_ID=$(echo $TODO2 | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created todo 2: $TODO2_ID"

TODO3=$(curl -s -X POST "$BASE_URL/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"P0Test Todo 3\",\"startDate\":\"2026-02-23\",\"categoryId\":\"$NEW_CAT_ID\",\"isAllDay\":true}")
TODO3_ID=$(echo $TODO3 | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created todo 3: $TODO3_ID"

echo ""
echo "========================================="
echo "TEST CASE 1: Category Delete Safety"
echo "========================================="
echo ""
echo "Expected: Todos moved to default category, no hard delete"
echo ""
echo "Request: DELETE /categories/$NEW_CAT_ID"
RESULT1=$(curl -s -X DELETE "$BASE_URL/categories/$NEW_CAT_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $RESULT1"
echo ""

MOVED_COUNT=$(echo $RESULT1 | grep -o '"movedTodoCount":[0-9]*' | cut -d':' -f2)
echo "Moved Todo Count: $MOVED_COUNT"
echo ""

# Verify todos still exist
echo "Verifying todos still exist..."
TODO1_CHECK=$(curl -s -X GET "$BASE_URL/todos?date=2026-02-21" \
  -H "Authorization: Bearer $TOKEN" | grep -o "$TODO1_ID")
if [ -n "$TODO1_CHECK" ]; then
  echo "✓ Todo 1 still exists"
else
  echo "✗ Todo 1 NOT FOUND (FAIL)"
fi

echo ""
echo "========================================="
echo "TEST CASE 2: Category Delete Idempotency"
echo "========================================="
echo ""
echo "Expected: Success-equivalent response, alreadyDeleted=true"
echo ""
echo "Request: DELETE /categories/$NEW_CAT_ID (2nd time)"
RESULT2=$(curl -s -X DELETE "$BASE_URL/categories/$NEW_CAT_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $RESULT2"
echo ""

if echo "$RESULT2" | grep -q "alreadyDeleted"; then
  echo "✓ PASS: Idempotent delete confirmed"
else
  echo "✗ FAIL: No idempotent marker"
fi

echo ""
echo "========================================="
echo "TEST CASE 3: Completion Create Idempotency"
echo "========================================="
echo ""
echo "Expected: 1st create succeeds, 2nd create returns idempotent success"
echo ""

COMP_ID="test-comp-$(date +%s)"
echo "Request 1: POST /completions (todoId=$TODO1_ID, date=2026-02-21)"
COMP1=$(curl -s -X POST "$BASE_URL/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"_id\":\"$COMP_ID\",\"todoId\":\"$TODO1_ID\",\"date\":\"2026-02-21\",\"isRecurring\":false}")
echo "Response 1: $COMP1"
echo ""

echo "Request 2: POST /completions (same key)"
COMP2=$(curl -s -X POST "$BASE_URL/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"_id\":\"different-id\",\"todoId\":\"$TODO1_ID\",\"date\":null,\"isRecurring\":false}")
echo "Response 2: $COMP2"
echo ""

if echo "$COMP2" | grep -q "idempotent"; then
  echo "✓ PASS: Idempotent create confirmed"
else
  echo "✗ FAIL: No idempotent marker"
fi

echo ""
echo "========================================="
echo "TEST CASE 4: Completion Delete Tombstone"
echo "========================================="
echo ""
echo "Expected: Soft delete (deletedAt set), not hard delete"
echo ""

echo "Request: DELETE /completions/$TODO1_ID?isRecurring=false"
COMP_DEL=$(curl -s -X DELETE "$BASE_URL/completions/$TODO1_ID?isRecurring=false" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $COMP_DEL"
echo ""

# Check delta sync shows deleted
echo "Checking delta sync for deleted completion..."
DELTA=$(curl -s -X GET "$BASE_URL/completions/delta-sync?lastSyncTime=2026-02-18T00:00:00.000Z" \
  -H "Authorization: Bearer $TOKEN")
echo "Delta response (deleted array):"
echo "$DELTA" | grep -o '"deleted":\[[^]]*\]'
echo ""

if echo "$DELTA" | grep -q "$TODO1_ID"; then
  echo "✓ PASS: Deleted completion appears in delta"
else
  echo "✗ FAIL: Deleted completion NOT in delta"
fi

echo ""
echo "========================================="
echo "TEST CASE 5: Completion Delete Idempotency"
echo "========================================="
echo ""
echo "Expected: 2nd delete returns success-equivalent"
echo ""

echo "Request: DELETE /completions/$TODO1_ID?isRecurring=false (2nd time)"
COMP_DEL2=$(curl -s -X DELETE "$BASE_URL/completions/$TODO1_ID?isRecurring=false" \
  -H "Authorization: Bearer $TOKEN")
echo "Response: $COMP_DEL2"
echo ""

if echo "$COMP_DEL2" | grep -q "alreadyDeleted"; then
  echo "✓ PASS: Idempotent delete confirmed"
else
  echo "✗ FAIL: No idempotent marker"
fi

echo ""
echo "========================================="
echo "TEST CASE 6: Todo Delete Idempotency"
echo "========================================="
echo ""

echo "Request 1: DELETE /todos/$TODO2_ID"
TODO_DEL1=$(curl -s -X DELETE "$BASE_URL/todos/$TODO2_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "Response 1: $TODO_DEL1"
echo ""

echo "Request 2: DELETE /todos/$TODO2_ID (2nd time)"
TODO_DEL2=$(curl -s -X DELETE "$BASE_URL/todos/$TODO2_ID" \
  -H "Authorization: Bearer $TOKEN")
echo "Response 2: $TODO_DEL2"
echo ""

if echo "$TODO_DEL2" | grep -q "alreadyDeleted"; then
  echo "✓ PASS: Todo delete idempotency confirmed"
else
  echo "✗ FAIL: No idempotent marker"
fi

echo ""
echo "========================================="
echo "Phase 0 Validation Complete"
echo "========================================="
