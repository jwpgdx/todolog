import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { todoAPI } from '../api/todos';
import { loadTodos, saveTodos, upsertTodo, removeTodo } from '../storage/todoStorage';
import { getPendingChanges, addPendingChange, clearPendingChanges, replaceTempIdInPending } from '../storage/pendingChangesStorage';
import NetInfo from '@react-native-community/netinfo';

export default function DebugScreen() {
  const [logs, setLogs] = useState([]);
  const queryClient = useQueryClient();

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  };

  // 1. 네트워크 상태 확인
  const checkNetwork = async () => {
    const netInfo = await NetInfo.fetch();
    addLog(`🌐 네트워크: ${netInfo.isConnected ? '온라인' : '오프라인'} (${netInfo.type})`);
  };

  // 2. 로컬 저장소 확인
  const checkLocalStorage = async () => {
    const todos = await loadTodos();
    const pending = await getPendingChanges();
    addLog(`📦 로컬 저장소: ${todos.length}개 할일, ${pending.length}개 대기 중`);
  };

  // 3. 캐시 확인
  const checkCache = () => {
    const date = '2026-01-27';
    const cachedTodos = queryClient.getQueryData(['todos', date]);
    const allTodos = queryClient.getQueryData(['todos', 'all']);
    addLog(`💾 캐시: 날짜별 ${cachedTodos?.length || 0}개, 전체 ${allTodos?.length || 0}개`);
  };

  // 4. 오프라인 일정 생성
  const createOfflineTodo = async () => {
    try {
      const tempId = `temp_${Date.now()}_test`;
      const newTodo = {
        _id: tempId,
        title: `오프라인 테스트 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await upsertTodo(newTodo);
      await addPendingChange({
        type: 'create',
        tempId,
        data: {
          title: newTodo.title,
          categoryId: newTodo.categoryId,
          isAllDay: newTodo.isAllDay,
          startDate: newTodo.startDate,
          endDate: newTodo.endDate,
        },
      });

      // 캐시 업데이트
      const allTodos = await loadTodos();
      queryClient.setQueryData(['todos', 'all'], allTodos);
      
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], todosForDate);

      addLog(`✅ 오프라인 생성: ${newTodo.title} (${todosForDate.length}개)`);
    } catch (error) {
      addLog(`❌ 오프라인 생성 실패: ${error.message}`);
    }
  };

  // 5. 온라인 일정 생성
  const createOnlineTodo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `온라인 테스트 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
      };

      const res = await todoAPI.createTodo(newTodo);
      await upsertTodo(res.data);
      
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      addLog(`✅ 온라인 생성: ${res.data.title}`);
    } catch (error) {
      addLog(`❌ 온라인 생성 실패: ${error.message}`);
    }
  };

  // 6. 오프라인 일정 삭제
  const deleteOfflineTodo = async () => {
    try {
      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 삭제할 일정 없음`);
        return;
      }

      const todoToDelete = todosForDate[0];
      
      // 로컬에서 삭제
      await removeTodo(todoToDelete._id);
      
      // Pending Changes에 추가
      await addPendingChange({
        type: 'delete',
        todoId: todoToDelete._id,
      });

      // 캐시 업데이트
      const updatedTodos = await loadTodos();
      queryClient.setQueryData(['todos', 'all'], updatedTodos);
      
      const updatedTodosForDate = updatedTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], updatedTodosForDate);

      addLog(`✅ 오프라인 삭제: ${todoToDelete.title} (${updatedTodosForDate.length}개)`);
    } catch (error) {
      addLog(`❌ 오프라인 삭제 실패: ${error.message}`);
    }
  };

  // 7. 온라인 일정 삭제
  const deleteOnlineTodo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 삭제할 일정 없음`);
        return;
      }

      const todoToDelete = todosForDate[0];
      
      // 서버에서 삭제
      await todoAPI.deleteTodo(todoToDelete._id);
      
      // 로컬에서도 삭제
      await removeTodo(todoToDelete._id);

      // 캐시 업데이트
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 온라인 삭제: ${todoToDelete.title}`);
    } catch (error) {
      addLog(`❌ 온라인 삭제 실패: ${error.message}`);
    }
  };

  // 8. 오프라인 일정 수정
  const updateOfflineTodo = async () => {
    try {
      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 수정할 일정 없음`);
        return;
      }

      const todoToUpdate = todosForDate[0];
      const updatedData = {
        title: `${todoToUpdate.title} (수정됨)`,
      };

      // 로컬에서 수정
      const todos = await loadTodos();
      const index = todos.findIndex(t => t._id === todoToUpdate._id);
      if (index !== -1) {
        todos[index] = {
          ...todos[index],
          ...updatedData,
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending',
        };
        await upsertTodo(todos[index]);
      }

      // Pending Changes에 추가
      await addPendingChange({
        type: 'update',
        todoId: todoToUpdate._id,
        data: updatedData,
      });

      // 캐시 업데이트
      const updatedTodos = await loadTodos();
      queryClient.setQueryData(['todos', 'all'], updatedTodos);
      
      const updatedTodosForDate = updatedTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], updatedTodosForDate);

      addLog(`✅ 오프라인 수정: ${todos[index].title}`);
    } catch (error) {
      addLog(`❌ 오프라인 수정 실패: ${error.message}`);
    }
  };

  // 9. 온라인 일정 수정
  const updateOnlineTodo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 수정할 일정 없음`);
        return;
      }

      const todoToUpdate = todosForDate[0];
      const updatedData = {
        title: `${todoToUpdate.title} (온라인수정)`,
      };

      // 서버에서 수정
      const res = await todoAPI.updateTodo(todoToUpdate._id, updatedData);
      
      // 로컬에도 저장
      await upsertTodo(res.data);

      // 캐시 업데이트
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 온라인 수정: ${res.data.title}`);
    } catch (error) {
      addLog(`❌ 온라인 수정 실패: ${error.message}`);
    }
  };

  // 10. Pending Changes 처리
  const processPending = async () => {
    try {
      const pending = await getPendingChanges();
      addLog(`🔄 Pending 처리 시작: ${pending.length}개`);

      let success = 0;
      for (const change of pending) {
        try {
          if (change.type === 'create') {
            const res = await todoAPI.createTodo(change.data);
            await removeTodo(change.tempId);
            await upsertTodo(res.data);
            
            // 다른 pending changes에서 이 tempId를 참조하는 경우 실제 ID로 교체
            await replaceTempIdInPending(change.tempId, res.data._id);
            
            success++;
          } else if (change.type === 'delete') {
            // tempId인 경우 스킵 (로컬에서만 삭제)
            if (change.todoId && change.todoId.startsWith('temp_')) {
              addLog(`⏭️ tempId 삭제 스킵: ${change.todoId}`);
              success++;
              continue;
            }
            
            await todoAPI.deleteTodo(change.todoId);
            success++;
          } else if (change.type === 'update') {
            // tempId인 경우 스킵 (이미 create에서 처리됨)
            if (change.todoId && change.todoId.startsWith('temp_')) {
              addLog(`⏭️ tempId 수정 스킵: ${change.todoId}`);
              success++;
              continue;
            }
            
            await todoAPI.updateTodo(change.todoId, change.data);
            success++;
          }
        } catch (err) {
          addLog(`❌ Pending 처리 실패: ${err.message}`);
        }
      }

      await clearPendingChanges();
      addLog(`✅ Pending 처리 완료: ${success}/${pending.length}`);
      
      // 로컬 데이터 재로드 및 캐시 업데이트
      const allTodos = await loadTodos();
      queryClient.setQueryData(['todos', 'all'], allTodos);
      
      // 날짜별 캐시도 업데이트
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], todosForDate);
      addLog(`✅ 캐시 업데이트: 날짜별 ${todosForDate.length}개`);
    } catch (error) {
      addLog(`❌ Pending 처리 실패: ${error.message}`);
    }
  };

  // 11. 델타 동기화
  const deltaSync = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const lastSyncTime = new Date(Date.now() - 60000).toISOString(); // 1분 전
      const res = await todoAPI.getDeltaSync(lastSyncTime);
      addLog(`✅ 델타 동기화: ${res.data.updated.length}개 업데이트, ${res.data.deleted.length}개 삭제`);
    } catch (error) {
      addLog(`❌ 델타 동기화 실패: ${error.message}`);
    }
  };

  // 12. 반복 일정 생성 - 매일
  const createDailyRecurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `매일 반복 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        recurrence: ['RRULE:FREQ=DAILY;UNTIL=20260210T235959Z'],
        recurrenceEndDate: '2026-02-10',
        userTimeZone: 'Asia/Seoul',
      };

      const response = await todoAPI.createTodo(newTodo);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 매일 반복 생성: ${response.data.title}`);
    } catch (error) {
      addLog(`❌ 매일 반복 생성 실패: ${error.message}`);
    }
  };

  // 13. 반복 일정 생성 - 매주
  const createWeeklyRecurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `매주 월수금 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260301T235959Z'],
        recurrenceEndDate: '2026-03-01',
        userTimeZone: 'Asia/Seoul',
      };

      const response = await todoAPI.createTodo(newTodo);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 매주 반복 생성: ${response.data.title} (월수금)`);
    } catch (error) {
      addLog(`❌ 매주 반복 생성 실패: ${error.message}`);
    }
  };

  // 14. 반복 일정 생성 - 매월
  const createMonthlyRecurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `매월 27일 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        recurrence: ['RRULE:FREQ=MONTHLY;BYMONTHDAY=27;UNTIL=20260630T235959Z'],
        recurrenceEndDate: '2026-06-30',
        userTimeZone: 'Asia/Seoul',
      };

      const response = await todoAPI.createTodo(newTodo);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 매월 반복 생성: ${response.data.title} (27일)`);
    } catch (error) {
      addLog(`❌ 매월 반복 생성 실패: ${error.message}`);
    }
  };

  // 15. 반복 일정 생성 - 매년
  const createYearlyRecurrence = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const newTodo = {
        title: `매년 생일 ${new Date().toLocaleTimeString()}`,
        categoryId: '6974f9574a71170933652243',
        isAllDay: true,
        startDate: '2026-01-27',
        endDate: '2026-01-27',
        recurrence: ['RRULE:FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=27'],
        recurrenceEndDate: null,
        userTimeZone: 'Asia/Seoul',
      };

      const response = await todoAPI.createTodo(newTodo);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 매년 반복 생성: ${response.data.title} (1월 27일)`);
    } catch (error) {
      addLog(`❌ 매년 반복 생성 실패: ${error.message}`);
    }
  };

  // 16. 반복 일정 수정 - 모든 일정
  const updateRecurringTodo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const recurringTodo = allTodos.find(todo => 
        todo.recurrence && 
        Array.isArray(todo.recurrence) && 
        todo.recurrence.length > 0
      );
      
      if (!recurringTodo) {
        addLog(`⚠️ 반복 일정 없음`);
        return;
      }

      const updatedData = {
        title: `${recurringTodo.title} (수정됨)`,
      };

      const response = await todoAPI.updateTodo(recurringTodo._id, updatedData);
      await upsertTodo(response.data);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 반복 일정 수정: ${response.data.title}`);
    } catch (error) {
      addLog(`❌ 반복 일정 수정 실패: ${error.message}`);
    }
  };

  // 17. 반복 일정 삭제 - 모든 일정
  const deleteRecurringTodo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      const allTodos = await loadTodos();
      const recurringTodo = allTodos.find(todo => 
        todo.recurrence && 
        Array.isArray(todo.recurrence) && 
        todo.recurrence.length > 0
      );
      
      if (!recurringTodo) {
        addLog(`⚠️ 반복 일정 없음`);
        return;
      }

      await todoAPI.deleteTodo(recurringTodo._id);
      await removeTodo(recurringTodo._id);
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      addLog(`✅ 반복 일정 삭제: ${recurringTodo.title}`);
    } catch (error) {
      addLog(`❌ 반복 일정 삭제 실패: ${error.message}`);
    }
  };

  // 18. 강제 전체 동기화 (델타 무시)
  const forceFullSync = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      addLog(`🔄 강제 전체 동기화 시작...`);
      const response = await todoAPI.getAllTodos();
      const allTodos = response.data;

      await saveTodos(allTodos);
      queryClient.setQueryData(['todos', 'all'], allTodos);
      
      // 날짜별 캐시도 업데이트
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        } else if (todo.startDateTime) {
          const todoDateStr = todo.startDateTime.split('T')[0];
          return todoDateStr === '2026-01-27';
        }
        return false;
      });
      queryClient.setQueryData(['todos', '2026-01-27'], todosForDate);

      addLog(`✅ 강제 전체 동기화 완료: ${allTodos.length}개 (날짜별 ${todosForDate.length}개)`);
    } catch (error) {
      addLog(`❌ 강제 전체 동기화 실패: ${error.message}`);
    }
  };

  // 19. 캐시 vs 로컬 저장소 비교
  const compareCacheAndStorage = async () => {
    try {
      const localTodos = await loadTodos();
      const cachedTodos = queryClient.getQueryData(['todos', 'all']) || [];
      
      const localIds = new Set(localTodos.map(t => t._id));
      const cachedIds = new Set(cachedTodos.map(t => t._id));
      
      const onlyInLocal = localTodos.filter(t => !cachedIds.has(t._id));
      const onlyInCache = cachedTodos.filter(t => !localIds.has(t._id));
      
      addLog(`📊 로컬: ${localTodos.length}개, 캐시: ${cachedTodos.length}개`);
      if (onlyInLocal.length > 0) {
        addLog(`⚠️ 로컬에만 있음: ${onlyInLocal.length}개`);
      }
      if (onlyInCache.length > 0) {
        addLog(`⚠️ 캐시에만 있음: ${onlyInCache.length}개`);
      }
      if (onlyInLocal.length === 0 && onlyInCache.length === 0) {
        addLog(`✅ 로컬과 캐시 일치`);
      }
    } catch (error) {
      addLog(`❌ 비교 실패: ${error.message}`);
    }
  };

  // 20. 동시 수정 충돌 시뮬레이션
  const simulateConflict = async () => {
    try {
      const allTodos = await loadTodos();
      const todosForDate = allTodos.filter(todo => {
        if (todo.isAllDay) {
          const todoStart = todo.startDate;
          const todoEnd = todo.endDate || todo.startDate;
          return '2026-01-27' >= todoStart && '2026-01-27' <= todoEnd;
        }
        return false;
      });

      if (todosForDate.length === 0) {
        addLog(`⚠️ 테스트할 일정 없음`);
        return;
      }

      const todo = todosForDate[0];
      
      // 1. 로컬에서 수정
      const localUpdate = {
        ...todo,
        title: `${todo.title} (로컬수정)`,
        updatedAt: new Date().toISOString(),
      };
      await upsertTodo(localUpdate);
      addLog(`📝 로컬 수정: ${localUpdate.title}`);

      // 2. 서버에서도 수정 (다른 내용)
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        await todoAPI.updateTodo(todo._id, {
          title: `${todo.title} (서버수정)`,
        });
        addLog(`📝 서버 수정: ${todo.title} (서버수정)`);
        
        // 3. 델타 동기화로 충돌 확인
        addLog(`⚠️ 충돌 발생! 델타 동기화로 서버 버전이 우선됩니다.`);
      } else {
        addLog(`⚠️ 오프라인 - 서버 수정 불가`);
      }
    } catch (error) {
      addLog(`❌ 충돌 시뮬레이션 실패: ${error.message}`);
    }
  };

  // 21. 대량 데이터 생성 (성능 테스트)
  const createBulkTodos = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }

      addLog(`🔄 대량 생성 시작 (10개)...`);
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        const newTodo = {
          title: `대량테스트 ${i + 1}`,
          categoryId: '6974f9574a71170933652243',
          isAllDay: true,
          startDate: '2026-01-27',
          endDate: '2026-01-27',
        };
        promises.push(todoAPI.createTodo(newTodo));
      }

      const results = await Promise.all(promises);
      
      for (const res of results) {
        await upsertTodo(res.data);
      }
      
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      addLog(`✅ 대량 생성 완료: ${results.length}개`);
    } catch (error) {
      addLog(`❌ 대량 생성 실패: ${error.message}`);
    }
  };

  // 22. 반복 일정 발생 확인 (특정 날짜)
  const checkRecurrenceOccurrence = async () => {
    try {
      const allTodos = await loadTodos();
      const recurringTodos = allTodos.filter(todo => 
        todo.recurrence && 
        Array.isArray(todo.recurrence) && 
        todo.recurrence.length > 0
      );
      
      if (recurringTodos.length === 0) {
        addLog(`⚠️ 반복 일정 없음`);
        return;
      }

      const testDate = '2026-01-27';
      addLog(`📅 ${testDate} 반복 일정 확인:`);
      
      recurringTodos.forEach(todo => {
        const rrule = todo.recurrence[0] || '';
        const endDate = todo.recurrenceEndDate 
          ? new Date(todo.recurrenceEndDate).toISOString().split('T')[0]
          : '무제한';
        addLog(`  - ${todo.title}: ${rrule.substring(0, 50)}...`);
        addLog(`    시작: ${todo.startDate}, 종료: ${endDate}`);
      });
      
      addLog(`✅ 총 ${recurringTodos.length}개 반복 일정`);
    } catch (error) {
      addLog(`❌ 반복 일정 확인 실패: ${error.message}`);
    }
  };

  // 23. 전체 초기화
  const resetAll = async () => {
    addLog(`⚠️ 전체 초기화 확인 중...`);
    
    if (Platform.OS === 'web') {
      // 웹 환경
      const confirmed = window.confirm('로컬 저장소와 Pending Changes를 모두 삭제하시겠습니까?');
      if (confirmed) {
        try {
          addLog(`🔄 초기화 시작...`);
          await saveTodos([]);
          await clearPendingChanges();
          queryClient.clear();
          addLog(`🗑️ 전체 초기화 완료`);
        } catch (error) {
          addLog(`❌ 초기화 실패: ${error.message}`);
        }
      } else {
        addLog(`❌ 초기화 취소됨`);
      }
    } else {
      // 모바일 환경
      Alert.alert(
        '전체 초기화',
        '로컬 저장소와 Pending Changes를 모두 삭제하시겠습니까?',
        [
          { 
            text: '취소', 
            style: 'cancel',
            onPress: () => addLog(`❌ 초기화 취소됨`)
          },
          {
            text: '초기화',
            style: 'destructive',
            onPress: async () => {
              try {
                addLog(`🔄 초기화 시작...`);
                await saveTodos([]);
                await clearPendingChanges();
                queryClient.clear();
                addLog(`🗑️ 전체 초기화 완료`);
              } catch (error) {
                addLog(`❌ 초기화 실패: ${error.message}`);
              }
            },
          },
        ]
      );
    }
  };

  // 24. 캐시만 클리어 (AsyncStorage는 유지)
  const clearCacheOnly = async () => {
    try {
      addLog(`🔄 캐시 클리어 시작...`);
      queryClient.clear();
      
      const localTodos = await loadTodos();
      addLog(`✅ 캐시 클리어 완료 (로컬: ${localTodos.length}개 유지)`);
    } catch (error) {
      addLog(`❌ 캐시 클리어 실패: ${error.message}`);
    }
  };

  // 25. 오프라인 최초 실행 시뮬레이션
  const simulateOfflineFirstLaunch = async () => {
    try {
      addLog(`🧪 오프라인 최초 실행 시뮬레이션 시작`);
      
      // 1. 네트워크 상태 확인
      const netInfo = await NetInfo.fetch();
      addLog(`1️⃣ 네트워크: ${netInfo.isConnected ? '온라인' : '오프라인'}`);
      
      if (netInfo.isConnected) {
        addLog(`⚠️ 경고: 네트워크가 온라인입니다. 오프라인으로 전환하세요.`);
      }
      
      // 2. AsyncStorage 확인
      const localTodos = await loadTodos();
      addLog(`2️⃣ AsyncStorage: ${localTodos.length}개 할일`);
      
      if (localTodos.length === 0) {
        addLog(`⚠️ 경고: AsyncStorage가 비어있습니다. 먼저 데이터를 동기화하세요.`);
        return;
      }
      
      // 3. React Query 캐시 확인
      const cachedTodos = queryClient.getQueryData(['todos', '2026-01-27']);
      addLog(`3️⃣ React Query 캐시: ${cachedTodos?.length || 0}개`);
      
      // 4. 캐시 클리어
      addLog(`4️⃣ 캐시 클리어 중...`);
      queryClient.clear();
      
      // 5. 캐시 클리어 후 확인
      const cachedAfterClear = queryClient.getQueryData(['todos', '2026-01-27']);
      addLog(`5️⃣ 캐시 클리어 후: ${cachedAfterClear?.length || 0}개`);
      
      // 6. useTodos 시뮬레이션 (서버 요청 실패 시나리오)
      addLog(`6️⃣ useTodos 시뮬레이션 (서버 요청 실패)`);
      const cachedData = queryClient.getQueryData(['todos', '2026-01-27']);
      if (cachedData) {
        addLog(`   ✅ 캐시에서 데이터 반환: ${cachedData.length}개`);
      } else {
        addLog(`   ❌ 캐시 없음 → 빈 배열 반환`);
        addLog(`   🔍 AsyncStorage 확인 필요!`);
      }
      
      addLog(`✅ 시뮬레이션 완료`);
      addLog(`📝 결과: ${cachedData ? '정상' : '문제 발견 - 캐시 없음'}`);
    } catch (error) {
      addLog(`❌ 시뮬레이션 실패: ${error.message}`);
    }
  };

  // 26. Cache-First 성능 측정
  const measureCacheFirstPerformance = async () => {
    try {
      addLog(`⚡ Cache-First 성능 측정 시작`);
      
      // 1. 전체 캐시 확인
      const allTodos = queryClient.getQueryData(['todos', 'all']);
      if (!allTodos || allTodos.length === 0) {
        addLog(`⚠️ 전체 캐시 없음 - 먼저 동기화하세요`);
        return;
      }
      addLog(`1️⃣ 전체 캐시: ${allTodos.length}개`);
      
      // 2. useTodos 성능 측정 (날짜별 필터링)
      const testDate = '2026-01-27';
      const startUseTodos = performance.now();
      const dateTodos = queryClient.getQueryData(['todos', testDate]);
      const endUseTodos = performance.now();
      addLog(`2️⃣ useTodos (${testDate}): ${dateTodos?.length || 0}개 (${(endUseTodos - startUseTodos).toFixed(2)}ms)`);
      
      // 3. useCalendarEvents 성능 측정 (월별 필터링)
      const startCalendar = performance.now();
      const monthEvents = queryClient.getQueryData(['events', 2026, 1]);
      const endCalendar = performance.now();
      addLog(`3️⃣ useCalendarEvents (2026-01): ${monthEvents?.length || 0}개 (${(endCalendar - startCalendar).toFixed(2)}ms)`);
      
      // 4. useAllTodos 성능 측정
      const startAllTodos = performance.now();
      const allTodosCache = queryClient.getQueryData(['todos', 'all']);
      const endAllTodos = performance.now();
      addLog(`4️⃣ useAllTodos: ${allTodosCache?.length || 0}개 (${(endAllTodos - startAllTodos).toFixed(2)}ms)`);
      
      // 5. 총 성능 요약
      const totalTime = (endUseTodos - startUseTodos) + (endCalendar - startCalendar) + (endAllTodos - startAllTodos);
      addLog(`✅ 총 소요 시간: ${totalTime.toFixed(2)}ms`);
      addLog(`📊 예상 결과: 1ms 이하 = 성공, 5ms 이상 = 문제`);
    } catch (error) {
      addLog(`❌ 성능 측정 실패: ${error.message}`);
    }
  };

  // 27. 백그라운드 업데이트 확인
  const verifyBackgroundUpdate = async () => {
    try {
      addLog(`🔄 백그라운드 업데이트 확인 시작`);
      
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }
      
      // 1. 현재 캐시 확인
      const beforeCache = queryClient.getQueryData(['todos', 'all']);
      addLog(`1️⃣ 현재 캐시: ${beforeCache?.length || 0}개`);
      
      // 2. 서버에서 새 데이터 가져오기 (백그라운드 업데이트 시뮬레이션)
      addLog(`2️⃣ 서버 요청 중...`);
      const startTime = performance.now();
      const response = await todoAPI.getAllTodos();
      const endTime = performance.now();
      addLog(`3️⃣ 서버 응답: ${response.data.length}개 (${(endTime - startTime).toFixed(2)}ms)`);
      
      // 3. 캐시 업데이트
      queryClient.setQueryData(['todos', 'all'], response.data);
      addLog(`4️⃣ 캐시 업데이트 완료`);
      
      // 4. 업데이트 후 캐시 확인
      const afterCache = queryClient.getQueryData(['todos', 'all']);
      addLog(`5️⃣ 업데이트 후 캐시: ${afterCache?.length || 0}개`);
      
      // 5. 결과 비교
      if (beforeCache?.length === afterCache?.length) {
        addLog(`✅ 백그라운드 업데이트 성공 (변경 없음)`);
      } else {
        addLog(`✅ 백그라운드 업데이트 성공 (${beforeCache?.length || 0} → ${afterCache?.length || 0})`);
      }
    } catch (error) {
      addLog(`❌ 백그라운드 업데이트 실패: ${error.message}`);
    }
  };

  // 28. 캐시 vs 서버 속도 비교
  const compareCacheVsServer = async () => {
    try {
      addLog(`📊 캐시 vs 서버 속도 비교 시작`);
      
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        addLog(`⚠️ 오프라인 상태 - 서버 연결 필요`);
        return;
      }
      
      // 1. 캐시 속도 측정
      const cacheStart = performance.now();
      const cachedTodos = queryClient.getQueryData(['todos', 'all']);
      const cacheEnd = performance.now();
      const cacheTime = cacheEnd - cacheStart;
      addLog(`1️⃣ 캐시 속도: ${cachedTodos?.length || 0}개 (${cacheTime.toFixed(2)}ms)`);
      
      // 2. 서버 속도 측정
      addLog(`2️⃣ 서버 요청 중...`);
      const serverStart = performance.now();
      const response = await todoAPI.getAllTodos();
      const serverEnd = performance.now();
      const serverTime = serverEnd - serverStart;
      addLog(`3️⃣ 서버 속도: ${response.data.length}개 (${serverTime.toFixed(2)}ms)`);
      
      // 3. 속도 비교
      const speedup = (serverTime / cacheTime).toFixed(0);
      addLog(`📊 캐시가 ${speedup}배 빠름`);
      addLog(`✅ 캐시: ${cacheTime.toFixed(2)}ms vs 서버: ${serverTime.toFixed(2)}ms`);
      
      // 4. Cache-First 효과 분석
      if (cacheTime < 1) {
        addLog(`🎉 Cache-First 최적화 성공! (1ms 이하)`);
      } else if (cacheTime < 10) {
        addLog(`✅ Cache-First 정상 작동 (10ms 이하)`);
      } else {
        addLog(`⚠️ Cache-First 성능 저하 (10ms 이상)`);
      }
    } catch (error) {
      addLog(`❌ 속도 비교 실패: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 델타 동기화 디버그</Text>

      <ScrollView style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={checkNetwork}>
          <Text style={styles.buttonText}>🌐 네트워크 상태</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={checkLocalStorage}>
          <Text style={styles.buttonText}>📦 로컬 저장소</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={checkCache}>
          <Text style={styles.buttonText}>💾 캐시 확인</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.createButton]} onPress={createOfflineTodo}>
          <Text style={styles.buttonText}>➕ 오프라인 생성</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.createButton]} onPress={createOnlineTodo}>
          <Text style={styles.buttonText}>➕ 온라인 생성</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={deleteOfflineTodo}>
          <Text style={styles.buttonText}>🗑️ 오프라인 삭제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={deleteOnlineTodo}>
          <Text style={styles.buttonText}>🗑️ 온라인 삭제</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={updateOfflineTodo}>
          <Text style={styles.buttonText}>📝 오프라인 수정</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={updateOnlineTodo}>
          <Text style={styles.buttonText}>📝 온라인 수정</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.syncButton]} onPress={processPending}>
          <Text style={styles.buttonText}>🔄 Pending 처리</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.syncButton]} onPress={deltaSync}>
          <Text style={styles.buttonText}>🔄 델타 동기화</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>🧹 정리</Text>

        <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={clearCacheOnly}>
          <Text style={styles.buttonText}>💾 캐시만 클리어</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={resetAll}>
          <Text style={styles.buttonText}>🗑️ 전체 초기화</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>🔁 반복 일정 테스트</Text>

        <TouchableOpacity style={[styles.button, styles.recurrenceButton]} onPress={createDailyRecurrence}>
          <Text style={styles.buttonText}>📅 매일 반복 생성</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.recurrenceButton]} onPress={createWeeklyRecurrence}>
          <Text style={styles.buttonText}>📅 매주 반복 생성 (월수금)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.recurrenceButton]} onPress={createMonthlyRecurrence}>
          <Text style={styles.buttonText}>📅 매월 반복 생성 (1일, 15일)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.recurrenceButton]} onPress={createYearlyRecurrence}>
          <Text style={styles.buttonText}>📅 매년 반복 생성 (생일)</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={[styles.button, styles.updateButton]} onPress={updateRecurringTodo}>
          <Text style={styles.buttonText}>📝 반복 일정 수정</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={deleteRecurringTodo}>
          <Text style={styles.buttonText}>🗑️ 반복 일정 삭제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={checkRecurrenceOccurrence}>
          <Text style={styles.buttonText}>📅 반복 일정 발생 확인</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>🧪 고급 테스트</Text>

        <TouchableOpacity style={[styles.button, styles.syncButton]} onPress={forceFullSync}>
          <Text style={styles.buttonText}>🔄 강제 전체 동기화</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={compareCacheAndStorage}>
          <Text style={styles.buttonText}>📊 캐시 vs 로컬 비교</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={simulateConflict}>
          <Text style={styles.buttonText}>⚠️ 동시 수정 충돌</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.createButton]} onPress={createBulkTodos}>
          <Text style={styles.buttonText}>📦 대량 생성 (10개)</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>🧪 오프라인 테스트</Text>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={simulateOfflineFirstLaunch}>
          <Text style={styles.buttonText}>📵 오프라인 최초 실행</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>⚡ Cache-First 성능 테스트</Text>

        <TouchableOpacity style={[styles.button, styles.performanceButton]} onPress={measureCacheFirstPerformance}>
          <Text style={styles.buttonText}>⚡ Cache-First 성능 측정</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.performanceButton]} onPress={verifyBackgroundUpdate}>
          <Text style={styles.buttonText}>🔄 백그라운드 업데이트 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.performanceButton]} onPress={compareCacheVsServer}>
          <Text style={styles.buttonText}>📊 캐시 vs 서버 속도 비교</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>📋 로그</Text>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonContainer: {
    flex: 1,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  createButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: '#FF9500',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  syncButton: {
    backgroundColor: '#5856D6',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  recurrenceButton: {
    backgroundColor: '#AF52DE',
  },
  infoButton: {
    backgroundColor: '#00C7BE',
  },
  warningButton: {
    backgroundColor: '#FF9500',
  },
  performanceButton: {
    backgroundColor: '#FF2D55',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
    color: '#333',
  },
  divider: {
    height: 16,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    padding: 12,
  },
  logTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    color: '#00FF00',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
